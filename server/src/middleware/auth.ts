import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const payload: any = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.id).lean();
    if (!user) return res.status(401).json({ error: 'User not found' });
    if ((user as any).isBanned) {
      return res.status(403).json({ error: `Account banned: ${(user as any).banReason || 'Policy violation'}` });
    }
    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
