import { Router } from 'express';
import { getPublicSupportContact } from '../controllers/adminController';

const router = Router();

// Public — shown on the login page and footer so locked-out users
// can reach the admin on Telegram for a manual password reset.
router.get('/', getPublicSupportContact);

export default router;
