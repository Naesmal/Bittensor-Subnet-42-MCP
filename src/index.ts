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

// Load environment variables
dotenv.config();

// Create MCP server instance
const server = new McpServer({
  name: process.env.MCP_SERVER_NAME || "Blockchain Data Provider",
  version: process.env.MCP_SERVER_VERSION || "1.0.0",
  description: process.env.MCP_SERVER_DESCRIPTION || "Provides data access to blockchain resources",
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
    if (error instanceof Error) {
      logger.error(`Failed to initialize Masa service: ${error.message}`);
    } else {
      logger.error(`Failed to initialize Masa service: Unknown error`);
    }
  }
}

if (enableTaostats) {
  try {
    taostatsService = new TaostatsService();
    logger.info("Taostats service initialized successfully");
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to initialize Taostats service: ${error.message}`);
    } else {
      logger.error(`Failed to initialize Taostats service: Unknown error`);
    }
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
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error in Twitter search: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error executing Twitter search: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error in Twitter search: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error executing Twitter search: Unknown error",
              },
            ],
            isError: true,
          };
        }
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
              text: format === "text" ? result.content : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error in web scraping: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error scraping web page: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error in web scraping: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error scraping web page: Unknown error",
              },
            ],
            isError: true,
          };
        }
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
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error in search term extraction: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error extracting search terms: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error in search term extraction: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error extracting search terms: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );
}

// Register Taostats tools if enabled
if (taostatsService) {
  // Register Tao price tool
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
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error getting TAO price: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving TAO price: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error getting TAO price: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error retrieving TAO price: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );

  // Register subnet info tool
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
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error getting subnet info: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving subnet information: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error getting subnet info: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error retrieving subnet information: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );

  // Register validator info tool
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
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error getting validator info: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving validator information: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error getting validator info: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error retrieving validator information: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );

  // Register top validators tool
  server.tool(
    "top_validators",
    "Get a list of top Bittensor validators by stake",
    {
      limit: z.number().min(1).max(100).default(10).describe("Number of validators to return (max 100)"),
    },
    async ({ limit }) => {
      try {
        logger.info(`Getting top ${limit} validators`);
        const result = await taostatsService.getTopValidators(limit);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error getting top validators: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving top validators: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error getting top validators: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error retrieving top validators: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );

  // Register network stats tool
  server.tool(
    "network_stats",
    "Get general statistics about the Bittensor network",
    {},
    async () => {
      try {
        logger.info("Getting Bittensor network stats");
        const result = await taostatsService.getNetworkStats();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error getting network stats: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving network statistics: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error getting network stats: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error retrieving network statistics: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );

  // Register delegator info tool
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
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error getting delegator info: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving delegator information: ${error.message}`,
              },
            ],
            isError: true,
          };
        } else {
          logger.error("Error getting delegator info: Unknown error");
          return {
            content: [
              {
                type: "text",
                text: "Error retrieving delegator information: Unknown error",
              },
            ],
            isError: true,
          };
        }
      }
    }
  );
}

// Choose transport based on environment configuration
const transportType = process.env.MCP_TRANSPORT_TYPE?.toLowerCase() || "stdio";

async function main() {
  try {
    if (transportType === "stdio") {
      // Use stdio transport
      logger.info("Starting MCP server with stdio transport");
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("MCP server connected with stdio transport");
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
          await transport.handlePostMessage(req, res);
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
    if (error instanceof Error) {
      logger.error(`Error starting MCP server: ${error.message}`);
    } else {
      logger.error("Error starting MCP server: Unknown error");
    }
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  if (error instanceof Error) {
    logger.error(`Unhandled error: ${error.message}`);
  } else {
    logger.error("Unhandled error: Unknown error");
  }
  process.exit(1);
});