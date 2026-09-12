import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { PaymentRequest } from '../models/PaymentRequest';
import { Transaction } from '../models/Transaction';
import { validateImageFile } from '../middleware/security';
import { REFERRAL_RULES } from '../config';
import { depositBonusFor } from '../services/bonus';
import path from 'path';
import fs from 'fs';

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export async function getMyUpi(req: AuthRequest, res: Response) {
  const user = await User.findById(req.userId).select('upiId').lean();
  res.json({ upiId: user?.upiId || null });
}

export async function setMyUpi(req: AuthRequest, res: Response) {
  const { upiId } = req.body;
  if (!upiId || typeof upiId !== 'string') return res.status(400).json({ error: 'UPI ID required' });
  const trimmed = upiId.trim().toLowerCase();
  if (!UPI_REGEX.test(trimmed)) return res.status(400).json({ error: 'Invalid UPI ID format (e.g., name@bank)' });
  await User.findByIdAndUpdate(req.userId, { upiId: trimmed });
  res.json({ upiId: trimmed });
}

export async function getAdminUpi(_req: AuthRequest, res: Response) {
  // Fetch admin's UPI (first admin)
  const admin = await User.findOne({ role: 'admin' }).select('upiId name').lean();
  res.json({ upiId: admin?.upiId || null, adminName: admin?.name || 'Color Arena' });
}

export async function setAdminUpi(req: AuthRequest, res: Response) {
  const { upiId } = req.body;
  if (!upiId || typeof upiId !== 'string') return res.status(400).json({ error: 'UPI ID required' });
  const trimmed = upiId.trim().toLowerCase();
  if (!UPI_REGEX.test(trimmed)) return res.status(400).json({ error: 'Invalid UPI ID format' });
  await User.findByIdAndUpdate(req.userId, { upiId: trimmed });
  res.json({ upiId: trimmed });
}

export async function createPaymentRequest(req: AuthRequest, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isBanned) return res.status(403).json({ error: `Account banned: ${user.banReason}` });

  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount < 100 || amount > 50000) {
    if (req.file) {
      const fs = await import('fs');
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(400).json({ error: 'Amount must be integer 100—50000' });
  }

  const agree = req.body.agreePolicy;
  if (agree !== 'true' && agree !== true) {
    if (req.file) {
      const fs = await import('fs');
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(400).json({ error: 'You must accept Policy & Terms' });
  }

  if (!req.file) return res.status(400).json({ error: 'Payment screenshot required (JPG/PNG/WEBP, max 2MB)' });

  // Deep image validation: header + script scan (2MB limit)
  const fileErr = await validateImageFile(req.file.path);
  if (fileErr) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: `Invalid image: ${fileErr}` });
  }

  // Check existing pending
  const pendingCount = await PaymentRequest.countDocuments({ userId: user._id, status: 'PENDING' });
  if (pendingCount >= 3) {
    const fs = await import('fs');
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'You have 3 pending requests. Wait for admin review.' });
  }

  const admin = await User.findOne({ role: 'admin' }).select('upiId').lean();
  if (!admin?.upiId) {
    const fs = await import('fs');
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Admin UPI not configured yet. Contact support.' });
  }

  const pr = await PaymentRequest.create({
    userId: user._id,
    amount,
    upiId: user.upiId || '',
    screenshotPath: req.file.filename,
    screenshotOriginalName: req.file.originalname,
    status: 'PENDING',
  });

  res.status(201).json({ payment: pr });
}

export async function getMyPayments(req: AuthRequest, res: Response) {
  const list = await PaymentRequest.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ items: list });
}

export async function listAllPayments(req: AuthRequest, res: Response) {
  const status = req.query.status as string;
  const filter: any = {};
  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) filter.status = status;
  const items = await PaymentRequest.find(filter)
    .populate('userId', 'name email upiId virtualBalance isBanned')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ items });
}

