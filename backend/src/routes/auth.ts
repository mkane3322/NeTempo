import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();

const SALT_ROUNDS = 12;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

function signToken(id: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ id, email }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(50).optional(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { email, password, displayName } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email, passwordHash, displayName });

    const token = signToken(user._id.toString(), user.email);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        currency: user.currency,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      // Constant-time response to prevent email enumeration
      await bcrypt.hash('dummy', SALT_ROUNDS);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user._id.toString(), user.email);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        currency: user.currency,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash -plaidAccessTokens');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/auth/me — update profile
router.patch('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, currency } = req.body;
    const updates: Record<string, string> = {};
    if (displayName) updates.displayName = displayName;
    if (currency) updates.currency = currency;

    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true }).select(
      '-passwordHash -plaidAccessTokens'
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
