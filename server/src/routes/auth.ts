import { Router } from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/authController';
import { handleValidation } from '../middleware/validate';
import rateLimit from 'express-rate-limit';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post(
  '/register',
  authLimiter,
  body('name').isString().trim().isLength({ min: 2, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6, max: 100 }),
  body('referralCode').optional().isString().trim().isLength({ min: 3, max: 20 }),
  handleValidation,
  register
);

router.post(
  '/login',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
  handleValidation,
  login
);

export default router;
