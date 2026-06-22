import { Router } from 'express';
import { prisma } from '../core/database.js';
import { EventEmitter } from 'events';
import { runAgentPipeline } from '../services/agent_executor.js';
import { AGENTS } from '../agents.js';

export const router = Router();

// Event emitter mapping for SSE streaming per session/interaction
export const trajectoryEvents = new EventEmitter();

// Global notification event emitter for in-app alerts
export const notificationEvents = new EventEmitter();

// --- Agents registry ---
router.get('/agents', (_req, res) => {
  res.json(AGENTS);
});

// --- Pipeline summary ---
router.get('/pipeline', async (_req, res, next) => {
  try {
    const byStage = await prisma.contact.groupBy({ by: ['stage'], _count: true });
    const openDeals = await prisma.deal.aggregate({ where: { status: 'OPEN' }, _sum: { amount: true }, _count: true });
    const wonDeals = await prisma.deal.aggregate({ where: { status: 'WON' }, _sum: { amount: true }, _count: true });
    const contacts = await prisma.contact.count();
    res.json({
      contacts,
      byStage,
      open: { count: openDeals._count, value: openDeals._sum.amount || 0 },
      won: { count: wonDeals._count, value: wonDeals._sum.amount || 0 },
    });
  } catch (err) {
    next(err);
  }
});

// --- CRM Endpoints ---

// Contacts
router.get('/contacts', async (req, res, next) => {
  try {
    const contacts = await prisma.contact.findMany({
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

router.post('/contacts', async (req, res, next) => {
  try {
    const { name, email, phone, role, companyId, tenantId } = req.body;
    const contact = await prisma.contact.create({
      data: { name, email, phone, role, companyId, tenant: { connect: { id: tenantId } } } as any,
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

// Companies
router.get('/companies', async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    res.json(companies);
  } catch (err) {
    next(err);
  }
});

router.post('/companies', async (req, res, next) => {
  try {
    const { name, domain, industry, size, website, tenantId } = req.body;
    const company = await prisma.company.create({
      data: { name, domain, industry, size, website, tenant: { connect: { id: tenantId } } } as any,
    });
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
});

// Deals
router.get('/deals', async (req, res, next) => {
  try {
    const deals = await prisma.deal.findMany({
      include: { company: true, contact: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(deals);
  } catch (err) {
    next(err);
  }
});

router.post('/deals', async (req, res, next) => {
  try {
    const { name, amount, stage, companyId, contactId, tenantId } = req.body;
    const deal = await prisma.deal.create({
      data: { name, amount, stage, tenant: { connect: { id: tenantId } }, ...(companyId ? { company: { connect: { id: companyId } } } : {}), ...(contactId ? { contact: { connect: { id: contactId } } } : {}) } as any,
    });
    res.status(201).json(deal);
  } catch (err) {
    next(err);
  }
});

// Tickets
router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: { contact: true, company: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.post('/tickets', async (req, res, next) => {
  try {
    const { subject, description, priority, category, contactId, companyId, tenantId } = req.body;
    const ticket = await prisma.ticket.create({
      data: { subject, description, priority, category, contactId, companyId, tenant: { connect: { id: tenantId } } } as any,
    });
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

// --- SSE Notification Stream ---
router.get('/notifications/stream/:userId', (req, res) => {
  const { userId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  const handler = (event: any) => {
    if (event.userId === userId || !event.userId) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  notificationEvents.on('notification', handler);

  // Keep-alive every 30s
  const keepAlive = setInterval(() => res.write(':keepalive\n\n'), 30000);

  req.on('close', () => {
    notificationEvents.off('notification', handler);
    clearInterval(keepAlive);
    res.end();
  });
});

// --- Agent Orchestration & Real-time SSE ---

// SSE Stream Endpoint for Live Trajectory updates
router.get('/agent/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Encoding': 'none',
  });

  // Write initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Handler for forwarding events to this client
  const handleUpdate = (eventData: any) => {
    if (eventData.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    }
  };

  trajectoryEvents.on('update', handleUpdate);

  // Clean up on client disconnect
  req.on('close', () => {
    trajectoryEvents.off('update', handleUpdate);
    res.end();
  });
});

// Chat Endpoint: Submits a new message to the AI agent
router.post('/agent/chat', async (req, res, next) => {
  try {
    const { sessionId, contactId, message, channel, agent, tenantId } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required.' });
    }

    // Trigger agent execution asynchronously (so client doesn't wait for LLM completion)
    // Client will receive streaming updates over SSE, and can await the final message
    runAgentPipeline({
      sessionId,
      contactId,
      message,
      channel: channel || 'CHAT',
      agent,
      tenantId,
    }).catch((err) => {
      console.error('Agent execution failed asynchronously:', err);
    });

    res.json({ status: 'processing', sessionId });
  } catch (err) {
    next(err);
  }
});

// Fetch Trajectory Logs for history
router.get('/agent/trajectory/:interactionId', async (req, res, next) => {
  try {
    const { interactionId } = req.params;
    const logs = await prisma.agentTrajectory.findMany({
      where: { interactionId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// Fetch Interactions for a Contact
router.get('/interactions/:contactId', async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const interactions = await prisma.interaction.findMany({
      where: { contactId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(interactions);
  } catch (err) {
    next(err);
  }
});

// Fetch CRM Sync Outbox events
router.get('/outbox', async (req, res, next) => {
  try {
    const outbox = await prisma.crmOutbox.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(outbox);
  } catch (err) {
    next(err);
  }
});
