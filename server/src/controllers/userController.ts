import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { ensureReferralCode } from '../services/referral';

export async function getProfile(req: AuthRequest, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const referralCode = await ensureReferralCode(user);
  res.json({ id: user._id, name: user.name, email: user.email, virtualBalance: user.virtualBalance, role: user.role, referralCode, createdAt: user.createdAt });
}

export async function getBalance(req: AuthRequest, res: Response) {
  const user = await User.findById(req.userId).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ balance: user.virtualBalance });
}

export async function getTransactions(req: AuthRequest, res: Response) {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Transaction.find({ userId: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments({ userId: req.userId }),
  ]);
  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function getReferralStats(req: AuthRequest, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const code = await ensureReferralCode(user);
  const referredCount = await User.countDocuments({ referredBy: user._id });
  res.json({ code, referredCount, referralEarned: user.referralEarned || 0 });
}

// Change own password while logged in (users and admins alike).
export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password required' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
    return res.status(400).json({ error: 'New password must be 6—100 chars' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different' });
  }
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ ok: true });
}

export async function getReferredFriends(req: AuthRequest, res: Response) {
  const friends = await User.find({ referredBy: req.userId }).select('name createdAt').sort({ createdAt: -1 }).limit(50).lean();
  const { PaymentRequest } = await import('../models/PaymentRequest');
  const items = await Promise.all(
    friends.map(async (f: any) => ({
      name: f.name,
      joinedAt: f.createdAt,
      toppedUp: (await PaymentRequest.countDocuments({ userId: f._id, status: 'APPROVED' })) > 0,
    }))
  );
  res.json({ items });
}
