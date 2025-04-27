import axios, { AxiosInstance } from "axios";
import { RateLimiter } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";
import { 
  TaoPrice, 
  SubnetInfo, 
  ValidatorInfo, 
  NetworkStats, 
  DelegatorInfo, 
  ValidatorList 
} from "../types/blockchain-types.js";

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
   * @returns Structured TAO price data with summary
   */
  public async getTaoPrice(days: number = 1): Promise<TaoPrice> {
    await this.rateLimiter.acquire();
    
    try {
      const limit = Math.min(days, 30); // Limit to 30 days for reasonable response size
      const response = await this.client.get(`/api/price/history/v1`, {
        params: {
          asset: "tao",
          limit,
        },
      });
      
      // Properly handle the case where response.data might be null or not an array
      const history = Array.isArray(response.data) ? response.data : [];
      const currentPrice = history.length > 0 ? history[0] : null;
      
      // Process data safely with null checks
      const processedHistory = history.map((entry: any) => ({
        price: entry && entry.price ? entry.price / 1e9 : 0,
        timestamp: entry && entry.timestamp ? entry.timestamp : 0,
        priceChange24h: entry && entry.price_change_24h ? entry.price_change_24h / 1e9 : 0,
        percentChange24h: entry && entry.percent_change_24h ? entry.percent_change_24h : 0
      }));

      const processedCurrentPrice = currentPrice ? {
        price: currentPrice.price ? currentPrice.price / 1e9 : 0,
        timestamp: currentPrice.timestamp || 0,
        priceChange24h: currentPrice.price_change_24h ? currentPrice.price_change_24h / 1e9 : 0,
        percentChange24h: currentPrice.percent_change_24h || 0
      } : null;
      
      // Generate a human-readable summary
      let summary = "No price data available for TAO token.";
      
      if (processedCurrentPrice) {
        const priceStr = processedCurrentPrice.price.toFixed(2);
        const changeDirection = processedCurrentPrice.percentChange24h >= 0 ? "up" : "down";
        const changePercent = Math.abs(processedCurrentPrice.percentChange24h).toFixed(2);
        
        summary = `TAO is currently trading at $${priceStr}, ${changeDirection} ${changePercent}% in the last 24 hours.`;
        
        if (processedHistory.length > 1) {
          const oldestPrice = processedHistory[processedHistory.length - 1].price;
          const periodChangePercent = ((processedCurrentPrice.price - oldestPrice) / oldestPrice * 100).toFixed(2);
          const periodChangeDirection = parseFloat(periodChangePercent) >= 0 ? "up" : "down";
          
          summary += ` Over the past ${processedHistory.length} days, the price has gone ${periodChangeDirection} ${Math.abs(parseFloat(periodChangePercent))}%.`;
        }
      }
      
      return {
        currentPrice: processedCurrentPrice,
        history: processedHistory,
        summary
      };
    } catch (error) {
      logger.error(`TAO price error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get TAO price: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  /**
   * Get information about a specific subnet
   * 
   * @param netuid The subnet ID
   * @returns Structured subnet information with summary
   */
  public async getSubnetInfo(netuid: number): Promise<SubnetInfo> {
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
      
      // Safely handle response data
      const subnetData = Array.isArray(subnetResponse.data) ? subnetResponse.data : [];
      const historyData = Array.isArray(historyResponse.data) ? historyResponse.data : [];
      const poolData = Array.isArray(poolResponse.data) ? poolResponse.data : [];
      
      const subnetInfo = subnetData.length > 0 ? subnetData[0] : null;
      const poolInfo = poolData.length > 0 ? poolData[0] : null;
      
      // Generate a human-readable summary
      let summary = `No information available for subnet ${netuid}.`;
      let emission = 0;
      let registrations = 0;
      let activeValidators = 0;
      
      if (subnetInfo) {
        const name = subnetInfo.name || `Subnet ${netuid}`;
        emission = subnetInfo.emission_daily_raw ? subnetInfo.emission_daily_raw / 1e9 : 0;
        registrations = subnetInfo.registrations || 0;
        activeValidators = subnetInfo.n || 0;
        
        summary = `${name} (Subnet ${netuid}) has ${activeValidators} active validators and a daily emission of ${emission.toFixed(2)} TAO.`;
        
        if (poolInfo) {
          const alphaPrice = poolInfo.price ? poolInfo.price / 1e9 : 0;
          summary += ` The subnet has an alpha price of ${alphaPrice.toFixed(6)} TAO.`;
        }
        
        if (historyData.length > 0) {
          const oldestEntry = historyData[historyData.length - 1];
          const oldValidators = oldestEntry && oldestEntry.n ? oldestEntry.n : 0;
          const validatorChange = activeValidators - oldValidators;
          
          if (validatorChange !== 0) {
            const direction = validatorChange > 0 ? "increased" : "decreased";
            summary += ` The number of validators has ${direction} by ${Math.abs(validatorChange)} over the past 7 days.`;
          }
        }
      }
      
      return {
        info: subnetInfo,
        history: historyData,
        pool: poolInfo,
        summary,
        emission,
        registrations,
        activeValidators
      };
    } catch (error) {
      logger.error(`Subnet info error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get subnet info: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  /**
   * Get detailed information about a validator
   * 
   * @param hotkey Validator hotkey address
   * @returns Structured validator information with summary
   */
  public async getValidatorInfo(hotkey: string): Promise<ValidatorInfo> {
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
      
      // Safely handle response data
      const validatorData = Array.isArray(validatorResponse.data) ? validatorResponse.data : [];
      const historyData = Array.isArray(historyResponse.data) ? historyResponse.data : [];
      const delegationsData = Array.isArray(delegationsResponse.data) ? delegationsResponse.data : [];
      
      const validatorInfo = validatorData.length > 0 ? validatorData[0] : null;
      
      // Calculate stake information
      let totalStake = 0;
      let selfStake = 0;
      let delegatedStake = 0;
      let dailyEarnings = 0;
      let weeklyEarnings = 0;
      let monthlyEarnings = 0;
      let uptimePercent = 0;
      
      if (validatorInfo) {
        totalStake = validatorInfo.stake_raw ? validatorInfo.stake_raw / 1e9 : 0;
        
        // Calculate self stake vs delegated stake
        const selfDelegation = delegationsData.find((d: any) => 
          d && d.coldkey === validatorInfo.owner
        );
        
        selfStake = selfDelegation && selfDelegation.balance_raw ? selfDelegation.balance_raw / 1e9 : 0;
        delegatedStake = totalStake - selfStake;
        
        // Calculate earnings based on history if available
        if (historyData.length > 0) {
          const earnings = historyData.map((entry: any) => 
            entry && entry.rewards_raw ? entry.rewards_raw / 1e9 : 0
          );
          
          dailyEarnings = earnings[0] || 0;
          
          // Calculate weekly and monthly earnings
          const weekData = earnings.slice(0, Math.min(7, earnings.length));
          weeklyEarnings = weekData.reduce((sum: number, val: number) => sum + val, 0);
          
          const monthData = earnings.slice(0, Math.min(30, earnings.length));
          if (monthData.length > 0) {
            const avgDaily = monthData.reduce((sum: number, val: number) => sum + val, 0) / monthData.length;
            monthlyEarnings = avgDaily * 30;
          }
          
          // Calculate uptime based on historical data
          const uptimeEntries = historyData.filter((entry: any) => 
            entry && entry.active !== undefined
          );
          
          if (uptimeEntries.length > 0) {
            const activeCount = uptimeEntries.filter((entry: any) => entry.active).length;
            uptimePercent = (activeCount / uptimeEntries.length) * 100;
          }
        }
      }
      
      // Generate a human-readable summary
      let summary = `No information available for validator ${hotkey}.`;
      
      if (validatorInfo) {
        const name = validatorInfo.name || `Validator ${hotkey.substring(0, 10)}...`;
        const rank = validatorInfo.rank !== undefined ? `#${validatorInfo.rank}` : "unranked";
        const subnetIds = validatorInfo.subnets || [];
        
        summary = `${name} is a ${rank} validator with ${totalStake.toFixed(2)} TAO staked (${selfStake.toFixed(2)} self-staked, ${delegatedStake.toFixed(2)} delegated).`;
        
        if (subnetIds.length > 0) {
          summary += ` Active on ${subnetIds.length} subnet${subnetIds.length > 1 ? 's' : ''}: ${subnetIds.join(', ')}.`;
        }
        
        if (dailyEarnings > 0) {
          summary += ` Daily earnings: ${dailyEarnings.toFixed(4)} TAO.`;
        }
        
        if (uptimePercent > 0) {
          summary += ` Uptime: ${uptimePercent.toFixed(1)}%.`;
        }
      }
      
      return {
        info: validatorInfo,
        history: historyData,
        delegations: delegationsData,
        summary,
        stake: {
          total: totalStake,
          selfStake,
          delegatedStake
        },
        performance: {
          dailyEarnings,
          weeklyEarnings,
          monthlyEarnings,
          uptimePercent
        }
      };
    } catch (error) {
      logger.error(`Validator info error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get validator info: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  /**
   * Get a list of top validators by stake
   * 
   * @param limit Number of validators to return
   * @returns Structured list of top validators with summary
   */
  public async getTopValidators(limit: number = 10): Promise<ValidatorList> {
    await this.rateLimiter.acquire();
    
    try {
      const response = await this.client.get(`/api/validator/latest/v1`, {
        params: {
          limit: Math.min(limit, 200), // Limit to 200 validators maximum
          order: "stake_desc",
        },
      });
      
      // Safely handle response data
      const validators = Array.isArray(response.data) ? response.data : [];
      
      // Process validators into a more readable format
      const processedValidators = validators.map((v: any, index: number) => ({
        hotkey: v.hotkey,
        name: v.name || `Validator ${v.hotkey.substring(0, 10)}...`,
        stake: v.stake_raw ? v.stake_raw / 1e9 : 0,
        delegations: v.delegations || 0,
        rank: v.rank || index + 1,
        subnets: v.subnets || []
      }));
      
      // Generate a human-readable summary
      let summary = "No validators found.";
      
      if (processedValidators.length > 0) {
        const totalStake: number = processedValidators.reduce((sum: number, v: { stake: number }) => sum + v.stake, 0);
        const avgStake = totalStake / processedValidators.length;
        
        summary = `Top ${processedValidators.length} validators by stake, with a total of ${totalStake.toFixed(2)} TAO staked and an average of ${avgStake.toFixed(2)} TAO per validator.`;
        
        if (processedValidators.length > 0) {
          const topValidator = processedValidators[0];
          summary += ` The #1 validator is ${topValidator.name} with ${topValidator.stake.toFixed(2)} TAO staked.`;
        }
      }
      
      return {
        validators: processedValidators,
        summary,
        totalCount: processedValidators.length
      };
    } catch (error) {
      logger.error(`Top validators error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get top validators: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  /**
   * Get general statistics about the Bittensor network
   * 
   * @returns Structured network statistics with summary
   */
  public async getNetworkStats(): Promise<NetworkStats> {
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
      
      // Safely handle response data
      const statsData = Array.isArray(statsResponse.data) ? statsResponse.data : [];
      const priceData = Array.isArray(priceResponse.data) ? priceResponse.data : [];
      
      const stats = statsData.length > 0 ? statsData[0] : null;
      const price = priceData.length > 0 ? priceData[0] : null;
      
      // Calculate derived metrics
      let totalSupply = 0;
      let activeValidators = 0;
      let totalSubnets = 0;
      let marketCap = 0;
      
      if (stats) {
        totalSupply = stats.total_supply_raw ? stats.total_supply_raw / 1e9 : 0;
        activeValidators = stats.total_neurons || 0;
        totalSubnets = stats.total_subnets || 0;
        
        if (price && price.price) {
          marketCap = totalSupply * (price.price / 1e9);
        }
      }
      
      // Generate a human-readable summary
      let summary = "No network statistics available.";
      
      if (stats) {
        summary = `The Bittensor network currently has ${totalSubnets} subnets with ${activeValidators} active validators.`;
        
        if (totalSupply > 0) {
          summary += ` The total supply is ${totalSupply.toFixed(2)} TAO.`;
        }
        
        if (marketCap > 0) {
          summary += ` Market capitalization: $${marketCap.toFixed(2)}.`;
        }
        
        if (price && price.price) {
          const priceUsd = price.price / 1e9;
          summary += ` Current TAO price: $${priceUsd.toFixed(2)}.`;
        }
      }
      
      return {
        stats,
        price,
        summary,
        totalSupply,
        activeValidators,
        totalSubnets,
        marketCap
      };
    } catch (error) {
      logger.error(`Network stats error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get network stats: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  /**
   * Get information about delegations for a specific coldkey
   * 
   * @param coldkey Delegator coldkey address
   * @returns Structured delegation information with summary
   */
  public async getDelegatorInfo(coldkey: string): Promise<DelegatorInfo> {
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
      
      // Safely handle response data
      const delegations = Array.isArray(delegationsResponse.data) ? delegationsResponse.data : [];
      const events = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];
      const balanceHistory = Array.isArray(balanceHistoryResponse.data) ? balanceHistoryResponse.data : [];
      
      // Calculate statistics
      const totalStaked = delegations.reduce((sum: number, d: any) => 
        sum + (d && d.balance_raw ? d.balance_raw / 1e9 : 0), 0
      );
      
      const totalValidators = delegations.length;
      
      // Estimate recent rewards from balance history if available
      let recentRewards = 0;
      
      if (balanceHistory.length >= 2) {
        // Look at balance changes over the available history
        const changes = [];
        for (let i = 1; i < balanceHistory.length; i++) {
          const prev = balanceHistory[i-1];
          const curr = balanceHistory[i];
          
          if (prev && prev.balance_raw && curr && curr.balance_raw) {
            const change = (prev.balance_raw - curr.balance_raw) / 1e9;
            // Only consider positive changes as potential rewards
            if (change > 0) {
              changes.push(change);
            }
          }
        }
        
        // Calculate average daily reward if we have any positive changes
        if (changes.length > 0) {
          const avgChange = changes.reduce((sum, val) => sum + val, 0) / changes.length;
          recentRewards = avgChange;
        }
      }
      
      // Generate a human-readable summary
      let summary = `No delegation information found for coldkey ${coldkey}.`;
      
      if (delegations.length > 0) {
        summary = `Account ${coldkey.substring(0, 10)}... has delegated a total of ${totalStaked.toFixed(2)} TAO to ${totalValidators} validator${totalValidators !== 1 ? 's' : ''}.`;
        
        if (delegations.length > 0) {
          const topDelegation = delegations[0];
          if (topDelegation && topDelegation.hotkey) {
            const topHotkey = topDelegation.hotkey;
            const topAmount = topDelegation.balance_raw ? topDelegation.balance_raw / 1e9 : 0;
            
            summary += ` Largest delegation: ${topAmount.toFixed(2)} TAO to validator ${topHotkey.substring(0, 10)}...`;
          }
        }
        
        if (recentRewards > 0) {
          summary += ` Estimated daily rewards: ${recentRewards.toFixed(4)} TAO.`;
        }
        
        if (events.length > 0) {
          const latestEvent = events[0];
          if (latestEvent) {
            const eventType = latestEvent.extrinsic_name || "unknown event";
            const eventTime = latestEvent.block_timestamp 
              ? new Date(latestEvent.block_timestamp * 1000).toLocaleDateString() 
              : "unknown date";
            
            summary += ` Latest delegation activity: ${eventType} on ${eventTime}.`;
          }
        }
      }
      
      return {
        delegations,
        events,
        balanceHistory,
        summary,
        totalStaked,
        totalValidators,
        recentRewards
      };
    } catch (error) {
      logger.error(`Delegator info error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get delegator info: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}