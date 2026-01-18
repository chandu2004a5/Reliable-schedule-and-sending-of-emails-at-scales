import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// Create separate Redis instances for Queue and other uses
export const redisConnection = new Redis(redisConfig);

export const emailQueue = new Queue('email-queue', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
    removeOnComplete: {
      age: 3600 * 24, // Keep for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 3600 * 24 * 7, // Keep for 7 days
    },
  },
});
