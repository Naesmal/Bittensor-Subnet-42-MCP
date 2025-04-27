import axios, { AxiosInstance } from "axios";
import { RateLimiter } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";

export class TaostatsService {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    const apiKey = process.env.TAO_STAT_API_KEY;
    const minuteLimit = parseInt(process.env.TAO_STAT_MINUTE_LIMIT || "5");
    
    if (!apiKey) {
      logger.warn("TAO_STAT_API_KEY not provided, API calls may fail");
    }
    
    this.client = axios.create({
      baseURL: "https://api.taostats.io",
      headers: {
        accept: "application/json",
        Authorization: apiKey,
      },
    });
    
    // Initialize rate limiter with configurable requests per minute (default: 5)
    this.rateLimiter = new RateLimiter("taostats", minuteLimit, 60);
    
    logger.info(`Initialized Taostats service with rate limit: ${minuteLimit} requests per minute`);
  }

  /**
   * Get the current and historical price of TAO token
   * 
   * @param days Number of days of price history to retrieve
   * @returns TAO price data
   */
  public async getTaoPrice(days: number = 1): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const limit = Math.min(days, 30); // Limit to 30 days for reasonable response size
      const response = await this.client.get(`/api/price/history/v1`, {
        params: {
          asset: "tao",
          limit,
        },
      });
      
      return {
        currentPrice: response.data.length > 0 ? response.data[0] : null,
        history: response.data,
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`TAO price error: ${error.message}`);
        throw new Error(`Failed to get TAO price: ${error.message}`);
      } else {
        logger.error("TAO price error: Unknown error");
        throw new Error("Failed to get TAO price: Unknown error");
      }
    }
  }
  
  /**
   * Get information about a specific subnet
   * 
   * @param netuid The subnet ID
   * @returns Subnet information
   */
  public async getSubnetInfo(netuid: number): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      // Get basic subnet info
      const subnetResponse = await this.client.get(`/api/subnet/latest/v1`, {
        params: {
          netuid,
        },
      });
      
      // Get subnet history (last 7 days)
      await this.rateLimiter.acquire();
      const historyResponse = await this.client.get(`/api/subnet/history/v1`, {
        params: {
          netuid,
          limit: 7, // 7 days of history
        },
      });
      
      // Get pool information
      await this.rateLimiter.acquire();
      const poolResponse = await this.client.get(`/api/dtao/pool/latest/v1`, {
        params: {
          netuid,
        },
      });
      
      return {
        info: subnetResponse.data.length > 0 ? subnetResponse.data[0] : null,
        history: historyResponse.data,
        pool: poolResponse.data.length > 0 ? poolResponse.data[0] : null,
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Subnet info error: ${error.message}`);
        throw new Error(`Failed to get subnet info: ${error.message}`);
      } else {
        logger.error("Subnet info error: Unknown error");
        throw new Error("Failed to get subnet info: Unknown error");
      }
    }
  }
  
  /**
   * Get detailed information about a validator
   * 
   * @param hotkey Validator hotkey address
   * @returns Validator information
   */
  public async getValidatorInfo(hotkey: string): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      // Get basic validator info
      const validatorResponse = await this.client.get(`/api/validator/latest/v1`, {
        params: {
          hotkey,
        },
      });
      
      // Get validator history (last 14 days)
      await this.rateLimiter.acquire();
      const historyResponse = await this.client.get(`/api/validator/history/v1`, {
        params: {
          hotkey,
          limit: 14, // 14 days of history
        },
      });
      
      // Get delegations for this validator
      await this.rateLimiter.acquire();
      const delegationsResponse = await this.client.get(`/api/dtao/stake_balance/latest/v1`, {
        params: {
          hotkey,
          limit: 100,
          order: "balance_desc",
        },
      });
      
      return {
        info: validatorResponse.data.length > 0 ? validatorResponse.data[0] : null,
        history: historyResponse.data,
        delegations: delegationsResponse.data,
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Validator info error: ${error.message}`);
        throw new Error(`Failed to get validator info: ${error.message}`);
      } else {
        logger.error("Validator info error: Unknown error");
        throw new Error("Failed to get validator info: Unknown error");
      }
    }
  }
  
  /**
   * Get a list of top validators by stake
   * 
   * @param limit Number of validators to return
   * @returns List of top validators
   */
  public async getTopValidators(limit: number = 10): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.get(`/api/validator/latest/v1`, {
        params: {
          limit: Math.min(limit, 200), // Limit to 200 validators maximum
          order: "stake_desc",
        },
      });
      
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Top validators error: ${error.message}`);
        throw new Error(`Failed to get top validators: ${error.message}`);
      } else {
        logger.error("Top validators error: Unknown error");
        throw new Error("Failed to get top validators: Unknown error");
      }
    }
  }
  
  /**
   * Get general statistics about the Bittensor network
   * 
   * @returns Network statistics
   */
  public async getNetworkStats(): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      // Get general network stats
      const statsResponse = await this.client.get(`/api/stats/latest/v1`);
      
      // Get current TAO price
      await this.rateLimiter.acquire();
      const priceResponse = await this.client.get(`/api/price/history/v1`, {
        params: {
          asset: "tao",
          limit: 1,
        },
      });
      
      return {
        stats: statsResponse.data.length > 0 ? statsResponse.data[0] : null,
        price: priceResponse.data.length > 0 ? priceResponse.data[0] : null,
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Network stats error: ${error.message}`);
        throw new Error(`Failed to get network stats: ${error.message}`);
      } else {
        logger.error("Network stats error: Unknown error");
        throw new Error("Failed to get network stats: Unknown error");
      }
    }
  }
  
  /**
   * Get information about delegations for a specific coldkey
   * 
   * @param coldkey Delegator coldkey address
   * @returns Delegation information
   */
  public async getDelegatorInfo(coldkey: string): Promise<any> {
    await this.rateLimiter.acquire();
    
    try {
      // Get delegations from this coldkey
      const delegationsResponse = await this.client.get(`/api/dtao/stake_balance/latest/v1`, {
        params: {
          coldkey,
          limit: 200,
        },
      });
      
      // Get delegation events
      await this.rateLimiter.acquire();
      const eventsResponse = await this.client.get(`/api/delegation/v1`, {
        params: {
          nominator: coldkey,
          limit: 100,
          order: "block_number_desc", // Most recent first
        },
      });
      
      // Get balance history
      await this.rateLimiter.acquire();
      
      // Current timestamp in seconds
      const now = Math.floor(Date.now() / 1000);
      // 30 days ago in seconds
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
      
      const balanceHistoryResponse = await this.client.get(`/api/account/history/v1`, {
        params: {
          address: coldkey,
          timestamp_start: thirtyDaysAgo,
          timestamp_end: now,
          limit: 30,
        },
      });
      
      return {
        delegations: delegationsResponse.data,
        events: eventsResponse.data,
        balanceHistory: balanceHistoryResponse.data,
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Delegator info error: ${error.message}`);
        throw new Error(`Failed to get delegator info: ${error.message}`);
      } else {
        logger.error("Delegator info error: Unknown error");
        throw new Error("Failed to get delegator info: Unknown error");
      }
    }
  }
}