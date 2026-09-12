import { Router } from 'express';
import { getBonusConfig } from '../controllers/bonusController';

const router = Router();

// Public — advertised on the website, no login needed.
router.get('/', getBonusConfig);

export default router;
