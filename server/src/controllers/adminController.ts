import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GameRound } from '../models/GameRound';
import { User } from '../models/User';
import { Bet } from '../models/Bet';
import { Transaction } from '../models/Transaction';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function getStats(_req: AuthRequest, res: Response) {
  const current = await GameRound.findOne({ status: { $in: ['BETTING_OPEN', 'BETTING_CLOSED', 'WAITING'] } }).sort({ roundNumber: -1 }).lean();
  const fallback = current || (await GameRound.findOne().sort({ roundNumber: -1 }).lean());

  // Exclude admin from user counts and coin totals per admin dashboard requirement
  const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
  const totalRounds = await GameRound.countDocuments();
  const totalBets = await Bet.countDocuments();
  const agg = await Bet.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
  const totalBetAmount = agg[0]?.total || 0;
  const coinAgg = await User.aggregate([
    { $match: { role: { $ne: 'admin' } } },
    { $group: { _id: null, total: { $sum: '$virtualBalance' } } },
  ]);
  const totalVirtualCoins = coinAgg[0]?.total || 0;

  const recentRounds = await GameRound.find().sort({ roundNumber: -1 }).limit(10).lean();

  const feeAgg = await Transaction.aggregate([
    { $match: { type: 'PLATFORM_FEE' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalPlatformFees = feeAgg[0]?.total || 0;

  res.json({
    currentRound: fallback,
    totalUsers,
    totalRounds,
    totalBets,
    totalBetAmount,
    totalVirtualCoins,
    totalPlatformFees,
    recentRounds,
  });
}

export async function listUsers(req: AuthRequest, res: Response) {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const skip = (page - 1) * limit;
  const filter = { role: { $ne: 'admin' } };
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-passwordHash').lean(),
    User.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function adjustBalance(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { amount, reason } = req.body;
  const delta = Number(amount);
  if (!Number.isInteger(delta) || delta === 0) return res.status(400).json({ error: 'Amount must be non-zero integer' });
  if (Math.abs(delta) > 1000000) return res.status(400).json({ error: 'Amount too large' });

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Atomic increment with a balance floor for debits: concurrent adjusts
  // can never lost-update or drive the balance negative.
  const updated = await User.findOneAndUpdate(
    delta < 0 ? { _id: id, virtualBalance: { $gte: -delta } } : { _id: id },
    { $inc: { virtualBalance: delta } },
    { new: true }
  );
  if (!updated) {
    const exists = await User.exists({ _id: id });
    if (!exists) return res.status(404).json({ error: 'User not found' });
    return res.status(400).json({ error: 'Would result in negative balance' });
  }

  const before = updated.virtualBalance - delta;

  await Transaction.create({
    userId: updated._id,
    type: 'ADMIN_ADJUST',
    amount: delta,
    balanceBefore: before,
    balanceAfter: updated.virtualBalance,
    meta: { reason: reason || 'Admin adjustment', adminId: req.userId },
  });

  res.json({ user: { id: updated._id, virtualBalance: updated.virtualBalance }, before, after: updated.virtualBalance });
}

export async function listRounds(req: AuthRequest, res: Response) {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    GameRound.find().sort({ roundNumber: -1 }).skip(skip).limit(limit).lean(),
    GameRound.countDocuments(),
  ]);
  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
}

function normalizeTelegram(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://t.me/${trimmed.replace(/^@/, '')}`;
}

// Reset any user's password (admin only, anytime).
export async function resetUserPassword(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
    return res.status(400).json({ error: 'New password must be 6—100 chars' });
  }
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin' && user._id.toString() !== req.userId) {
    return res.status(403).json({ error: 'Cannot reset another admin password' });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ ok: true, userId: user._id });
}

// Ban or unban any account (admin only, anytime).
export async function setUserBan(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { banned, reason } = req.body;
  if (typeof banned !== 'boolean') return res.status(400).json({ error: 'banned must be true/false' });
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Cannot ban an admin account' });
  user.isBanned = banned;
  user.banReason = banned ? (typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 200) : 'Banned by admin') : null;
  await user.save();
  res.json({ ok: true, userId: user._id, isBanned: user.isBanned, banReason: user.banReason });
}

// Support contact (Telegram) shown on the login page for password-reset help.
export async function getSupportContact(_req: AuthRequest, res: Response) {
  const admin = await User.findOne({ role: 'admin' }).select('supportTelegram').lean();
  res.json({ telegram: (admin as any)?.supportTelegram || null });
}

// Public version (no login needed) for the login page / footer.
export async function getPublicSupportContact(_req: any, res: Response) {
  const admin = await User.findOne({ role: 'admin' }).select('supportTelegram').lean();
  res.json({ telegram: (admin as any)?.supportTelegram || null });
}

export async function updateSupportContact(req: AuthRequest, res: Response) {
  const { telegram } = req.body;
  if (!telegram || typeof telegram !== 'string' || !telegram.trim()) {
    return res.status(400).json({ error: 'Telegram link or username required' });
  }
  const normalized = normalizeTelegram(telegram);
  if (normalized.length > 200) return res.status(400).json({ error: 'Too long' });
  const admin = await User.findById(req.userId);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  admin.supportTelegram = normalized;
  await admin.save();
  res.json({ telegram: normalized });
}
