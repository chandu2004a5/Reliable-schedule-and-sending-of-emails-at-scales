import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

const createSenderSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  hourlyLimit: z.number().int().min(1).max(1000).default(50),
  delaySeconds: z.number().int().min(1).max(60).default(2),
});

// Get all senders for a user
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(senders);
  } catch (error) {
    console.error('Error fetching senders:', error);
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

// Get a single sender
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sender = await prisma.sender.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            emailJobs: true,
          },
        },
      },
    });

    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }

    res.json(sender);
  } catch (error) {
    console.error('Error fetching sender:', error);
    res.status(500).json({ error: 'Failed to fetch sender' });
  }
});

// Create a new sender
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createSenderSchema.parse(req.body);

    const sender = await prisma.sender.create({
      data,
    });

    res.status(201).json(sender);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Error creating sender:', error);
    res.status(500).json({ error: 'Failed to create sender' });
  }
});

// Update a sender
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateSchema = createSenderSchema.partial().omit({ userId: true });
    const data = updateSchema.parse(req.body);

    const sender = await prisma.sender.update({
      where: { id },
      data,
    });

    res.json(sender);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Error updating sender:', error);
    res.status(500).json({ error: 'Failed to update sender' });
  }
});

// Delete a sender
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.sender.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting sender:', error);
    res.status(500).json({ error: 'Failed to delete sender' });
  }
});

export default router;
