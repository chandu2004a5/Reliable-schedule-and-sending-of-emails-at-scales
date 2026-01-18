import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

const syncUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().optional(),
});

// Get user by email
router.get('/:email', async (req: Request, res: Response): Promise<void> => {
  try {
    const email = req.params.email;
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Sync user from OAuth (called by NextAuth)
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = syncUserSchema.parse(req.body);

    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        image: data.image,
        emailVerified: new Date(),
      },
      create: {
        email: data.email,
        name: data.name,
        image: data.image,
        emailVerified: new Date(),
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

export default router;
