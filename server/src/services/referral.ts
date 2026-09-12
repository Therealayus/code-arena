/**
 * Referral helpers (DB access). Pure code-gen lives in ./bonus.
 */
import { User } from '../models/User';
import { generateReferralCode } from './bonus';

/** Backfill a unique referral code for users created before referrals existed. */
export async function ensureReferralCode(user: any): Promise<string> {
  if (user.referralCode) return user.referralCode as string;
  for (let i = 0; i < 5; i++) {
    user.referralCode = generateReferralCode();
    try {
      await user.save();
      return user.referralCode as string;
    } catch (e: any) {
      if (e?.code === 11000) continue; // collision with another code, retry
      throw e;
    }
  }
  throw new Error('Could not generate unique referral code');
}
