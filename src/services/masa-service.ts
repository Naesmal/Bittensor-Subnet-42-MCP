import axios, { AxiosInstance } from "axios";
import { RateLimiter } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";
import { 
  TwitterSearchResult, 
  WebScrapeResult, 
  SearchExtractionResult, 
  TweetAnalysisResult, 
  SimilaritySearchResult 
} from "../types/blockchain-types.js";

export class MasaService {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    const apiKey = process.env.MASA_API_KEY;
    const baseUrl = process.env.MASA_API_BASE_URL || "https://data.dev.masalabs.ai";
    
    if (!apiKey) {
      logger.warn("MASA_API_KEY not provided, API calls may fail");
    }
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    logger.info(`Initialized Masa service with base URL: ${baseUrl}`);
    
    // Initialize rate limiter with 15 requests per minute
    this.rateLimiter = new RateLimiter("masa", 15, 60);
  }

  /**
   * Search for tweets related to a specific query
   * 
   * @param query The search query (can include keywords, hashtags, or Twitter operators)
   * @param maxResults Maximum number of results to return (max 100)
   * @returns Job ID as string for tracking the search request
   */
  public async searchTwitter(query: string, maxResults: number = 10): Promise<TwitterSearchResult | string> {
    await this.rateLimiter.acquire();
    
    try {
      logger.info(`Submitting Twitter search: '${query}'`);
      const response = await this.client.post("/api/v1/search/live/twitter", {
        query,
        max_results: Math.min(maxResults, 100)
      });
      
      // Return the job ID for tracking
      if (response.data && response.data.uuid) {
        logger.info(`Search submitted successfully. Job ID: ${response.data.uuid}`);
        return response.data.uuid;
      }
      
      // Handle case where we might get direct results (unlikely with current API)
      const results = response.data?.results || [];
      const summary = this.generateTwitterSearchSummary(results, query);
      
      return {
        results,
        query,
        summary
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error submitting search: ${error.message}`);
        throw new Error(`Failed to search Twitter: ${error.message}`);
      } else {
        logger.error("Unknown error during search submission");
        throw new Error("Failed to search Twitter: Unknown error");
      }
    }
  }

  /**
   * Check the status of a Twitter search job
   * 
   * @param jobId The job ID returned from the search request
   * @returns The current status of the job
   */
  public async checkTwitterSearchStatus(jobId: string): Promise<string> {
    await this.rateLimiter.acquire();
    
    try {
      logger.info(`Checking status for job ${jobId}`);
      const statusResponse = await this.client.get(`/api/v1/search/live/twitter/status/${jobId}`);
      const status = statusResponse.data?.status || "unknown";
      logger.info(`Current status: ${status}`);
      return status;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error checking status: ${error.message}`);
        throw new Error(`Failed to check search status: ${error.message}`);
      } else {
        logger.error("Unknown error while checking status");
        throw new Error("Failed to check search status: Unknown error");
      }
    }
  }

  /**
   * Get the results of a completed Twitter search job
   * 
   * @param jobId The job ID returned from the search request
   * @param originalQuery The original search query
   * @returns The search results
   */
  public async getTwitterSearchResults(jobId: string, originalQuery: string): Promise<TwitterSearchResult> {
    await this.rateLimiter.acquire();
    
    try {
      logger.info(`Retrieving results for job ${jobId}`);
      const resultsResponse = await this.client.get(`/api/v1/search/live/twitter/result/${jobId}`);
      
      let results;
      if (Array.isArray(resultsResponse.data)) {
        results = resultsResponse.data;
      } else if (resultsResponse.data && resultsResponse.data.results) {
        results = resultsResponse.data.results;
      } else {
        results = [];
      }
      
      logger.info(`Results retrieved successfully`);
      
      const normalizedResults = results.map((tweet: { text?: string; Content?: string }) => {
        if (!tweet.text && tweet.Content) {
          return {
            ...tweet,
            text: tweet.Content
          };
        }
        return tweet;
      });
      
      const summary = this.generateTwitterSearchSummary(normalizedResults, originalQuery);
      
      return {
        results: normalizedResults,
        query: originalQuery,
        summary
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error retrieving results: ${error.message}`);
        throw new Error(`Failed to retrieve search results: ${error.message}`);
      } else {
        logger.error("Unknown error while retrieving results");
        throw new Error("Failed to retrieve search results: Unknown error");
      }
    }
  }

  /**
   * Generate a summary for Twitter search results
   * 
   * @param results The search results
   * @param query The original query
   * @returns A human-readable summary
   */
  private generateTwitterSearchSummary(results: any[], query: string): string {
    // Vérifier si results est défini et non vide
    if (!results || !Array.isArray(results) || results.length === 0) {
      return `No tweets found for query "${query}".`;
    }
    
    const count = results.length;
    let summary = `Found ${count} tweet${count !== 1 ? 's' : ''} for query "${query}".`;
    
    // Analyze sentiment if there are enough tweets
    if (count >= 3) {
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'positive', 'happy', 'excited', 'bullish'];
      const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'negative', 'sad', 'disappointing', 'bearish', 'crash'];
      
      let positiveCount = 0;
      let negativeCount = 0;
      
      // Correction : ajouter un type explicite pour le paramètre tweet
      results.forEach((tweet: { text?: string; Content?: string }) => {
        // Utiliser text ou Content, selon ce qui est disponible
        const tweetText = (tweet.text || tweet.Content || '').toLowerCase();
        if (tweetText) {
          positiveWords.forEach(word => {
            if (tweetText.includes(word)) positiveCount++;
          });
          negativeWords.forEach(word => {
            if (tweetText.includes(word)) negativeCount++;
          });
        }
      });
      
      if (positiveCount > negativeCount) {
        summary += ` Overall sentiment appears positive.`;
      } else if (negativeCount > positiveCount) {
        summary += ` Overall sentiment appears negative.`;
      } else {
        summary += ` Overall sentiment appears mixed or neutral.`;
      }
    }
    
    // Add information about the latest tweet
    if (results[0]) {
      const latestTweet = results[0];
      // Utiliser text ou Content, selon ce qui est disponible
      const tweetText = latestTweet.text || latestTweet.Content;
      if (tweetText) {
        summary += ` Most recent tweet: "${tweetText.length > 100 ? tweetText.substring(0, 100) + '...' : tweetText}"`;
      }
    }
    
    return summary;
  }

  /**
   * Scrape content from a web page
   * 
   * @param url URL of the web page to scrape
   * @param format Format of the output (text or html)
   * @returns Structured web scrape results with summary
   */
  public async scrapeWebPage(url: string, format: "text" | "html" = "text"): Promise<WebScrapeResult> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/live/web/scrape", {
        url,
        format,
      });
      
      const result = response.data || {};
      const title = result.title || "Untitled Page";
      const content = result.content || "";
      
      // Generate a summary
      let summary = `Successfully scraped web page "${title}".`;
      
      if (content) {
        const contentLength = content.length;
        const wordCount = content.split(/\s+/).length;
        
        summary += ` Content contains approximately ${wordCount} words (${contentLength} characters).`;
        
        // Add a brief excerpt
        if (content.length > 0) {
          const excerpt = content.length > 150 ? content.substring(0, 150) + "..." : content;
          summary += ` Excerpt: "${excerpt}"`;
        }
      } else {
        summary += " No content was extracted from the page.";
      }
      
      return {
        title,
        content,
        url,
        metadata: result.metadata || {},
        summary
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Web scrape error: ${error.message}`);
        throw new Error(`Failed to scrape web page: ${error.message}`);
      } else {
        logger.error("Web scrape error: Unknown error");
        throw new Error("Failed to scrape web page: Unknown error");
      }
    }
  }
  
  /**
   * Extract search terms from user input using AI
   * 
   * @param userInput The user's query or description
   * @returns Structured search term extraction results with summary
   */
  public async extractSearchTerms(userInput: string): Promise<SearchExtractionResult> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/extraction", {
        userInput,
      });
      
      const result = response.data || {};
      const searchTerm = result.searchTerm || "";
      const thinking = result.thinking || "";
      
      // Extract additional terms from the thinking process if available
      const additionalTerms: string[] = [];
      if (thinking) {
        const potentialTerms = thinking.match(/["']([^"']+)["']/g);
        if (potentialTerms) {
            potentialTerms.forEach((term: string) => {
            // Remove quotes and add to additional terms if not already the main term
            const cleanTerm: string = term.replace(/['"]/g, '');
            if (cleanTerm && cleanTerm !== searchTerm && !additionalTerms.includes(cleanTerm)) {
              additionalTerms.push(cleanTerm);
            }
            });
        }
      }
      
      // Generate a summary
      let summary = `Extracted search term "${searchTerm}" from input: "${userInput}".`;
      
      if (additionalTerms.length > 0) {
        summary += ` Additional related terms: ${additionalTerms.join(', ')}.`;
      }
      
      if (thinking) {
        summary += ` AI reasoning: ${thinking.length > 100 ? thinking.substring(0, 100) + '...' : thinking}`;
      }
      
      return {
        searchTerm,
        thinking,
        additionalTerms: additionalTerms.length > 0 ? additionalTerms : undefined,
        summary
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Search term extraction error: ${error.message}`);
        throw new Error(`Failed to extract search terms: ${error.message}`);
      } else {
        logger.error("Search term extraction error: Unknown error");
        throw new Error("Failed to extract search terms: Unknown error");
      }
    }
  }
  
  /**
   * Analyze tweets with a custom prompt
   * 
   * @param tweets String containing the tweets to analyze
   * @param prompt Analysis prompt
   * @returns Structured tweet analysis results with summary
   */
  public async analyzeTweets(tweets: string, prompt: string): Promise<TweetAnalysisResult> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/analysis", {
        tweets,
        prompt,
      });
      
      const result = response.data?.result || "";
      
      // Detect sentiment from result if possible
      let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | undefined = undefined;
      
      const lowerResult = result.toLowerCase();
      if (lowerResult.includes('positive')) {
        sentiment = 'positive';
      } else if (lowerResult.includes('negative')) {
        sentiment = 'negative';
      } else if (lowerResult.includes('neutral')) {
        sentiment = 'neutral';
      } else if (lowerResult.includes('mixed')) {
        sentiment = 'mixed';
      }
      
      // Generate a summary
      let summary = `Analyzed tweets with prompt: "${prompt}".`;
      
      if (result) {
        summary += ` Analysis: ${result.length > 100 ? result.substring(0, 100) + '...' : result}`;
      } else {
        summary += " No analysis was produced.";
      }
      
      if (sentiment) {
        summary += ` Overall sentiment appears to be ${sentiment}.`;
      }
      
      return {
        result,
        summary,
        sentiment
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Tweet analysis error: ${error.message}`);
        throw new Error(`Failed to analyze tweets: ${error.message}`);
      } else {
        logger.error("Tweet analysis error: Unknown error");
        throw new Error("Failed to analyze tweets: Unknown error");
      }
    }
  }
  
  /**
   * Search for similar tweets with semantic matching
   * 
   * @param query The search query
   * @param keywords Optional list of keywords to include
   * @param maxResults Maximum number of results to return
   * @returns Structured similarity search results with summary
   */
  public async searchSimilarTweets(query: string, keywords?: string[], maxResults: number = 100): Promise<SimilaritySearchResult> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/similarity/twitter", {
        query,
        keywords,
        max_results: Math.min(maxResults, 100),
      });
      
      const results = response.data?.results || [];
      
      // Generate a summary
      let summary = `Found ${results.length} tweets semantically similar to "${query}".`;
      
      if (keywords && keywords.length > 0) {
        summary += ` Used additional keywords: ${keywords.join(', ')}.`;
      }
      
      if (results.length > 0) {
        const highestSimilarity = results[0].similarity;
        summary += ` Top result has similarity score of ${highestSimilarity.toFixed(2)}.`;
        
        const topTweet = results[0].text;
        if (topTweet) {
          summary += ` Most similar tweet: "${topTweet.length > 100 ? topTweet.substring(0, 100) + '...' : topTweet}"`;
        }
      }
      
      return {
        results,
        query,
        summary
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Similarity search error: ${error.message}`);
        throw new Error(`Failed to search similar tweets: ${error.message}`);
      } else {
        logger.error("Similarity search error: Unknown error");
        throw new Error("Failed to search similar tweets: Unknown error");
      }
    }
  }
}