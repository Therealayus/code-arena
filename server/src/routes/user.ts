import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { getProfile, getBalance, getTransactions, getReferralStats, getReferredFriends, changePassword } from '../controllers/userController';

const router = Router();

router.get('/profile', authMiddleware, getProfile);
router.get('/balance', authMiddleware, getBalance);
router.get('/transactions', authMiddleware, getTransactions);
router.get('/referral', authMiddleware, getReferralStats);
router.get('/referrals', authMiddleware, getReferredFriends);
router.post(
  '/change-password',
  authMiddleware,
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 6, max: 100 }),
  handleValidation,
  changePassword
);

export default router;
