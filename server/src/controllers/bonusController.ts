import { Response } from 'express';
import { config, DEPOSIT_BONUS_TIERS, REFERRAL_RULES } from '../config';

/** Public bonus/referral rules for the website's bonus section. */
export async function getBonusConfig(_req: any, res: Response) {
  res.json({
    signupBonus: config.initialBalance,
    depositTiers: DEPOSIT_BONUS_TIERS,
    referral: {
      refereeSignupBonus: REFERRAL_RULES.refereeSignupBonus,
      referrerFirstTopupReward: REFERRAL_RULES.referrerFirstTopupReward,
    },
  });
}
