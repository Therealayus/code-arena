// Client-side mirror of the server payout rules (display only —
// the server is the source of truth, see GET /api/game/payout-rules).
// Multipliers are TOTAL GROSS returns, stake included:
// Rs 100 x 2.0 = Rs 200 gross; Rs 100 x 1.5 = Rs 150 gross.

export type ResultType = 'RED' | 'GREEN' | 'BLUE' | 'RED_BLUE' | 'GREEN_BLUE';

export const PAYOUT_RULES: Record<ResultType, number> = {
  RED: 2.0,
  GREEN: 2.0,
  BLUE: 2.0,
  RED_BLUE: 1.5,
  GREEN_BLUE: 1.5,
};

export const PLATFORM_FEE_PERCENT = 10;

export interface PayoutBreakdown {
  betAmount: number;
  multiplier: number;
  grossPayout: number;
  platformFee: number;
  netPayout: number;
}

export function calculatePayout(betAmount: number, result: string): PayoutBreakdown {
  const multiplier = PAYOUT_RULES[result as ResultType];
  if (multiplier === undefined) throw new Error(`Invalid result "${result}"`);
  const grossPayout = Math.floor(betAmount * multiplier);
  const platformFee = Math.floor((grossPayout * PLATFORM_FEE_PERCENT) / 100);
  return { betAmount, multiplier, grossPayout, platformFee, netPayout: grossPayout - platformFee };
}

export function formatMultiplier(m: number): string {
  return `${m.toFixed(1)}x`;
}
