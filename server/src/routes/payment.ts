import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { paymentUpload } from '../middleware/upload';
import {
  getMyUpi,
  setMyUpi,
  getAdminUpi,
  setAdminUpi,
  createPaymentRequest,
  getMyPayments,
  listAllPayments,
  verifyPayment,
  getScreenshot,
} from '../controllers/paymentController';

const router = Router();

// Public: get admin UPI (for QR display) - no auth needed? But allow with or without
router.get('/admin-upi', async (req, res) => {
  // Allow guest to see admin UPI for payment
  const { User } = await import('../models/User');
  const admin = await User.findOne({ role: 'admin' }).select('upiId name').lean();
  res.json({ upiId: admin?.upiId || null, adminName: admin?.name || 'Color Arena' });
});

// User UPI
router.get('/my-upi', authMiddleware, getMyUpi);
router.post('/my-upi', authMiddleware, body('upiId').isString().trim().isLength({ min: 3, max: 100 }), handleValidation, setMyUpi);

// Admin UPI manage
router.get('/admin/manage-upi', authMiddleware, adminMiddleware, getAdminUpi);
router.post('/admin/manage-upi', authMiddleware, adminMiddleware, body('upiId').isString().trim().isLength({ min: 3, max: 100 }), handleValidation, setAdminUpi);

// Payment requests
router.post('/request', authMiddleware, paymentUpload.single('screenshot'), createPaymentRequest);
router.get('/my', authMiddleware, getMyPayments);

// Admin
router.get('/admin/list', authMiddleware, adminMiddleware, listAllPayments);
router.post('/admin/:id/verify', authMiddleware, adminMiddleware, param('id').isMongoId(), body('action').isIn(['approve', 'reject']), handleValidation, verifyPayment);

// Screenshot view (protected)
router.get('/screenshot/:filename', authMiddleware, getScreenshot);

export default router;
