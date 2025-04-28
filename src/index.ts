#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import { MasaService } from "./services/masa-service.js";
import { TaostatsService } from "./services/taostats-service.js";
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory using ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure dotenv with the path to the .env file in the parent folder
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create MCP server instance
const server = new McpServer({
  name: process.env.MCP_SERVER_NAME || "Blockchain Data Provider",
  version: process.env.MCP_SERVER_VERSION || "1.0.0",
  description: process.env.MCP_SERVER_DESCRIPTION || "Provides access to Masa and Bittensor blockchain data",
});

// Initialize services based on configuration
const enableMasa = process.env.ENABLE_MASA?.toLowerCase() !== 'false';
const enableTaostats = process.env.ENABLE_TAOSTATS?.toLowerCase() !== 'false';

// Initialize enabled services
let masaService: MasaService | null = null;
let taostatsService: TaostatsService | null = null;

if (enableMasa) {
  try {
    masaService = new MasaService();
    logger.info("Masa service initialized successfully");
  } catch (error) {
    logger.error(`Failed to initialize Masa service: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

if (enableTaostats) {
  try {
    taostatsService = new TaostatsService();
    logger.info("Taostats service initialized successfully");
  } catch (error) {
    logger.error(`Failed to initialize Taostats service: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// If no services are enabled, exit with error
if (!masaService && !taostatsService) {
  logger.error("No services enabled or initialized. At least one service must be available.");
  process.exit(1);
}

// Register Masa tools if enabled
if (masaService) {
  // Register Twitter search tool
  server.tool(
    "masa_twitter_search",
    "Search for recent tweets on a specific topic",
    {
      query: z.string().describe("Twitter search query (e.g., keywords, hashtags, or user mentions)"),
      max_results: z.number().optional().describe("Maximum number of results to return (max 100)"),
    },
    async ({ query, max_results = 10 }) => {
      try {
        logger.info(`Running Twitter search for query: ${query}`);
        const results = await masaService.searchTwitter(query, max_results);
        
        return {
          content: [
            {
              type: "text",
              text: `${results.summary}\n\n${JSON.stringify(results.results || [], null, 2)}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error in Twitter search: ${error instanceof Error ? error.message : "Unknown error"}`);
        return {
          content: [
            {
              type: "text",
              text: `Error executing Twitter search: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register web scraper tool
  server.tool(
    "masa_web_scrape",
    "Extract content from a web page",
    {
      url: z.string().url().describe("URL of the web page to scrape"),
      format: z.enum(["text", "html"]).default("text").describe("Format of the output (text or html)"),
    },
    async ({ url, format }) => {
      try {
        logger.info(`Scraping web page: ${url}`);
        const result = await masaService.scrapeWebPage(url, format);
        
        return {
          content: [
            {
              type: "text",
              text: format === "text" 
                ? `${result.summary}\n\n${result.content || ""}` 
                : `${result.summary}\n\n${JSON.stringify(result || {}, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error in web scraping: ${error instanceof Error ? error.message : "Unknown error"}`);
        return {
          content: [
            {
              type: "text",
              text: `Error scraping web page: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register search term extraction tool
  server.tool(
    "masa_extract_search_terms",
    "Use AI to generate relevant search terms from user input",
    {
      userInput: z.string().describe("User query or description of information needed"),
    },
    async ({ userInput }) => {
      try {
        logger.info(`Extracting search terms from: ${userInput}`);
        const result = await masaService.extractSearchTerms(userInput);
        
        // Format a nice response with the main term highlighted
        let formattedResponse = result.summary;
        
        if (result.additionalTerms && result.additionalTerms.length > 0) {
          formattedResponse += "\n\nAdditional search terms you might consider:";
          result.additionalTerms.forEach(term => {
            formattedResponse += `\n- ${term}`;
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: formattedResponse,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error in search term extraction: ${error instanceof Error ? error.message : "Unknown error"}`);
        return {
          content: [
            {
              type: "text",
              text: `Error extracting search terms: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  // Register tweet analysis tool
  server.tool(
    "masa_analyze_tweets",
    "Analyze tweets with a custom prompt",
    {
      tweets: z.string().describe("String containing the tweets to analyze"),
      prompt: z.string().describe("Analysis prompt (e.g., 'Analyze the sentiment of these tweets')"),
    },
    async ({ tweets, prompt }) => {
      try {
        logger.info(`Analyzing tweets with prompt: ${prompt}`);
        const result = await masaService.analyzeTweets(tweets, prompt);
        
        return {
          content: [
            {
              type: "text",
              text: `${result.summary}\n\n${result.result || ""}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error in tweet analysis: ${error instanceof Error ? error.message : "Unknown error"}`);
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing tweets: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  // Register similarity search tool
  server.tool(
    "masa_similarity_search",
    "Find tweets semantically similar to a query",
    {
      query: z.string().describe("The search query"),
      keywords: z.array(z.string()).optional().describe("Optional list of keywords to include"),
      max_results: z.number().optional().describe("Maximum number of results to return (max 100)"),
    },
    async ({ query, keywords, max_results = 50 }) => {
      try {
        logger.info(`Running similarity search for query: ${query}`);
        const results = await masaService.searchSimilarTweets(query, keywords, max_results);
        
        return {
          content: [
            {
              type: "text",
              text: `${results.summary}\n\n${JSON.stringify(results.results || [], null, 2)}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error in similarity search: ${error instanceof Error ? error.message : "Unknown error"}`);
        return {
          content: [
            {
              type: "text",
              text: `Error searching similar tweets: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// Register Taostats tools if enabled
if (taostatsService) {
// Replace the existing tao_price implementation with this:
server.tool(
  "tao_price",
  "Get the current and historical price of TAO token",
  {
    days: z.number().optional().describe("Number of days of price history to retrieve (default: 1)"),
  },
  async ({ days = 1 }) => {
    try {
      logger.info(`Getting TAO price history for ${days} days`);
      const result = await taostatsService.getTaoPrice(days);
      
      if (!result || typeof result !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: "No price data available.",
            },
          ],
        };
      }
      
      // Create a properly formatted response with the new data structure
      const response = [
        result.summary || "No price data available.",
        "",
        "Current Price Details:",
        "--------------",
      ];

      if (result.currentPrice) {
        response.push(`Price: $${result.currentPrice.price.toFixed(2)}`);
        response.push(`Change (24h): ${result.currentPrice.priceChange24h >= 0 ? '+' : ''}${result.currentPrice.priceChange24h.toFixed(2)}%`);
        
        // Add new fields that are available in the updated structure
        if (result.currentPrice.marketCap) {
          response.push(`Market Cap: $${(result.currentPrice.marketCap / 1000000000).toFixed(2)} billion`);
        }
        
        if (result.currentPrice.volume24h) {
          response.push(`24h Volume: $${(result.currentPrice.volume24h / 1000000).toFixed(2)} million`);
        }
        
        if (result.currentPrice.circulatingSupply) {
          response.push(`Circulating Supply: ${result.currentPrice.circulatingSupply.toLocaleString()} TAO`);
        }
        
        response.push(`Last Updated: ${result.currentPrice.timestamp}`);
      } else {
        response.push("No current price data available");
      }
      
      return {
        content: [
          {
            type: "text",
            text: response.join("\n"),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error getting TAO price: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving TAO price: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Replace the existing subnet_info implementation with this:
server.tool(
  "subnet_info",
  "Get information about a specific Bittensor subnet",
  {
    netuid: z.number().describe("The subnet ID to get information for"),
  },
  async ({ netuid }) => {
    try {
      logger.info(`Getting subnet info for netuid: ${netuid}`);
      const result = await taostatsService.getSubnetInfo(netuid);
      
      if (!result || typeof result !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: `No information available for subnet ${netuid}.`,
            },
          ],
        };
      }
      
      // Format response with key metrics using the new fields
      const response = [
        result.summary || `No information available for subnet ${netuid}.`,
        "",
        "Subnet Metrics:",
        "--------------",
        `Active Validators: ${result.activeValidators || 'N/A'}`,
        `Active Miners: ${result.activeMiners || 'N/A'}`,
        `Daily Emission: ${result.emission?.toFixed(2) || 'N/A'} TAO`,
      ];
      
      // Add new fields from the updated structure
      if (result.registrationAllowed !== undefined) {
        response.push(`Registration Allowed: ${result.registrationAllowed ? 'Yes' : 'No'}`);
        if (result.registrationAllowed && result.registrationCost !== undefined) {
          response.push(`Registration Cost: ${result.registrationCost.toFixed(4)} TAO`);
        }
      }
      
      if (result.alphaPrice !== undefined && result.alphaPrice > 0) {
        response.push(`Alpha Token Price: ${result.alphaPrice.toFixed(6)} TAO`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: response.join("\n"),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error getting subnet info: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving subnet information: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Replace the existing validator_info implementation with this:
server.tool(
  "validator_info",
  "Get detailed information about a Bittensor validator",
  {
    hotkey: z.string().describe("Validator hotkey address"),
  },
  async ({ hotkey }) => {
    try {
      logger.info(`Getting validator info for hotkey: ${hotkey}`);
      const result = await taostatsService.getValidatorInfo(hotkey);
      
      if (!result || !result.stake || typeof result.stake !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: `No information available for validator ${hotkey}.`,
            },
          ],
        };
      }
      
      // Format response with key metrics using the updated structure
      const response = [
        result.summary || `No information available for validator ${hotkey}.`,
        "",
        "Validator Metrics:",
        "-----------------",
        `Total Stake: ${result.stake.total.toLocaleString()} TAO`,
        `Self Stake: ${result.stake.selfStake.toLocaleString()} TAO (${(result.stake.total > 0 ? (result.stake.selfStake / result.stake.total) * 100 : 0).toFixed(1)}%)`,
        `Delegated Stake: ${result.stake.delegatedStake.toLocaleString()} TAO (${(result.stake.total > 0 ? (result.stake.delegatedStake / result.stake.total) * 100 : 0).toFixed(1)}%)`,
        "",
      ];
      
      // Add fields from the updated stats structure
      if (result.stats) {
        response.push("Performance:");
        response.push("-----------");
        response.push(`Current APR: ${result.stats.apr.toFixed(2)}%`);
        response.push(`Nominators: ${result.stats.nominators.toLocaleString()}`);
        response.push(`Rank: ${result.stats.rank > 0 ? `#${result.stats.rank}` : 'Unranked'}`);
        
        if (result.stats.registrations && result.stats.registrations.length > 0) {
          response.push(`Active Subnets: ${result.stats.registrations.join(', ')}`);
        }
      }
      
      // Add top delegators if available
      if (result.delegations && result.delegations.length > 0) {
        response.push("");
        response.push("Top Delegators:");
        response.push("-------------");
        
        result.delegations.slice(0, 3).forEach((delegation, index) => {
          response.push(`${index + 1}. ${delegation.coldkey.substring(0, 10)}... - ${delegation.balance.toLocaleString()} TAO`);
        });
      }
      
      return {
        content: [
          {
            type: "text",
            text: response.join("\n"),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error getting validator info: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving validator information: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Replace the existing top_validators implementation with this:
server.tool(
  "top_validators",
  "Get a list of top Bittensor validators by stake",
  {
    limit: z.number().min(1).max(75).default(10).describe("Number of validators to return (max 75)"),
  },
  async ({ limit }) => {
    try {
      logger.info(`Getting top ${limit} validators`);
      const result = await taostatsService.getTopValidators(limit);
      
      if (!result || !result.validators || !Array.isArray(result.validators)) {
        return {
          content: [
            {
              type: "text",
              text: "No validator data available.",
            },
          ],
        };
      }
      
      // Format response with summary and top validators
      let response = (result.summary || "Top validators by stake:") + "\n\nTop Validators:\n--------------\n";
      
      if (result.validators.length === 0) {
        response += "No validators found.";
      } else {
        result.validators.forEach((validator, index) => {
          if (validator && typeof validator === 'object') {
            // Use the updated validator structure
            const aprInfo = validator.apr > 0 ? ` (APR: ${validator.apr.toFixed(2)}%)` : '';
            const nominatorInfo = validator.nominators > 0 ? ` - ${validator.nominators.toLocaleString()} nominators` : '';
            
            response += `${index + 1}. ${validator.name || "Unknown"} - ${validator.stake.toLocaleString()} TAO${nominatorInfo}${aprInfo}\n`;
          }
        });
      }
      
      // Add pagination information
      if (result.totalCount > limit) {
        response += `\nShowing ${limit} of ${result.totalCount.toLocaleString()} validators (Page ${result.currentPage || 1} of ${result.totalPages || 1})`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    } catch (error) {
      logger.error(`Error getting top validators: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving top validators: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Replace the existing network_stats implementation with this:
server.tool(
  "network_stats",
  "Get general statistics about the Bittensor network",
  {},
  async () => {
    try {
      logger.info("Getting Bittensor network stats");
      const result = await taostatsService.getNetworkStats();
      
      if (!result || typeof result !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: "No network statistics available.",
            },
          ],
        };
      }
      
      // Format response with key metrics using the updated fields
      const response = [
        result.summary || "No network statistics available.",
        "",
        "Network Metrics:",
        "---------------",
        `Total Supply: ${result.totalSupply?.toLocaleString() || '0.00'} TAO`,
        `Total Staked: ${result.totalStaked?.toLocaleString() || '0.00'} TAO`,
      ];
      
      // Add new fields from the updated structure
      if (result.stakingRatio !== undefined) {
        response.push(`Staking Ratio: ${result.stakingRatio.toFixed(2)}%`);
      }
      
      if (result.activeAccounts !== undefined) {
        response.push(`Active Accounts: ${result.activeAccounts.toLocaleString()}`);
      }
      
      response.push(`Total Subnets: ${result.totalSubnets || 'N/A'}`);
      
      if (result.marketCap !== undefined) {
        response.push(`Market Cap: $${(result.marketCap / 1000000000).toFixed(2)} billion`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: response.join("\n"),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error getting network stats: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving network statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Replace the existing delegator_info implementation with this:
server.tool(
  "delegator_info",
  "Get information about delegations for a specific coldkey",
  {
    coldkey: z.string().describe("Delegator coldkey address"),
  },
  async ({ coldkey }) => {
    try {
      logger.info(`Getting delegator info for coldkey: ${coldkey}`);
      const result = await taostatsService.getDelegatorInfo(coldkey);
      
      if (!result || typeof result !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: `No delegation information found for coldkey ${coldkey}.`,
            },
          ],
        };
      }
      
      // Format response with key metrics using the updated fields
      let response = [
        result.summary || `No delegation information found for coldkey ${coldkey}.`,
        "",
        "Delegation Metrics:",
        "------------------",
        `Total Staked: ${result.totalStaked?.toLocaleString() || 'N/A'} TAO`,
        `Validators: ${result.totalValidators || 'N/A'}`,
        `Est. Daily Rewards: ${result.recentRewards?.toFixed(4) || 'N/A'} TAO`
      ];
      
      // Add balance information if available
      if (result.balanceHistory && result.balanceHistory.length > 0) {
        const latestBalance = result.balanceHistory[0];
        if (latestBalance) {
          response.push("");
          response.push("Account Balance:");
          response.push("---------------");
          response.push(`Free Balance: ${latestBalance.balanceFree.toLocaleString()} TAO`);
          response.push(`Staked Balance: ${latestBalance.balanceStaked.toLocaleString()} TAO`);
          response.push(`Total Balance: ${latestBalance.balanceTotal.toLocaleString()} TAO`);
        }
      }
      
      // Add top delegations if available using the updated structure
      if (result.delegations && Array.isArray(result.delegations) && result.delegations.length > 0) {
        response.push("");
        response.push("Top Delegations:");
        response.push("--------------");
        
        result.delegations.slice(0, 3).forEach((d, i) => {
          const validatorName = d.hotkeyName || `${d.hotkey.substring(0, 10)}...`;
          response.push(`${i + 1}. ${d.balance.toLocaleString()} TAO to ${validatorName}`);
        });
      }
      
      // Add recent delegation events
      if (result.events && Array.isArray(result.events) && result.events.length > 0) {
        response.push("");
        response.push("Recent Activities:");
        response.push("----------------");
        
        result.events.slice(0, 3).forEach((e, i) => {
          const date = new Date(e.timestamp).toLocaleDateString();
          response.push(`${i + 1}. ${e.action} ${e.amount.toLocaleString()} TAO on ${date}`);
        });
      }
      
      return {
        content: [
          {
            type: "text",
            text: response.join("\n"),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error getting delegator info: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving delegator information: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);
}

// Choose transport based on environment configuration
const transportType = process.env.MCP_TRANSPORT_TYPE?.toLowerCase() || "stdio";

async function main() {
  try {
    logger.info("[blockchain-data] Initializing server...");
    
    if (transportType === "stdio") {
      // Use stdio transport
      logger.info("Starting MCP server with stdio transport");
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("[blockchain-data] Server started and connected successfully");
    } else if (transportType === "http") {
      // Use HTTP transport with SSE
      const port = parseInt(process.env.MCP_HTTP_PORT || "3030");
      const host = process.env.MCP_HTTP_HOST || "localhost";
      
      const app = express();
      
      logger.info(`Starting MCP server with HTTP transport on ${host}:${port}`);
      
      let transport: SSEServerTransport | null = null;
      
      app.get("/sse", (req, res) => {
        logger.info("New SSE connection established");
        transport = new SSEServerTransport("/messages", res);
        server.connect(transport);
      });
      
      app.post("/messages", async (req, res) => {
        if (transport) {
          try {
            await transport.handlePostMessage(req, res);
          } catch (error) {
            logger.error(`Error handling message: ${error instanceof Error ? error.message : "Unknown error"}`);
            res.status(500).send("Error processing message");
          }
        } else {
          res.status(400).send("No active SSE connection");
        }
      });
      
      app.listen(port, host, () => {
        logger.info(`MCP server listening on ${host}:${port}`);
      });
    } else {
      logger.error(`Unsupported transport type: ${transportType}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Error starting MCP server: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error(`Unhandled error: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
});