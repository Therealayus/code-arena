// Client-side mirror of server bonus rules (display only).
// Server is the source of truth: GET /api/bonuses.

export interface DepositTier {
  minAmount: number;
  bonusPercent: number;
}

export const DEPOSIT_BONUS_TIERS: DepositTier[] = [
  { minAmount: 5000, bonusPercent: 15 },
  { minAmount: 2000, bonusPercent: 10 },
  { minAmount: 500, bonusPercent: 5 },
];

export const REFERRAL_RULES = {
  refereeSignupBonus: 500,
  referrerFirstTopupReward: 1000,
};

export function depositBonusFor(amount: number): { bonusCoins: number; bonusPercent: number } {
  const tier = DEPOSIT_BONUS_TIERS.find((t) => amount >= t.minAmount);
  if (!tier) return { bonusCoins: 0, bonusPercent: 0 };
  return { bonusCoins: Math.floor((amount * tier.bonusPercent) / 100), bonusPercent: tier.bonusPercent };
}
