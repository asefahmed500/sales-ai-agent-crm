import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import * as crm from './crm.controller.js';

export const router = Router();
router.use(authMiddleware, requireRole('OWNER'));

router.get('/dashboard', crm.getDashboard);
router.get('/pipeline', crm.getPipelineKanban);

router.get('/contacts', crm.listContacts);
router.post('/contacts', crm.createContact);
router.get('/contacts/:id', crm.getContact);
router.put('/contacts/:id', crm.updateContact);
router.delete('/contacts/:id', crm.deleteContact);

router.get('/companies', crm.listCompanies);
router.post('/companies', crm.createCompany);
router.get('/companies/:id', crm.getCompany);
router.put('/companies/:id', crm.updateCompany);
router.delete('/companies/:id', crm.deleteCompany);

router.get('/deals', crm.listDeals);
router.post('/deals', crm.createDeal);
router.get('/deals/:id', crm.getDeal);
router.put('/deals/:id', crm.updateDeal);
router.delete('/deals/:id', crm.deleteDeal);

router.get('/deals/:id/comments', crm.getDealComments);
router.post('/deals/:id/comments', crm.addDealComment);

router.get('/tickets', crm.listTickets);
router.post('/tickets', crm.createTicket);
router.get('/tickets/:id', crm.getTicket);
router.put('/tickets/:id', crm.updateTicket);

router.get('/users', crm.listUsers);
router.post('/users', crm.createUser);
router.put('/users/:id', crm.updateUser);
router.delete('/users/:id', crm.deleteUser);

router.get('/agent-tasks', crm.listAgentTasks);
router.post('/agent-tasks', crm.createAgentTask);
router.put('/agent-tasks/:id', crm.updateAgentTask);

router.post('/notifications/send', crm.sendNotification);

router.get('/conversations', crm.listConversations);
router.get('/conversations/:contactId/messages', crm.getConversationMessages);
router.post('/conversations/:contactId/messages', crm.sendMessage);
router.post('/conversations/:contactId/close', crm.closeConversation);
router.post('/conversations/:contactId/reopen', crm.reopenConversation);

router.get('/onboarding-links', crm.listOnboardingLinks);
