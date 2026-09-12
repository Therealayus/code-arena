import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { COLORS } from '../config';
import {
  getCurrentRound,
  getHistory,
  getPayoutRules,
  getRoundById,
  getRoundBets,
  getRoundResult,
  placeBet,
} from '../controllers/gameController';
import rateLimit from 'express-rate-limit';

const router = Router();

const betLimiter = rateLimit({ windowMs: 10 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.get('/current', getCurrentRound);
router.get('/history', getHistory);
router.get('/payout-rules', getPayoutRules);
router.get('/:roundId', param('roundId').isMongoId(), handleValidation, getRoundById);
router.get('/:roundId/result', param('roundId').isMongoId(), handleValidation, getRoundResult);
router.get('/:roundId/bets', authMiddleware, param('roundId').isMongoId(), handleValidation, getRoundBets);

router.post(
  '/:roundId/bet',
  authMiddleware,
  betLimiter,
  param('roundId').isMongoId(),
  body('color').isIn(COLORS as unknown as string[]),
  body('amount').isInt({ min: 1, max: 100000 }),
  handleValidation,
  placeBet
);

export default router;
