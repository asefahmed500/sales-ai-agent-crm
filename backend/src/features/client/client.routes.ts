import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import * as client from './client.controller.js';

export const router = Router();
router.use(authMiddleware, requireRole('CLIENT'));

router.get('/me', client.getProfile);
router.get('/deals', client.listDeals);
router.post('/deals', client.createDeal);
router.get('/deals/:id/comments', client.getDealComments);
router.post('/deals/:id/comments', client.addDealComment);
router.get('/tickets', client.listTickets);
router.post('/tickets', client.createTicket);
router.get('/interactions', client.listInteractions);
router.get('/conversation/messages', client.getConversationMessages);
router.post('/conversation/messages', client.sendMessage);
router.post('/conversation/close', client.closeConversation);
router.post('/conversation/reopen', client.reopenConversation);
router.put('/profile', client.updateProfile);
