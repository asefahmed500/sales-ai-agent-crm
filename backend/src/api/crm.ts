import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../core/database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { notificationEvents } from './endpoints.js';

function notify(userId: string, type: string, title: string, message: string, link?: string) {
  notificationEvents.emit('notification', { userId, type, title, message, link, createdAt: new Date().toISOString() });
}

export const router = Router();
router.use(authMiddleware, requireRole('OWNER'));

// --- Dashboard Stats ---
router.get('/dashboard', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const [totalContacts, totalCompanies, totalDeals, totalTickets] = await Promise.all([
      prisma.contact.count({ where: { tenantId } }),
      prisma.company.count({ where: { tenantId } }),
      prisma.deal.count({ where: { tenantId } }),
      prisma.ticket.count({ where: { tenantId } }),
    ]);
    const openDeals = await prisma.deal.aggregate({ where: { tenantId, status: 'OPEN' }, _sum: { amount: true }, _count: true });
    const wonDeals = await prisma.deal.aggregate({ where: { tenantId, status: 'WON' }, _sum: { amount: true }, _count: true });
    const byStage = await prisma.contact.groupBy({ by: ['stage'], where: { tenantId }, _count: true });
    const byDealStage = await prisma.deal.groupBy({ by: ['stage'], where: { tenantId }, _count: true, _sum: { amount: true } });
    const recentContacts = await prisma.contact.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5, include: { company: true } });
    const recentDeals = await prisma.deal.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, take: 5, include: { company: true, contact: true } });
    res.json({
      totalContacts, totalCompanies, totalDeals, totalTickets,
      openDealsValue: openDeals._sum.amount || 0,
      openDealsCount: openDeals._count,
      wonDealsValue: wonDeals._sum.amount || 0,
      wonDealsCount: wonDeals._count,
      contactsByStage: byStage,
      dealsByStage: byDealStage,
      recentContacts, recentDeals,
    });
  } catch (err) { next(err); }
});

// --- Contacts ---
router.get('/contacts', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '20', search, stage, status } = req.query;
    const where: any = { tenantId };
    if (search) where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ];
    if (stage) where.stage = stage;
    if (status) where.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({ where, include: { company: true }, skip, take: Number(limit), orderBy: { updatedAt: 'desc' } }),
      prisma.contact.count({ where }),
    ]);
    res.json({ items: contacts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
});

router.post('/contacts', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, email, phone, role, stage, companyId, source, tags } = req.body;
    const contact = await prisma.contact.create({
      data: { name, email, phone, role, stage, companyId, source, tags, tenant: { connect: { id: tenantId } } },
    });
    notify(req.user!.id, 'contact_created', 'New Contact', `${name} was added to CRM`);
    res.status(201).json(contact);
  } catch (err) { next(err); }
});

router.get('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, tenantId }, include: { company: true } });
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json(contact);
  } catch (err) { next(err); }
});

router.put('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const contact = await prisma.contact.update({ where: { id: req.params.id }, data: req.body });
    res.json(contact);
  } catch (err) { next(err); }
});

router.delete('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Companies ---
router.get('/companies', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '20', search } = req.query;
    const where: any = { tenantId };
    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    const skip = (Number(page) - 1) * Number(limit);
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where, skip, take: Number(limit), orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { contacts: true, deals: true } } },
      }),
      prisma.company.count({ where }),
    ]);
    res.json({ items: companies, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
});

router.post('/companies', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, domain, industry, size, website, score, tags } = req.body;
    const company = await prisma.company.create({
      data: { name, domain, industry, size, website, score, tags, tenant: { connect: { id: tenantId } } },
    });
    res.status(201).json(company);
  } catch (err) { next(err); }
});

router.get('/companies/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const company = await prisma.company.findFirst({
      where: { id: req.params.id, tenantId },
      include: { _count: { select: { contacts: true, deals: true, tickets: true } } },
    });
    if (!company) return res.status(404).json({ error: 'Not found' });
    res.json(company);
  } catch (err) { next(err); }
});

router.put('/companies/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.company.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const company = await prisma.company.update({ where: { id: req.params.id }, data: req.body });
    res.json(company);
  } catch (err) { next(err); }
});

router.delete('/companies/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.company.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Deals ---
router.get('/deals', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '20', search, stage, status } = req.query;
    const where: any = { tenantId };
    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    if (stage) where.stage = stage;
    if (status) where.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [deals, total] = await Promise.all([
      prisma.deal.findMany({ where, include: { company: true, contact: true }, skip, take: Number(limit), orderBy: { updatedAt: 'desc' } }),
      prisma.deal.count({ where }),
    ]);
    res.json({ items: deals, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
});

router.post('/deals', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, amount, stage, companyId, contactId, status, notes } = req.body;
    const dealData: any = { name, amount, stage, tenant: { connect: { id: tenantId } } };
    if (status) dealData.status = status;
    if (notes) dealData.notes = notes;
    if (companyId) dealData.company = { connect: { id: companyId } };
    if (contactId) dealData.contact = { connect: { id: contactId } };
    const deal = await prisma.deal.create({ data: dealData });
    notify(req.user!.id, 'deal_created', 'New Deal', `${name} worth $${amount} created`);
    res.status(201).json(deal);
  } catch (err) { next(err); }
});

