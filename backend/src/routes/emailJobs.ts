import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';

const router = Router();

const scheduleEmailsSchema = z.object({
  senderId: z.string(),
  csvData: z.string(), // CSV string with columns: email, subject (optional), body (optional)
  defaultSubject: z.string().optional(),
  defaultBody: z.string().optional(),
  startTime: z.string().datetime(), // ISO 8601 datetime
  delaySeconds: z.number().int().min(1).default(2),
  hourlyLimit: z.number().int().min(1).default(50),
});

// Schedule multiple emails from CSV
router.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = scheduleEmailsSchema.parse(req.body);

    // Verify sender exists
    const sender = await prisma.sender.findUnique({
      where: { id: data.senderId },
    });

    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }

    // Update sender limits if provided
    if (data.hourlyLimit !== sender.hourlyLimit || data.delaySeconds !== sender.delaySeconds) {
      await prisma.sender.update({
        where: { id: data.senderId },
        data: {
          hourlyLimit: data.hourlyLimit,
          delaySeconds: data.delaySeconds,
        },
      });
    }

    // Parse CSV
    const records = parse(data.csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{ email: string; subject?: string; body?: string; [key: string]: string | undefined }>;

    if (records.length === 0) {
      res.status(400).json({ error: 'No valid records found in CSV' });
      return;
    }

    // Calculate scheduled times with delays
    const startTime = new Date(data.startTime);
    const emailJobs = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      if (!record.email) {
        continue; // Skip records without email
      }

      // Calculate scheduled time with delay
      const scheduledAt = new Date(startTime.getTime() + i * data.delaySeconds * 1000);

      emailJobs.push({
        senderId: data.senderId,
        recipient: record.email,
        subject: record.subject || data.defaultSubject || 'No Subject',
        body: record.body || data.defaultBody || '',
        scheduledAt,
        status: 'SCHEDULED' as const,
      });
    }

    // Create email jobs in database (batch insert)
    const createdJobs = await prisma.$transaction(
      emailJobs.map((job) => prisma.emailJob.create({ data: job }))
    );

    // Add jobs to BullMQ with delays (use database ID as job ID for idempotency)
    for (const job of createdJobs) {
      const delay = job.scheduledAt.getTime() - Date.now();
      
      await emailQueue.add(
        'send-email',
        {
          emailJobId: job.id,
          senderId: job.senderId,
          recipient: job.recipient,
          subject: job.subject,
          body: job.body,
        },
        {
          jobId: job.id, // Use database ID as BullMQ job ID for idempotency
          delay: Math.max(0, delay),
        }
      );
    }

    res.status(201).json({
      message: `Scheduled ${createdJobs.length} emails`,
      count: createdJobs.length,
      jobs: createdJobs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Error scheduling emails:', error);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

// Get email jobs for a sender
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { senderId, status } = req.query;

    if (!senderId || typeof senderId !== 'string') {
      res.status(400).json({ error: 'senderId is required' });
      return;
    }

    const where: { senderId: string; status?: 'PENDING' | 'SCHEDULED' | 'SENT' | 'FAILED' } = { senderId };
    
    if (status && typeof status === 'string') {
      const validStatuses = ['PENDING', 'SCHEDULED', 'SENT', 'FAILED'] as const;
      if (validStatuses.includes(status as typeof validStatuses[number])) {
        where.status = status as typeof validStatuses[number];
      }
    }

    const jobs = await prisma.emailJob.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: 100, // Limit to prevent large responses
    });

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching email jobs:', error);
    res.status(500).json({ error: 'Failed to fetch email jobs' });
  }
});

// Get a single email job
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const job = await prisma.emailJob.findUnique({
      where: { id },
      include: {
        sender: true,
      },
    });

    if (!job) {
      res.status(404).json({ error: 'Email job not found' });
      return;
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching email job:', error);
    res.status(500).json({ error: 'Failed to fetch email job' });
  }
});

// Cancel an email job
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const job = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!job) {
      res.status(404).json({ error: 'Email job not found' });
      return;
    }

    if (job.status === 'SENT') {
      res.status(400).json({ error: 'Cannot cancel a sent email' });
      return;
    }

    // Remove from queue
    await emailQueue.remove(id);

    // Update database
    await prisma.emailJob.update({
      where: { id },
      data: { status: 'FAILED', error: 'Cancelled by user' },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error cancelling email job:', error);
    res.status(500).json({ error: 'Failed to cancel email job' });
  }
});

export default router;