export async function verifyPayment(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { action, note, banUser } = req.body; // action: approve|reject

  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });

  if (action === 'approve') {
    // Atomic claim: only one admin/worker can approve a request.
    // Concurrent approves of the same request get null here -> 400 below.
    const pr: any = await PaymentRequest.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      { $set: { status: 'APPROVED', adminNote: note || 'Verified - coins credited', reviewedBy: req.userId, reviewedAt: new Date() } },
      { new: true }
    ).populate('userId');
    if (!pr) {
      const existing = await PaymentRequest.findById(id).lean();
      return res.status(400).json({ error: existing ? `Already ${existing.status}` : 'Payment not found' });
    }

    const user: any = pr.userId;
    // Recovery: this request was claimed AND credited before (crash between
    // claim and credit is the only gap, and credit below is audited).
    if (await Transaction.exists({ referenceId: pr._id, type: 'ADMIN_ADJUST' })) {
      return res.json({ payment: pr, newBalance: user.virtualBalance, depositBonus: { coins: 0, percent: 0 }, referrerRewardPaid: false, alreadyCredited: true });
    }

    // Deposit bonus tier for this amount (0 below the lowest tier).
    const { bonusCoins, bonusPercent } = depositBonusFor(pr.amount);

    // Is this the user's first approved top-up? (this one is already marked)
    const priorApproved = await PaymentRequest.countDocuments({
      userId: user._id,
      status: 'APPROVED',
      _id: { $ne: pr._id },
    });

    // Credit top-up amount + deposit bonus (single atomic increment).
    const credited = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { virtualBalance: pr.amount + bonusCoins } },
      { new: true }
    );
    if (!credited) return res.status(404).json({ error: 'User not found' });
    const before = credited.virtualBalance - pr.amount - bonusCoins;

    try {
      await Transaction.create({
        userId: user._id,
        type: 'ADMIN_ADJUST',
        amount: pr.amount,
        balanceBefore: before,
        balanceAfter: before + pr.amount,
        referenceId: pr._id,
        meta: { reason: 'Payment verified', amount: pr.amount, screenshot: pr.screenshotPath, adminId: req.userId },
      });

      if (bonusCoins > 0) {
        await Transaction.create({
          userId: user._id,
          type: 'BONUS',
          amount: bonusCoins,
          balanceBefore: before + pr.amount,
          balanceAfter: credited.virtualBalance,
          referenceId: pr._id,
          meta: { kind: 'deposit-bonus', topupAmount: pr.amount, bonusPercent },
        });
      }
    } catch (e: any) {
      // Duplicate key => a concurrent worker already wrote these entries.
      if (e?.code !== 11000) throw e;
      return res.json({ payment: pr, newBalance: credited.virtualBalance, depositBonus: { coins: 0, percent: 0 }, referrerRewardPaid: false, alreadyCredited: true });
    }

    // Referrer reward: exactly once per referred friend. The atomic flag
    // claim serializes concurrent first-top-up approvals; it also backfills
    // friends whose first top-up cleared before this feature existed.
    let referrerRewardPaid = false;
    if (priorApproved === 0 || !(user as any).referrerRewardPaid) {
      if (user.referredBy) {
        const claimed = await User.findOneAndUpdate(
          { _id: user._id, referrerRewardPaid: { $ne: true } },
          { $set: { referrerRewardPaid: true } },
          { new: true }
        );
        if (claimed) {
          const referrer = await User.findById(user.referredBy);
          if (referrer) {
            const reward = REFERRAL_RULES.referrerFirstTopupReward;
            const updated = await User.findOneAndUpdate({ _id: referrer._id }, { $inc: { virtualBalance: reward, referralEarned: reward } }, { new: true });
            if (updated) {
              try {
                await Transaction.create({
                  userId: referrer._id,
                  type: 'BONUS',
                  amount: reward,
                  balanceBefore: updated.virtualBalance - reward,
                  balanceAfter: updated.virtualBalance,
                  referenceId: pr._id,
                  meta: { kind: 'referrer-reward', referredUserId: user._id, topupAmount: pr.amount },
                });
                referrerRewardPaid = true;
              } catch (e: any) {
                if (e?.code !== 11000) throw e;
                referrerRewardPaid = true; // entry exists => reward was recorded
              }
            }
          }
        }
      }
    }

    return res.json({ payment: pr, newBalance: credited.virtualBalance, depositBonus: { coins: bonusCoins, percent: bonusPercent }, referrerRewardPaid });
  } else {
    // Reject — also claimed atomically so approve/reject can't interleave.
    const pr: any = await PaymentRequest.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      { $set: { status: 'REJECTED', adminNote: note || 'Rejected - screenshot/amount mismatch', reviewedBy: req.userId, reviewedAt: new Date() } },
      { new: true }
    );
    if (!pr) {
      const existing = await PaymentRequest.findById(id).lean();
      if (!existing) return res.status(404).json({ error: 'Payment not found' });
      return res.status(400).json({ error: `Already ${existing.status}` });
    }

    if (banUser) {
      const target = await User.findById(pr.userId);
      if (target) {
        target.isBanned = true;
        target.banReason = note || 'Tampered/wrong screenshot - banned per policy';
        await target.save();
      }
    }

    return res.json({ payment: pr, banned: !!banUser });
  }
}

export async function getScreenshot(req: AuthRequest, res: Response) {
  const { filename } = req.params;
  // Only admin or owner can view
  const pr = await PaymentRequest.findOne({ screenshotPath: filename });
  if (!pr) return res.status(404).json({ error: 'Not found' });
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && pr.userId.toString() !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const filePath = path.join(process.cwd(), 'uploads', 'payments', filename);
  return res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: 'File not found' });
  });
}
