import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { signToken } from '../utils/jwt';
import { config, REFERRAL_RULES } from '../config';
import { generateReferralCode } from '../services/bonus';
import { ensureReferralCode } from '../services/referral';

export async function register(req: Request, res: Response) {
  const { name, email, password, referralCode } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be >=6 chars' });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  // Optional referral: must be a real code owned by another user.
  let referrer: any = null;
  if (referralCode) {
    const normalized = String(referralCode).trim().toUpperCase();
    referrer = await User.findOne({ referralCode: normalized });
    if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Unique code for the new user (retry on rare collision).
  let myCode = generateReferralCode();
  for (let i = 0; i < 5 && (await User.exists({ referralCode: myCode })); i++) {
    myCode = generateReferralCode();
  }

  // Referred friends start with the signup bonus on top of the base balance.
  const signupBonus = referrer ? REFERRAL_RULES.refereeSignupBonus : 0;
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    virtualBalance: config.initialBalance + signupBonus,
    role: 'user',
    referralCode: myCode,
    referredBy: referrer ? referrer._id : null,
  });

  if (referrer) {
    await Transaction.create({
      userId: user._id,
      type: 'BONUS',
      amount: signupBonus,
      balanceBefore: config.initialBalance,
      balanceAfter: user.virtualBalance,
      meta: { kind: 'referral-signup', referrerId: referrer._id, referralCode: referrer.referralCode },
    });
    // Atomic: concurrent signups with the same code can't lost-update the count.
    await User.updateOne({ _id: referrer._id }, { $inc: { referralCount: 1 } });
  }

  // Make first user admin if matches admin email? Handled in seed.
  const token = signToken({ id: user._id, role: user.role });

  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, virtualBalance: user.virtualBalance, role: user.role, referralCode: user.referralCode },
    referralBonus: signupBonus,
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if ((user as any).isBanned) return res.status(403).json({ error: `Account banned: ${(user as any).banReason || 'Policy violation'}. Contact admin.` });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ id: user._id, role: user.role });
  const referralCode = await ensureReferralCode(user);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, virtualBalance: user.virtualBalance, role: user.role, referralCode },
  });
}
