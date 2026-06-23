import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as pub from './public.controller.js';

export const router = Router();

router.get('/pipeline', authMiddleware, pub.getPipelineSummary);
router.get('/contacts', authMiddleware, pub.listContacts);
router.post('/contacts', authMiddleware, pub.createContact);
router.get('/companies', authMiddleware, pub.listCompanies);
router.get('/deals', authMiddleware, pub.listDeals);
router.get('/tickets', authMiddleware, pub.listTickets);
router.get('/outbox', authMiddleware, pub.listOutbox);
