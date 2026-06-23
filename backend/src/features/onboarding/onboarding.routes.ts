import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import * as onboarding from './onboarding.controller.js';

export const router = Router();

router.post('/generate', authMiddleware, requireRole('OWNER'), onboarding.generateLink);
router.get('/verify/:token', onboarding.verifyToken);
router.post('/complete/:token', onboarding.completeOnboarding);
