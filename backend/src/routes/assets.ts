import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Asset } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { convertToUSD } from '../services/exchangeRate';

const router = Router();
router.use(authenticate);

const assetSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['bank', 'investment', 'crypto', 'real_estate', 'vehicle', 'other']),
  value: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  source: z.enum(['plaid', 'coingecko', 'attom', 'manual']),
  coinGeckoId: z.string().optional(),
  address: z.string().optional(),
  quantity: z.number().optional(),
});

// GET /api/assets — all assets for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const assets = await Asset.find({ userId: req.user!.id }).sort({ value: -1 });
    res.json({ assets });
  } catch {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/assets/summary — totals by type
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Asset.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user!.id) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$value' },
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown: Record<string, number> = {};
    let totalAssets = 0;
    for (const r of result) {
      breakdown[r._id] = r.total;
      totalAssets += r.total;
    }

    res.json({ totalAssets, breakdown });
  } catch {
    res.status(500).json({ error: 'Failed to fetch asset summary' });
  }
});

// POST /api/assets — create manual asset
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    let { value, currency } = parsed.data;

    // Normalize to USD if needed
    if (currency !== 'USD') {
      value = await convertToUSD(value, currency);
      currency = 'USD';
    }

    const asset = await Asset.create({
      ...parsed.data,
      value,
      currency,
      userId: req.user!.id,
      lastUpdated: new Date(),
    });

    res.status(201).json({ asset });
  } catch {
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PATCH /api/assets/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset });
  } catch {
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const asset = await Asset.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ message: 'Asset deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

export default router;
