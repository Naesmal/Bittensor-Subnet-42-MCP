import { logger } from "./logger.js";

/**
 * Implements a token bucket rate limiter
 */
export class RateLimiter {
  private name: string;
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefillTimestamp: number;
  private waitingQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Create a new rate limiter
   * 
   * @param name Name of the rate limiter (for logging)
   * @param tokensPerPeriod Number of tokens per period
   * @param periodSeconds Duration of period in seconds
   */
  constructor(name: string, tokensPerPeriod: number, periodSeconds: number) {
    this.name = name;
    this.maxTokens = tokensPerPeriod;
    this.tokens = tokensPerPeriod;
    this.refillRate = tokensPerPeriod / periodSeconds;
    this.lastRefillTimestamp = Date.now();
    
    logger.info(`Initialized rate limiter for ${name}: ${tokensPerPeriod} requests per ${periodSeconds} seconds`);
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTimestamp;
    
    if (elapsedMs > 0) {
      const newTokens = elapsedMs * this.refillRate / 1000;
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefillTimestamp = now;
    }
  }
  
  /**
   * Acquire a token, waiting if necessary
   * 
   * @returns Promise that resolves when a token is acquired
   */
  public async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      // Token available, consume it immediately
      this.tokens -= 1;
      logger.debug(`[${this.name}] Token acquired, ${this.tokens.toFixed(2)} remaining`);
      return;
    }
    
    // Calculate wait time in ms
    const tokensNeeded = 1 - this.tokens;
    const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;
    
    logger.info(`[${this.name}] Rate limit reached. Waiting ${Math.ceil(waitTimeMs)}ms for token`);
    
    // Wait for a token to become available
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.refill();
        this.tokens -= 1;
        resolve();
        
        // Process next in queue if any
        if (this.waitingQueue.length > 0) {
          const next = this.waitingQueue.shift();
          if (next) {
            next.resolve();
          }
        }
      }, waitTimeMs);
      
      // Add ability to cancel if needed
      this.waitingQueue.push({
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }
  
  /**
   * Cancel all waiting operations
   * 
   * @param error Error to reject with
   */
  public cancelAll(error: Error): void {
    const queue = this.waitingQueue.splice(0, this.waitingQueue.length);
    
    for (const item of queue) {
      item.reject(error);
    }
    
    logger.warn(`[${this.name}] Cancelled ${queue.length} waiting operations`);
  }
}