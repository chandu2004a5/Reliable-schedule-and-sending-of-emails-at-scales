import { redisConnection } from './queue';

const RATE_LIMIT_KEY_PREFIX = 'rate_limit:sender:';

interface RateLimitResult {
  allowed: boolean;
  remainingSlots: number;
  resetAt: Date;
}

/**
 * Redis-backed hourly rate limiter for email sending
 * Uses a sliding window approach with Redis sorted sets
 */
export class RateLimiter {
  /**
   * Check if sender can send an email within their hourly limit
   * @param senderId - The sender's ID
   * @param hourlyLimit - Max emails allowed per hour
   * @returns Rate limit result with allowed status and metadata
   */
  async checkLimit(senderId: string, hourlyLimit: number): Promise<RateLimitResult> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${senderId}`;
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;

    // Remove entries older than 1 hour
    await redisConnection.zremrangebyscore(key, 0, oneHourAgo);

    // Count emails sent in the last hour
    const count = await redisConnection.zcard(key);

    const remainingSlots = Math.max(0, hourlyLimit - count);
    const allowed = count < hourlyLimit;

    // Calculate when the oldest entry will expire (when limit resets)
    let resetAt = new Date(now + 3600 * 1000); // Default to 1 hour from now
    
    if (count > 0) {
      const oldestTimestamp = await redisConnection.zrange(key, 0, 0, 'WITHSCORES');
      if (oldestTimestamp.length >= 2) {
        const oldestTime = parseInt(oldestTimestamp[1]);
        resetAt = new Date(oldestTime + 3600 * 1000);
      }
    }

    return {
      allowed,
      remainingSlots,
      resetAt,
    };
  }

  /**
   * Increment the send count for a sender
   * @param senderId - The sender's ID
   * @param timestamp - Optional timestamp (defaults to now)
   */
  async incrementCount(senderId: string, timestamp: number = Date.now()): Promise<void> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${senderId}`;
    
    // Add current send to sorted set with timestamp as score
    await redisConnection.zadd(key, timestamp, `${timestamp}`);
    
    // Set expiry to clean up old keys (2 hours to be safe)
    await redisConnection.expire(key, 7200);
  }

  /**
   * Get the next available send time for a sender who hit their limit
   * @param senderId - The sender's ID
   * @returns Next available timestamp
   */
  async getNextAvailableTime(senderId: string): Promise<Date> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${senderId}`;
    const oldestTimestamp = await redisConnection.zrange(key, 0, 0, 'WITHSCORES');
    
    if (oldestTimestamp.length >= 2) {
      const oldestTime = parseInt(oldestTimestamp[1]);
      // Next available time is 1 hour after the oldest entry
      return new Date(oldestTime + 3600 * 1000);
    }
    
    // If no entries, available now
    return new Date();
  }

  /**
   * Reset rate limit for a sender (useful for testing or manual overrides)
   * @param senderId - The sender's ID
   */
  async resetLimit(senderId: string): Promise<void> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${senderId}`;
    await redisConnection.del(key);
  }
}

export const rateLimiter = new RateLimiter();
