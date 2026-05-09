import { Router, Response } from 'express';
import { z } from 'zod';
import { Liability } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

const liabilitySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['mortgage', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'other']),
  balance: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  interestRate: z.number().min(0).max(1).optional(),
  minimumPayment: z.number().min(0).optional(),
  dueDate: z.number().min(1).max(31).optional(),
});

// GET /api/liabilities
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const liabilities = await Liability.find({ userId: req.user!.id }).sort({ balance: -1 });
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    res.json({ liabilities, totalLiabilities });
  } catch {
    res.status(500).json({ error: 'Failed to fetch liabilities' });
  }
});

// POST /api/liabilities
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = liabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const liability = await Liability.create({
      ...parsed.data,
      userId: req.user!.id,
      lastUpdated: new Date(),
    });
    res.status(201).json({ liability });
  } catch {
    res.status(500).json({ error: 'Failed to create liability' });
  }
});

// PATCH /api/liabilities/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const liability = await Liability.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    );
    if (!liability) return res.status(404).json({ error: 'Liability not found' });
    res.json({ liability });
  } catch {
    res.status(500).json({ error: 'Failed to update liability' });
  }
});

// DELETE /api/liabilities/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const liability = await Liability.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!liability) return res.status(404).json({ error: 'Liability not found' });
    res.json({ message: 'Liability deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete liability' });
  }
});

export default router;
