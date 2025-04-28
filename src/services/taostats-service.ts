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

/**
 * Service for interacting with the Taostats API to retrieve information
 * about the Bittensor network, including TAO token prices, validator information,
 * subnet details, and more.
 */
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
          limit: limit, // Changed from per_page to limit
        },
      });
      
      // The structure follows {pagination: {...}, data: [...]}
      const paginatedData = response.data;
      const priceData = paginatedData?.data || [];
      
      // Process the most recent price entry
      const currentPriceEntry = priceData.length > 0 ? priceData[0] : null;
      
      // Generate current price info
      const currentPrice = currentPriceEntry ? {
        price: parseFloat(currentPriceEntry.price) || 0,
        timestamp: currentPriceEntry.last_updated || '',
        priceChange24h: parseFloat(currentPriceEntry.percent_change_24h) || 0,
        marketCap: parseFloat(currentPriceEntry.market_cap) || 0,
        volume24h: parseFloat(currentPriceEntry.volume_24h) || 0,
        circulatingSupply: parseFloat(currentPriceEntry.circulating_supply) || 0,
        maxSupply: parseFloat(currentPriceEntry.max_supply) || 0
      } : null;
      
      // Process historical data
      interface PriceHistoryEntry {
        price: number;
        timestamp: string;
        priceChange24h: number;
        priceChange7d: number;
        priceChange30d: number;
      }

      const history: PriceHistoryEntry[] = priceData.map((entry: any): PriceHistoryEntry => ({
        price: parseFloat(entry.price) || 0,
        timestamp: entry.last_updated || '',
        priceChange24h: parseFloat(entry.percent_change_24h) || 0,
        priceChange7d: parseFloat(entry.percent_change_7d) || 0,
        priceChange30d: parseFloat(entry.percent_change_30d) || 0
      }));
      
      // Generate a human-readable summary
      let summary = "No price data available for TAO token.";
      
      if (currentPrice) {
        const priceStr = currentPrice.price.toFixed(2);
        const changeDirection = currentPrice.priceChange24h >= 0 ? "up" : "down";
        const changePercent = Math.abs(currentPrice.priceChange24h).toFixed(2);
        
        summary = `TAO is currently trading at $${priceStr}, ${changeDirection} ${changePercent}% in the last 24 hours.`;
        
        if (currentPriceEntry.percent_change_7d) {
          const weekChangeDirection = parseFloat(currentPriceEntry.percent_change_7d) >= 0 ? "up" : "down";
          const weekChangePercent = Math.abs(parseFloat(currentPriceEntry.percent_change_7d)).toFixed(2);
          summary += ` Over the past week, the price has gone ${weekChangeDirection} ${weekChangePercent}%.`;
        }
        
        if (currentPrice.marketCap) {
          summary += ` The current market cap is $${(currentPrice.marketCap / 1000000000).toFixed(2)} billion.`;
        }
      }
      
      return {
        currentPrice,
        history,
        summary
      };
    } catch (error) {
      logger.error(`TAO price error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get TAO price: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      
      // Get current TAO price for market cap calculation
      await this.rateLimiter.acquire();
      const priceResponse = await this.client.get(`/api/price/history/v1`, {
        params: {
          asset: "tao",
          limit: 1, // Changed from per_page to limit
        },
      });
      
      // The structure follows {pagination: {...}, data: [...]}
      const statsData = statsResponse.data?.data || [];
      const priceData = priceResponse.data?.data || [];
      
      const stats = statsData.length > 0 ? statsData[0] : null;
      const price = priceData.length > 0 ? priceData[0] : null;
      
      // Calculate derived metrics
      let totalSupply = 0;
      let totalStaked = 0;
      let stakingRatio = 0;
      let activeAccounts = 0;
      let totalSubnets = 0;
      let marketCap = 0;
      
      if (stats) {
        // Convert raw values to TAO (divide by 10^9)
        totalSupply = parseFloat(stats.issued) / 1e9;
        totalStaked = parseFloat(stats.staked) / 1e9;
        stakingRatio = totalStaked / totalSupply * 100;
        activeAccounts = parseInt(stats.accounts) || 0;
        totalSubnets = parseInt(stats.subnets) || 0;
        
        if (price) {
          marketCap = totalSupply * parseFloat(price.price);
        }
      }
      
      // Generate a human-readable summary
      let summary = "No network statistics available.";
      
      if (stats) {
        summary = `The Bittensor network currently has ${totalSubnets} subnets and ${activeAccounts.toLocaleString()} active accounts.`;
        
        if (totalSupply > 0) {
          summary += ` The total supply is ${totalSupply.toLocaleString()} TAO with ${totalStaked.toLocaleString()} TAO staked (${stakingRatio.toFixed(2)}% of supply).`;
        }
        
        if (marketCap > 0) {
          summary += ` Market capitalization: $${(marketCap / 1000000000).toFixed(2)} billion.`;
        }
        
        if (price) {
          summary += ` Current TAO price: $${parseFloat(price.price).toFixed(2)}.`;
        }
      }
      
      return {
        raw: {
          stats,
          price
        },
        summary,
        totalSupply,
        totalStaked,
        stakingRatio,
        activeAccounts,
        totalSubnets,
        marketCap
      };
    } catch (error) {
      logger.error(`Network stats error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get network stats: ${error instanceof Error ? error.message : "Unknown error"}`);
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
          limit: Math.min(limit, 75), // API seems to max out at 75 validators. Changed from per_page to limit
          order: "stake_desc"
        },
      });
      
      // The structure follows {pagination: {...}, data: [...]}
      const paginatedData = response.data;
      const validators = paginatedData?.data || [];
      
      // Process validators into a more readable format
      const processedValidators = validators.map((v: any) => {
        // Extract hotkey and coldkey data
        const hotkey = v.hotkey?.ss58 || '';
        const coldkey = v.coldkey?.ss58 || '';
        const name = v.name || `Validator ${hotkey.substring(0, 10)}...`;
        
        // Get stake information
        const stake = parseFloat(v.stake) / 1e9;
        const systemStake = parseFloat(v.system_stake) / 1e9;
        const dominance = parseFloat(v.dominance) || 0;
        
        // Nominator information
        const nominators = parseInt(v.nominators) || 0;
        const nominators24hrChange = parseInt(v.nominators_24_hr_change) || 0;
        
        // APR information
        const apr = parseFloat(v.apr) || 0;
        const apr7DayAvg = parseFloat(v.apr_7_day_average) || 0;
        const apr30DayAvg = parseFloat(v.apr_30_day_average) || 0;
        
        // Other useful information
        const rank = parseInt(v.rank) || 0;
        const registrations = v.registrations || [];
        const permits = v.permits || [];
        const take = parseFloat(v.take) || 0;
        
        return {
          hotkey,
          coldkey,
          name,
          rank,
          stake,
          systemStake,
          dominance,
          nominators,
          nominators24hrChange,
          apr,
          apr7DayAvg,
          apr30DayAvg,
          registrations,
          permits,
          take
        };
      });
      
      // Generate a human-readable summary
      let summary = "No validators found.";
      
      if (processedValidators.length > 0) {
        const totalStake: number = processedValidators.reduce((sum: number, v: { stake: number }) => sum + v.stake, 0);
        const totalNominators: number = processedValidators.reduce((sum: number, v: { nominators: number }) => sum + v.nominators, 0);
        const avgStake = totalStake / processedValidators.length;
        const avgApr: number = processedValidators.reduce((sum: number, v: { apr: number }) => sum + v.apr, 0) / processedValidators.length;
        
        summary = `Top ${processedValidators.length} validators by stake, with a total of ${totalStake.toLocaleString()} TAO staked and ${totalNominators.toLocaleString()} nominators.`;
        summary += ` Average stake per validator is ${avgStake.toLocaleString()} TAO with an average APR of ${avgApr.toFixed(2)}%.`;
        
        if (processedValidators.length > 0) {
          const topValidator = processedValidators[0];
          summary += ` The #1 validator is ${topValidator.name} with ${topValidator.stake.toLocaleString()} TAO staked and ${topValidator.nominators.toLocaleString()} nominators.`;
        }
      }
      
      return {
        validators: processedValidators,
        summary,
        totalCount: paginatedData?.pagination?.total_items || processedValidators.length,
        totalPages: paginatedData?.pagination?.total_pages || 1,
        currentPage: paginatedData?.pagination?.current_page || 1
      };
    } catch (error) {
      logger.error(`Top validators error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get top validators: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      // Get current subnet info - the param is part of the query, not the path
      const subnetResponse = await this.client.get(`/api/subnet/latest/v1`, {
        params: {
          netuid: netuid,
        },
      });
      
      // Get subnet history
      await this.rateLimiter.acquire();
      const historyResponse = await this.client.get(`/api/subnet/history/v1`, {
        params: {
          netuid: netuid,
          limit: 7, // Changed from per_page to limit for Get 7 days of history
        },
      });
      
      // Get pool information if applicable
      await this.rateLimiter.acquire();
      const poolResponse = await this.client.get(`/api/dtao/pool/latest/v1`, {
        params: {
          netuid: netuid,
        },
      });
      
      // The structure follows {pagination: {...}, data: [...]} 
      const subnetData = subnetResponse.data?.data || [];
      const historyData = historyResponse.data?.data || [];
      const poolData = poolResponse.data?.data || [];
      
      const subnetInfo = subnetData.length > 0 ? subnetData[0] : null;
      const poolInfo = poolData.length > 0 ? poolData[0] : null;
      
      // Calculate derived metrics
      let emission = 0;
      let activeValidators = 0;
      let activeMiners = 0;
      let registrationAllowed = false;
      let registrationCost = 0;
      let alphaPrice = 0;
      
      if (subnetInfo) {
        emission = parseFloat(subnetInfo.emission) / 1e9;
        activeValidators = parseInt(subnetInfo.active_validators) || 0;
        activeMiners = parseInt(subnetInfo.active_miners) || 0;
        registrationAllowed = subnetInfo.registration_allowed === true;
        registrationCost = parseFloat(subnetInfo.neuron_registration_cost) / 1e9;
      }
      
      if (poolInfo) {
        alphaPrice = parseFloat(poolInfo.price) || 0;
      }
      
      // Generate a human-readable summary
      let summary = `No information available for subnet ${netuid}.`;
      
      if (subnetInfo) {
        // Try to get a meaningful name
        const modality = parseInt(subnetInfo.modality) || 0;
        const modalityName = this.getModalityName(modality);
        const name = poolInfo?.name || modalityName || `Subnet ${netuid}`;
        
        summary = `${name} (Subnet ${netuid}) has ${activeValidators} active validators and ${activeMiners} active miners.`;
        summary += ` Daily emission is approximately ${emission.toFixed(2)} TAO.`;
        
        if (registrationAllowed) {
          summary += ` New registrations are currently allowed with a cost of ${registrationCost.toFixed(4)} TAO.`;
        } else {
          summary += ` New registrations are currently not allowed.`;
        }
        
        if (poolInfo) {
          summary += ` The subnet has an α token with a price of ${alphaPrice.toFixed(6)} TAO.`;
          
          if (poolInfo.price_change_1_day) {
            const priceChange = parseFloat(poolInfo.price_change_1_day);
            const direction = priceChange >= 0 ? "up" : "down";
            summary += ` The α price has gone ${direction} ${Math.abs(priceChange).toFixed(2)}% in the last 24 hours.`;
          }
        }
      }
      
      return {
        info: subnetInfo,
        history: historyData,
        pool: poolInfo,
        summary,
        emission,
        activeValidators,
        activeMiners,
        registrationAllowed,
        registrationCost,
        alphaPrice
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
      
      // Get validator history
      await this.rateLimiter.acquire();
      const historyResponse = await this.client.get(`/api/validator/history/v1`, {
        params: {
          hotkey,
          limit: 14, // Changed from per_page to limit for 14 days of history
        },
      });
      
      // Get delegations for this validator
      await this.rateLimiter.acquire();
      const delegationsResponse = await this.client.get(`/api/dtao/stake_balance/latest/v1`, {
        params: {
          hotkey,
          limit: 100, // Changed from per_page to limit
          order: "balance_desc"
        },
      });
      
      // The structure follows {pagination: {...}, data: [...]}
      const validatorData = validatorResponse.data?.data || [];
      const historyData = historyResponse.data?.data || [];
      const delegationsData = delegationsResponse.data?.data || [];
      
      const validatorInfo = validatorData.length > 0 ? validatorData[0] : null;
      
      // Process validator info if available
      let totalStake = 0;
      let selfStake = 0;
      let delegatedStake = 0;
      let apr = 0;
      let nominators = 0;
      let rank = 0;
      let registrations = [];
      
      if (validatorInfo) {
        totalStake = parseFloat(validatorInfo.stake) / 1e9;
        nominators = parseInt(validatorInfo.nominators) || 0;
        apr = parseFloat(validatorInfo.apr) || 0;
        rank = parseInt(validatorInfo.rank) || 0;
        registrations = validatorInfo.registrations || [];
        
        // Find self-delegation if available
        if (validatorInfo.coldkey && delegationsData.length > 0) {
          const selfDelegation = delegationsData.find((d: any) => 
            d && d.coldkey && d.coldkey.ss58 === validatorInfo.coldkey.ss58
          );
          
          if (selfDelegation) {
            selfStake = parseFloat(selfDelegation.balance) / 1e9;
          }
        }
        
        delegatedStake = totalStake - selfStake;
      }
      
      // Process delegations
      const processedDelegations = delegationsData.map((d: any) => ({
        coldkey: d.coldkey?.ss58 || '',
        balance: parseFloat(d.balance) / 1e9 || 0,
        rank: parseInt(d.subnet_rank) || 0
      }));
      
      // Generate a human-readable summary
      let summary = `No information available for validator ${hotkey}.`;
      
      if (validatorInfo) {
        const name = validatorInfo.name || `Validator ${hotkey.substring(0, 10)}...`;
        const rankStr = rank > 0 ? `#${rank}` : "unranked";
        
        summary = `${name} is a ${rankStr} validator with ${totalStake.toLocaleString()} TAO staked`;
        
        if (selfStake > 0 || delegatedStake > 0) {
          summary += ` (${selfStake.toLocaleString()} self-staked, ${delegatedStake.toLocaleString()} delegated).`;
        } else {
          summary += `.`;
        }
        
        if (nominators > 0) {
          summary += ` Has ${nominators.toLocaleString()} nominators.`;
        }
        
        if (apr > 0) {
          summary += ` Current APR: ${apr.toFixed(2)}%.`;
        }
        
        if (registrations.length > 0) {
          summary += ` Active on ${registrations.length} subnet${registrations.length > 1 ? 's' : ''}: ${registrations.join(', ')}.`;
        }
      }
      
      return {
        info: validatorInfo,
        history: historyData,
        delegations: processedDelegations,
        summary,
        stake: {
          total: totalStake,
          selfStake,
          delegatedStake
        },
        stats: {
          apr,
          nominators,
          rank,
          registrations
        }
      };
    } catch (error) {
      logger.error(`Validator info error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(`Failed to get validator info: ${error instanceof Error ? error.message : "Unknown error"}`);
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
          limit: 200, // Changed from per_page to limit
        },
      });
      
      // Get delegation events
      await this.rateLimiter.acquire();
      const eventsResponse = await this.client.get(`/api/delegation/v1`, {
        params: {
          nominator: coldkey, // This is correct - using nominator instead of coldkey
          limit: 100, // Changed from per_page to limit
          order: "block_number_desc"
        },
      });
      
      // Get balance history
      await this.rateLimiter.acquire();
      // Calculate timestamps for start and end (30 days)
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
      
      const balanceHistoryResponse = await this.client.get(`/api/account/history/v1`, {
        params: {
          address: coldkey,
          timestamp_start: thirtyDaysAgo,
          timestamp_end: now,
          limit: 30, // Changed from per_page to limit
        },
      });
      
      // The structure follows {pagination: {...}, data: [...]}
      const delegations = delegationsResponse.data?.data || [];
      const events = eventsResponse.data?.data || [];
      const balanceHistory = balanceHistoryResponse.data?.data || [];
      
      // Process delegations
      const processedDelegations = delegations.map((d: any) => ({
        hotkey: d.hotkey?.ss58 || '',
        hotkeyName: d.hotkey_name || '',
        balance: parseFloat(d.balance) / 1e9 || 0,
        rank: parseInt(d.subnet_rank) || 0,
        netuid: parseInt(d.netuid) || 0
      }));
      
      // Process delegation events
      const processedEvents = events.map((e: any) => ({
        id: e.id || '',
        action: e.action || '',
        amount: parseFloat(e.amount) / 1e9 || 0,
        timestamp: e.timestamp || '',
        blockNumber: parseInt(e.block_number) || 0,
        delegate: e.delegate?.ss58 || '',
      }));
      
      // Process balance history
      const processedHistory = balanceHistory.map((b: any) => ({
        timestamp: b.timestamp || '',
        blockNumber: parseInt(b.block_number) || 0,
        balanceFree: parseFloat(b.balance_free) / 1e9 || 0,
        balanceStaked: parseFloat(b.balance_staked) / 1e9 || 0,
        balanceTotal: parseFloat(b.balance_total) / 1e9 || 0
      }));
      
      // Calculate statistics
      const totalStaked: number = processedDelegations.reduce((sum: number, d: { balance: number }) => sum + d.balance, 0);
      const totalValidators = processedDelegations.length;
      
      // Estimate recent rewards if possible
      let recentRewards = 0;
      
      if (processedHistory.length >= 2) {
        // Compare most recent balance with the one from a day ago
        const latest = processedHistory[0];
        const previous = processedHistory[1]; // One day ago in the dataset
        
        if (latest && previous) {
          // Calculate only positive changes to isolate rewards
          const change = Math.max(0, latest.balanceTotal - previous.balanceTotal);
          if (change > 0) {
            recentRewards = change;
          }
        }
      }
      
      // Generate a human-readable summary
      let summary = `No delegation information found for coldkey ${coldkey}.`;
      
      if (processedDelegations.length > 0) {
        summary = `Account ${coldkey.substring(0, 10)}... has delegated a total of ${totalStaked.toLocaleString()} TAO to ${totalValidators} validator${totalValidators !== 1 ? 's' : ''}.`;
        
        if (processedDelegations.length > 0) {
          const topDelegation = processedDelegations[0];
          const validatorName = topDelegation.hotkeyName || topDelegation.hotkey.substring(0, 10) + '...';
          
          summary += ` Largest delegation: ${topDelegation.balance.toLocaleString()} TAO to validator ${validatorName}.`;
        }
        
        if (recentRewards > 0) {
          summary += ` Estimated daily rewards: ${recentRewards.toFixed(4)} TAO.`;
        }
        
        if (processedEvents.length > 0) {
          const latestEvent = processedEvents[0];
          const eventType = latestEvent.action?.toLowerCase() || "unknown";
          const eventTime = new Date(latestEvent.timestamp).toLocaleDateString();
          
          summary += ` Latest delegation activity: ${eventType} on ${eventTime}.`;
        }
        
        // Add balance information if available
        if (processedHistory.length > 0) {
          const latestBalance = processedHistory[0];
          summary += ` Current total balance: ${latestBalance.balanceTotal.toLocaleString()} TAO.`;
        }
      }
      
      return {
        delegations: processedDelegations,
        events: processedEvents,
        balanceHistory: processedHistory,
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
  
  /**
   * Get a descriptive name for subnet modality
   * 
   * @param modality Modality number from API
   * @returns Human-readable name for the modality
   */
  private getModalityName(modality: number): string {
    switch(modality) {
      case 0: return "Text Prompting";
      case 1: return "Text Prompting (α)";
      case 2: return "Image Generation";
      case 3: return "Text to Speech";
      case 4: return "Speech to Text";
      case 5: return "Code Generation";
      case 6: return "Multi-Modal";
      case 7: return "Distributed AI";
      default: return `Modality ${modality}`;
    }
  }
}