import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Accept token from httpOnly cookie OR Authorization header (for API clients)
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const decoded = jwt.verify(token, secret) as { id: string; email: string };

    // Verify user still exists
    const user = await User.findById(decoded.id).select('_id email');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}
