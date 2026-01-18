import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { emailQueue } from '../lib/queue';

const router = Router();

interface StatusCount {
  status: string;
  _count: number;
}

// Get statistics for a sender
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { senderId } = req.query;

    if (!senderId || typeof senderId !== 'string') {
      res.status(400).json({ error: 'senderId is required' });
      return;
    }

    // Get counts by status
    const stats = await prisma.emailJob.groupBy({
      by: ['status'],
      where: { senderId },
      _count: true,
    });

    // Get queue metrics
    const queueCounts = await emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

    // Get recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await prisma.emailJob.groupBy({
      by: ['status'],
      where: {
        senderId,
        createdAt: { gte: last24Hours },
      },
      _count: true,
    });

    res.json({
      statusCounts: stats.reduce((acc: Record<string, number>, stat: StatusCount) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
      queueMetrics: queueCounts,
      last24Hours: recentActivity.reduce((acc: Record<string, number>, stat: StatusCount) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
