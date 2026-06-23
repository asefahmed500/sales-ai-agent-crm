import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as chat from './chat.controller.js';

export const router = Router();

router.get('/agents', chat.listAgents);
router.post('/agent/chat', authMiddleware, chat.submitChat);
router.get('/agent/stream/:sessionId', chat.streamAgentTrajectory);
router.get('/agent/trajectory/:interactionId', authMiddleware, chat.getTrajectory);
router.get('/interactions/:contactId', authMiddleware, chat.getInteractions);
