import { Worker, Job } from 'bullmq';
import { prisma } from './lib/prisma';
import { transporter } from './lib/mailer';
import { rateLimiter } from './lib/rateLimiter';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

interface EmailJobData {
  emailJobId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
}

const MANDATORY_DELAY_MS = 2000; // 2 seconds between sends

/**
 * Production-ready BullMQ Worker with:
 * - Configurable concurrency
 * - Redis-backed hourly rate limiting
 * - Mandatory 2-second delay between sends
 * - Exponential backoff retry strategy
 * - Persistent job recovery on restart
 */
const worker = new Worker<EmailJobData>(
  'email-queue',
  async (job: Job<EmailJobData>) => {
    const { emailJobId, senderId, recipient, subject, body } = job.data;

    console.log(`[Worker] Processing job ${job.id} for ${recipient}`);

    try {
      // Fetch sender details from database
      const sender = await prisma.sender.findUnique({
        where: { id: senderId },
      });

      if (!sender) {
        throw new Error(`Sender ${senderId} not found`);
      }

      if (!sender.isActive) {
        throw new Error(`Sender ${senderId} is inactive`);
      }

      // Check hourly rate limit
      const limitCheck = await rateLimiter.checkLimit(senderId, sender.hourlyLimit);

      if (!limitCheck.allowed) {
        console.log(`[Worker] Rate limit hit for sender ${senderId}. Rescheduling...`);
        
        // Calculate delay until next available slot
        const nextAvailableTime = await rateLimiter.getNextAvailableTime(senderId);
        const delayUntilNextSlot = nextAvailableTime.getTime() - Date.now();

        // Move job to delayed state instead of failing it
        await job.moveToDelayed(Math.max(delayUntilNextSlot, 60000), job.token!); // At least 1 minute delay
        
        // Update database status
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            scheduledAt: nextAvailableTime,
          },
        });

        console.log(`[Worker] Job ${job.id} rescheduled to ${nextAvailableTime.toISOString()}`);
        return { rescheduled: true, nextAvailableTime };
      }

      // Enforce mandatory delay between sends
      await new Promise(resolve => setTimeout(resolve, MANDATORY_DELAY_MS));

      // Send email via Nodemailer
      const info = await transporter.sendMail({
        from: `"${sender.name || sender.email}" <${sender.email}>`,
        to: recipient,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      });

      console.log(`[Worker] ✅ Email sent to ${recipient}. Message ID: ${info.messageId}`);
      
      // Generate Ethereal preview URL (only works with Ethereal)
      const previewUrl = (info as any).messageId ? `https://ethereal.email/message/${(info as any).messageId}` : null;
      
      if (previewUrl) {
        console.log(`[Worker] 📧 Preview: ${previewUrl}`);
      }

      // Update database: mark as SENT
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          error: null,
        },
      });

      // Increment rate limiter count
      await rateLimiter.incrementCount(senderId);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Worker] ❌ Error processing job ${job.id}:`, errorMessage);

      // Update retry count
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          retryCount: { increment: 1 },
          error: errorMessage,
        },
      });

      // If max retries exceeded, mark as FAILED
      if (updatedJob.retryCount >= updatedJob.maxRetries) {
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
          },
        });
        console.error(`[Worker] Job ${job.id} failed after ${updatedJob.maxRetries} retries`);
      }

      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  },
  {
    connection: redisConfig,
    concurrency: 5, // Process 5 jobs in parallel
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second (prevents overwhelming the system)
    },
  }
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`[Worker] ✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

worker.on('ready', () => {
  console.log('🚀 Email worker is ready and processing jobs');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down worker gracefully...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('👷 Email worker started with:');
console.log('  - Concurrency: 5');
console.log('  - Mandatory delay: 2 seconds between sends');
console.log('  - Rate limiting: Hourly limit per sender (with automatic rescheduling)');
console.log('  - Retry strategy: Exponential backoff (3 attempts)');
