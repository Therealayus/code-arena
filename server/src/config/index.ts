import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/color-arena',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me_32_chars_min!',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bettingDurationMs: parseInt(process.env.BETTING_DURATION_MS || '60000', 10),
  resultRevealMs: parseInt(process.env.RESULT_REVEAL_DURATION_MS || '8000', 10),
  payoutMultiplier: parseFloat(process.env.PAYOUT_MULTIPLIER || '4.5'),
  // Fixed platform fee (%) applied to EVERY winning payout. Centralized/configurable.
  platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '10'),
  // No free starting coins: users play only after recharging (referral signup bonus still applies).
  initialBalance: parseInt(process.env.INITIAL_BALANCE || '0', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@colorarena.demo',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!',
};

export const COLORS = ['RED', 'GREEN', 'BLUE'] as const;
export type Color = typeof COLORS[number];

export const COLOR_META: Record<Color, { emoji: string; bg: string; hex: string }> = {
  RED: { emoji: '🔴', bg: 'bg-red-500', hex: '#ef4444' },
  GREEN: { emoji: '🟢', bg: 'bg-green-500', hex: '#22c55e' },
  BLUE: { emoji: '🔵', bg: 'bg-blue-500', hex: '#3b82f6' },
};

// Tie-break priority: lower index wins. Deterministic & documented.
export const COLOR_PRIORITY: Color[] = ['RED', 'GREEN', 'BLUE'];

// ---------------------------------------------------------------------------
// Fixed payout rules (gross return = stake INCLUDED).
//
// A single-color win pays 2.0x gross; a combination win pays 1.5x gross.
// RED_GREEN is intentionally NOT offered.
// ---------------------------------------------------------------------------
export type SingleResult = Color;
export type ComboResult = 'RED_BLUE' | 'GREEN_BLUE';
export type ResultType = SingleResult | ComboResult;

export const COMBO_RESULTS: ComboResult[] = ['RED_BLUE', 'GREEN_BLUE'];

export const COMBO_MEMBERS: Record<ComboResult, Color[]> = {
  RED_BLUE: ['RED', 'BLUE'],
  GREEN_BLUE: ['GREEN', 'BLUE'],
};

export const PAYOUT_RULES: Record<ResultType, number> = {
  RED: 2.0,
  GREEN: 2.0,
  BLUE: 2.0,
  RED_BLUE: 1.5,
  GREEN_BLUE: 1.5,
};

export const RESULT_TYPES = [...COLORS, ...COMBO_RESULTS] as ResultType[];

// ---------------------------------------------------------------------------
// Bonuses & referrals (all centralized here).
//
// Deposit bonus tiers: top-ups at/above a threshold earn extra bonus coins
// as a percentage of the approved amount. Highest qualifying tier wins.
//   e.g. approve Rs 2000 => +10% => +200 bonus coins (on top of the 2000).
// Referral: every user owns a code. A newcomer signing up with a code gets
// REFEREE_SIGNUP_BONUS instantly; the referrer gets REFERRER_TOPUP_REWARD
// once when the newcomer's FIRST top-up is approved (anti-fake-account).
// ---------------------------------------------------------------------------
export interface DepositBonusTier {
  minAmount: number;
  bonusPercent: number;
}

export const DEPOSIT_BONUS_TIERS: DepositBonusTier[] = [
  { minAmount: 5000, bonusPercent: 15 },
  { minAmount: 2000, bonusPercent: 10 },
  { minAmount: 500, bonusPercent: 5 },
];

export const REFERRAL_RULES = {
  refereeSignupBonus: 500,
  referrerFirstTopupReward: 1000,
  codePrefix: 'ARENA',
};
