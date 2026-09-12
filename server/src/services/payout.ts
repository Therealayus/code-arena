/**
 * Payout service — pure functions, no DB access.
 *
 * Business rules:
 *  - Multipliers in PAYOUT_RULES are TOTAL GROSS returns (stake included).
 *    e.g. Rs 100 x 2.0 = Rs 200 gross; Rs 100 x 1.5 = Rs 150 gross.
 *  - A fixed platform fee (PLATFORM_FEE_PERCENT) applies to EVERY win:
 *      gross = floor(betAmount * multiplier)
 *      fee   = floor(gross * feePercent / 100)
 *      net   = gross - fee
 *  - Result generation is independent: this module never looks at bet
 *    distribution, liability, or user identity. It only prices a result.
 *  - Combination results pay if the bet color is a member of the combo
 *    (RED_BLUE wins bets on RED or BLUE, at 1.5x).
 */

import { COMBO_MEMBERS, COMBO_RESULTS, PAYOUT_RULES, ResultType, config } from '../config';

export interface PayoutBreakdown {
  betAmount: number;
  result: ResultType;
  multiplier: number;
  grossPayout: number;
  platformFee: number;
  platformFeePercent: number;
  netPayout: number;
}

export function isValidResult(result: string): result is ResultType {
  return (Object.keys(PAYOUT_RULES) as string[]).includes(result);
}

/** Gross multiplier for a result. Throws on unknown/invalid results. */
export function getMultiplier(result: string): number {
  if (!isValidResult(result)) {
    throw Object.assign(
      new Error(`Invalid result "${result}". Allowed: ${(Object.keys(PAYOUT_RULES) as string[]).join(', ')}`),
      { status: 400 }
    );
  }
  return PAYOUT_RULES[result];
}

/** Colors whose bets win for a given result (single => itself, combo => members). */
export function getWinningColors(result: string): string[] {
  if ((COMBO_RESULTS as string[]).includes(result)) {
    return [...COMBO_MEMBERS[result as keyof typeof COMBO_MEMBERS]];
  }
  if ((Object.keys(PAYOUT_RULES) as string[]).includes(result)) {
    return [result];
  }
  throw Object.assign(new Error(`Invalid result "${result}"`), { status: 400 });
}

/** Does a bet on `betColor` win when `result` is declared? */
export function isWinningBet(betColor: string, result: string): boolean {
  return getWinningColors(result).includes(betColor);
}

/**
 * Price a winning bet. Amounts stay integers (coins/paise):
 * gross is floored, fee is floored, net = gross - fee.
 * Never mutates the multiplier after the result is known.
 */
export function calculatePayout(betAmount: number, result: string, feePercent = config.platformFeePercent): PayoutBreakdown {
  if (!Number.isInteger(betAmount) || betAmount <= 0) {
    throw Object.assign(new Error('Bet amount must be a positive integer'), { status: 400 });
  }
  if (typeof feePercent !== 'number' || Number.isNaN(feePercent) || feePercent < 0 || feePercent > 100) {
    throw Object.assign(new Error('Platform fee percent must be between 0 and 100'), { status: 400 });
  }
  const typedResult = result as ResultType;
  const multiplier = getMultiplier(typedResult);
  const grossPayout = Math.floor(betAmount * multiplier);
  const platformFee = Math.floor((grossPayout * feePercent) / 100);
  const netPayout = grossPayout - platformFee;
  return {
    betAmount,
    result: typedResult,
    multiplier,
    grossPayout,
    platformFee,
    platformFeePercent: feePercent,
    netPayout,
  };
}
