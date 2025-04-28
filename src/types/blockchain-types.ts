/**
 * Interfaces for Taostats API responses
 */

export interface TaoPrice {
  currentPrice: {
    price: number;
    timestamp: string;
    priceChange24h: number;
    percentChange24h?: number;
    marketCap?: number;
    volume24h?: number;
    circulatingSupply?: number;
    maxSupply?: number;
  } | null;
  history: Array<{
    price: number;
    timestamp: string;
    priceChange24h?: number;
    priceChange7d?: number;
    priceChange30d?: number;
  }>;
  summary: string;
}

export interface SubnetInfo {
  info: any;
  history: any[];
  pool: any;
  summary: string;
  emission?: number;
  activeValidators?: number;
  activeMiners?: number;
  registrationAllowed?: boolean;
  registrationCost?: number;
  alphaPrice?: number;
}

export interface ValidatorInfo {
  info: any;
  history: any[];
  delegations: Array<{
    coldkey: string;
    balance: number;
    rank: number;
  }>;
  summary: string;
  stake: {
    total: number;
    selfStake: number;
    delegatedStake: number;
  };
  stats: {
    apr: number;
    nominators: number;
    rank: number;
    registrations: string[];
  };
}

export interface NetworkStats {
  raw: {
    stats: any;
    price: any;
  };
  summary: string;
  totalSupply?: number;
  totalStaked?: number;
  stakingRatio?: number;
  activeAccounts?: number;
  totalSubnets?: number;
  marketCap?: number;
}

export interface DelegatorInfo {
  delegations: Array<{
    hotkey: string;
    hotkeyName?: string;
    balance: number;
    rank: number;
    netuid: number;
  }>;
  events: Array<{
    id: string;
    action: string;
    amount: number;
    timestamp: string;
    blockNumber: number;
    delegate: string;
  }>;
  balanceHistory: Array<{
    timestamp: string;
    blockNumber: number;
    balanceFree: number;
    balanceStaked: number;
    balanceTotal: number;
  }>;
  summary: string;
  totalStaked: number;
  totalValidators: number;
  recentRewards: number;
}

export interface ValidatorList {
  validators: Array<{
    hotkey: string;
    coldkey: string;
    name: string;
    rank: number;
    stake: number;
    systemStake?: number;
    dominance?: number;
    nominators: number;
    nominators24hrChange?: number;
    apr: number;
    apr7DayAvg?: number;
    apr30DayAvg?: number;
    registrations: string[];
    permits?: string[];
    take?: number;
  }>;
  summary: string;
  totalCount: number;
  totalPages?: number;
  currentPage?: number;
}

/**
 * Interfaces for Masa API responses
 */

export interface TwitterSearchResult {
  results: Array<{
    ID?: number;
    ExternalID?: string;
    id?: string;
    text?: string;
    Content?: string;
    Metadata?: {
      author?: string;
      conversation_id?: string;
      created_at?: string;
      lang?: string;
      public_metrics?: {
        BookmarkCount?: number;
        ImpressionCount?: number;
        LikeCount?: number;
        QuoteCount?: number;
        ReplyCount?: number;
        RetweetCount?: number;
      };
      tweet_id?: number;
      user_id?: string;
      username?: string;
    };
    createdAt?: string;
    author?: {
      username?: string;
      displayName?: string;
    };
    metrics?: {
      likes?: number;
      retweets?: number;
      replies?: number;
    };
    Score?: number;
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