/**
 * Interfaces for Taostats API responses
 */

export interface TaoPrice {
    currentPrice: {
      price: number;
      timestamp: number;
      priceChange24h: number;
      percentChange24h: number;
    } | null;
    history: Array<{
      price: number;
      timestamp: number;
      priceChange24h?: number;
      percentChange24h?: number;
    }>;
    summary: string;
  }
  
  export interface SubnetInfo {
    info: any;
    history: any[];
    pool: any;
    summary: string;
    emission?: number;
    registrations?: number;
    activeValidators?: number;
  }
  
  export interface ValidatorInfo {
    info: any;
    history: any[];
    delegations: any[];
    summary: string;
    stake: {
      total: number;
      selfStake: number;
      delegatedStake: number;
    };
    performance: {
      dailyEarnings?: number;
      weeklyEarnings?: number;
      monthlyEarnings?: number;
      uptimePercent?: number;
    };
  }
  
  export interface NetworkStats {
    stats: any;
    price: any;
    summary: string;
    totalSupply?: number;
    activeValidators?: number;
    totalSubnets?: number;
    marketCap?: number;
  }
  
  export interface DelegatorInfo {
    delegations: any[];
    events: any[];
    balanceHistory: any[];
    summary: string;
    totalStaked?: number;
    totalValidators?: number;
    recentRewards?: number;
  }
  
  export interface ValidatorList {
    validators: Array<{
      hotkey: string;
      name?: string;
      stake: number;
      delegations: number;
      rank: number;
      subnets: string[];
    }>;
    summary: string;
    totalCount: number;
  }
  
  /**
   * Interfaces for Masa API responses
   */
  
  export interface TwitterSearchResult {
    results: Array<{
      id: string;
      text: string;
      createdAt?: string;
      author?: {
        username: string;
        displayName?: string;
      };
      metrics?: {
        likes: number;
        retweets: number;
        replies: number;
      };
    }>;
    query: string;
    summary: string;
  }
  
  export interface WebScrapeResult {
    title: string;
    content: string;
    url: string;
    metadata: Record<string, any>;
    summary: string;
  }
  
  export interface SearchExtractionResult {
    searchTerm: string;
    thinking: string;
    additionalTerms?: string[];
    summary: string;
  }
  
  export interface TweetAnalysisResult {
    result: string;
    summary: string;
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  }
  
  export interface SimilaritySearchResult {
    results: Array<{
      id: string;
      text: string;
      similarity: number;
    }>;
    query: string;
    summary: string;
  }