router.get('/deals/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId }, include: { company: true, contact: true } });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    res.json(deal);
  } catch (err) { next(err); }
});

router.put('/deals/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const deal = await prisma.deal.update({ where: { id: req.params.id }, data: req.body });
    res.json(deal);
  } catch (err) { next(err); }
});

router.delete('/deals/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Pipeline (Kanban-ready grouped by stage) ---
router.get('/pipeline', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const stages = ['PROSPECT', 'QUALIFIED', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
    const deals = await prisma.deal.findMany({
      where: { tenantId, status: { not: 'LOST' } },
      include: { company: true, contact: true },
      orderBy: { updatedAt: 'desc' },
    });
    const grouped = stages.reduce((acc, stage) => {
      acc[stage] = deals.filter(d => d.stage === stage);
      return acc;
    }, {} as Record<string, any[]>);
    res.json(grouped);
  } catch (err) { next(err); }
});

// Get comments/interactions for a deal
router.get('/deals/:id/comments', async (req, res, next) => {
  try {
    const interactions = await prisma.interaction.findMany({
      where: { dealId: req.params.id, channel: 'DEAL_FEEDBACK' },
      orderBy: { createdAt: 'asc' },
    });
    res.json(interactions);
  } catch (err) { next(err); }
});

// Admin adds comment on a deal (notifies client)
router.post('/deals/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const interaction = await prisma.interaction.create({
      data: { channel: 'DEAL_FEEDBACK', direction: 'OUTBOUND', content, tenant: { connect: { id: tenantId } }, deal: { connect: { id: req.params.id } }, ...(deal.contactId ? { contact: { connect: { id: deal.contactId } } } : {}), ...(deal.companyId ? { company: { connect: { id: deal.companyId } } } : {}) } as any,
    });
    // Notify the contact's linked user
    if (deal.contactId) {
      const clientUser = await prisma.user.findFirst({ where: { contactId: deal.contactId, tenantId, role: 'CLIENT' } });
      if (clientUser) {
        notify(clientUser.id, 'deal_feedback', 'Feedback on Your Deal', `Admin commented on "${deal.name}"`, '/portal/deals');
      }
    }
    res.status(201).json(interaction);
  } catch (err) { next(err); }
});

// --- Tickets ---
router.get('/tickets', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '20', status, priority } = req.query;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({ where, include: { contact: true, company: true }, skip, take: Number(limit), orderBy: { updatedAt: 'desc' } }),
      prisma.ticket.count({ where }),
    ]);
    res.json({ items: tickets, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
});

router.post('/tickets', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { subject, description, priority, category, contactId, companyId } = req.body;
    const ticket = await prisma.ticket.create({
      data: { subject, description, priority, category, contactId, companyId, tenant: { connect: { id: tenantId } } } as any,
    });
    notify(req.user!.id, 'ticket_created', 'New Ticket', `"${subject}" ticket opened`);
    res.status(201).json(ticket);
  } catch (err) { next(err); }
});

router.get('/tickets/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, tenantId }, include: { contact: true, company: true } });
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    res.json(ticket);
  } catch (err) { next(err); }
});

router.put('/tickets/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data: req.body });
    res.json(ticket);
  } catch (err) { next(err); }
});

// --- Users (tenant-scoped management) ---
router.get('/users', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/users', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { email, password, name, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: role || 'CLIENT', tenant: { connect: { id: tenantId } } } as any,
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) { next(err); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data: any = { ...req.body };
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Agent Tasks ---
router.get('/agent-tasks', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const tasks = await prisma.agentTask.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks);
  } catch (err) { next(err); }
});

router.post('/agent-tasks', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agent, type, config, interval } = req.body;
    const nextRunAt = new Date(Date.now() + (interval || 3600) * 1000);
    const task = await prisma.agentTask.create({
      data: { agent, type, config, interval: interval || 3600, nextRunAt, tenant: { connect: { id: tenantId } } } as any,
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
});

router.put('/agent-tasks/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.agentTask.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const task = await prisma.agentTask.update({ where: { id: req.params.id }, data: req.body });
    res.json(task);
  } catch (err) { next(err); }
});

// --- Manual Notification ---
router.post('/notifications/send', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { userId, title, message, link } = req.body;
    if (!userId || !title || !message) return res.status(400).json({ error: 'userId, title, and message required' });
    const targetUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    notify(userId, 'manual', title, message, link);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Onboarding Links ---
router.get('/onboarding-links', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const links = await prisma.onboardingLink.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { contact: true, company: true },
    });
    res.json(links);
  } catch (err) { next(err); }
});
