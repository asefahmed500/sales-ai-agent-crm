import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as auth from './auth.controller.js';

export const router = Router();

router.post('/login', auth.login);
router.post('/register', auth.register);
router.get('/me', authMiddleware, auth.me);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
