/**
 * Bonus & referral service — pure functions, no DB access.
 *
 * - Deposit tiers: highest qualifying tier wins, bonus = floor(amount * pct / 100).
 * - Referral codes: "ARENA-XXXXXX" (unambiguous alphabet, no 0/O/1/I).
 */

import { DEPOSIT_BONUS_TIERS, REFERRAL_RULES } from '../config';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(random: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return `${REFERRAL_RULES.codePrefix}-${suffix}`;
}

export function isValidReferralCodeFormat(code: string): boolean {
  return new RegExp(`^${REFERRAL_RULES.codePrefix}-[${CODE_ALPHABET}]{6}$`).test(code);
}

/** Bonus coins for an approved top-up amount (0 when below the lowest tier). */
export function depositBonusFor(amount: number): { bonusCoins: number; bonusPercent: number } {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw Object.assign(new Error('Amount must be a positive integer'), { status: 400 });
  }
  const tier = DEPOSIT_BONUS_TIERS.find((t) => amount >= t.minAmount);
  if (!tier) return { bonusCoins: 0, bonusPercent: 0 };
  return { bonusCoins: Math.floor((amount * tier.bonusPercent) / 100), bonusPercent: tier.bonusPercent };
}
