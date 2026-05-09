import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Snapshot, Asset, Liability } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { buildSnapshot } from '../jobs/dailySnapshot';

const router = Router();
router.use(authenticate);

// GET /api/snapshots?range=30d|90d|1y|all
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const range = (req.query.range as string) || '90d';
    let startDate: Date | null = null;

    if (range === '30d') startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    else if (range === '90d') startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    else if (range === '1y') startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const query: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(req.user!.id) };
    if (startDate) query.date = { $gte: startDate };

    const snapshots = await Snapshot.find(query).sort({ date: 1 }).lean();
    res.json({ snapshots });
  } catch {
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// GET /api/snapshots/latest — current net worth
router.get('/latest', async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await Snapshot.findOne({ userId: req.user!.id }).sort({ date: -1 }).lean();
    res.json({ snapshot });
  } catch {
    res.status(500).json({ error: 'Failed to fetch latest snapshot' });
  }
});

// POST /api/snapshots/refresh — manually trigger a snapshot (useful on first load)
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await buildSnapshot(req.user!.id);
    res.json({ snapshot });
  } catch {
    res.status(500).json({ error: 'Failed to build snapshot' });
  }
});

export default router;
