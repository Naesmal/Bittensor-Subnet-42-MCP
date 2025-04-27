import axios, { AxiosInstance } from "axios";
import { RateLimiter } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";

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
   * @returns The search results
   */
  public async searchTwitter(query: string, maxResults: number = 10): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/live/twitter", {
        query,
        type: "searchbyquery",
        max_results: Math.min(maxResults, 100),
      });
      
      // If this is just a job ID, we need to poll for results
      if (response.data && response.data.uuid) {
        return await this.pollTwitterSearchResults(response.data.uuid);
      }
      
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Twitter search error: ${error.message}`);
        throw new Error(`Failed to search Twitter: ${error.message}`);
      } else {
        logger.error("Twitter search error: Unknown error");
        throw new Error("Failed to search Twitter: Unknown error");
      }
    }
  }
  
  /**
   * Poll for Twitter search results
   * 
   * @param jobId The job ID returned from the search request
   * @returns The search results once available
   */
  private async pollTwitterSearchResults(jobId: string): Promise<any> {
    const maxAttempts = 10;
    const pollingInterval = 2000; // 2 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      
      try {
        // Check the status of the job
        const statusResponse = await this.client.get(`/api/v1/search/live/twitter/status/${jobId}`);
        
        if (statusResponse.data && statusResponse.data.status === "done") {
          // Job is complete, fetch the results
          const resultsResponse = await this.client.get(`/api/v1/search/live/twitter/result/${jobId}`);
          return resultsResponse.data;
        } else if (statusResponse.data && (statusResponse.data.status === "error" || statusResponse.data.status === "error(retrying)")) {
          throw new Error(`Twitter search job failed: ${statusResponse.data.status}`);
        }
        
        // Otherwise, keep polling
        logger.info(`Twitter search job status: ${statusResponse.data?.status || "unknown"}, attempt ${attempt + 1}/${maxAttempts}`);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error polling Twitter search results: ${error.message}`);
          throw error;
        } else {
          logger.error("Error polling Twitter search results: Unknown error");
          throw new Error("Error polling Twitter search results: Unknown error");
        }
      }
    }
    
    throw new Error(`Twitter search timed out after ${maxAttempts} attempts`);
  }
  
  /**
   * Scrape content from a web page
   * 
   * @param url URL of the web page to scrape
   * @param format Format of the output (text or html)
   * @returns The scraped content
   */
  public async scrapeWebPage(url: string, format: "text" | "html" = "text"): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/live/web/scrape", {
        url,
        format,
      });
      
      return response.data;
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
   * @returns Extracted search terms and explanation
   */
  public async extractSearchTerms(userInput: string): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/extraction", {
        userInput,
      });
      
      return response.data;
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
   * @returns Analysis results
   */
  public async analyzeTweets(tweets: string, prompt: string): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/analysis", {
        tweets,
        prompt,
      });
      
      return response.data;
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
   * @returns The search results
   */
  public async searchSimilarTweets(query: string, keywords?: string[], maxResults: number = 100): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.post("/api/v1/search/similarity/twitter", {
        query,
        keywords,
        max_results: Math.min(maxResults, 100),
      });
      
      return response.data;
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