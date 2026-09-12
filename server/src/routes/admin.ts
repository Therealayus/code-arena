import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { getStats, listUsers, adjustBalance, listRounds, resetUserPassword, setUserBan, getSupportContact, updateSupportContact } from '../controllers/adminController';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.post(
  '/users/:id/balance',
  param('id').isMongoId(),
  body('amount').isInt({ min: -1000000, max: 1000000 }),
  body('reason').optional().isString().trim().isLength({ max: 200 }),
  handleValidation,
  adjustBalance
);
router.get('/rounds', listRounds);
router.post(
  '/users/:id/reset-password',
  param('id').isMongoId(),
  body('newPassword').isString().isLength({ min: 6, max: 100 }),
  handleValidation,
  resetUserPassword
);
router.post(
  '/users/:id/ban',
  param('id').isMongoId(),
  body('banned').isBoolean(),
  body('reason').optional().isString().trim().isLength({ max: 200 }),
  handleValidation,
  setUserBan
);
router.get('/support', getSupportContact);
router.post(
  '/support',
  body('telegram').isString().trim().isLength({ min: 2, max: 200 }),
  handleValidation,
  updateSupportContact
);

export default router;
