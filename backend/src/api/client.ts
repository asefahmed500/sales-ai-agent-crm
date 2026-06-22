import { Router } from 'express';
import { prisma } from '../core/database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { notificationEvents } from './endpoints.js';

export const router = Router();

// Client must be authenticated
router.use(authMiddleware, requireRole('CLIENT'));

// Get client profile (their contact info)
router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { contact: { include: { company: true } } },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// Get client's deals
router.get('/deals', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return res.json([]);
    const deals = await prisma.deal.findMany({
      where: { contactId: user.contactId, tenantId },
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(deals);
  } catch (err) { next(err); }
});

// Create a deal offer from client
router.post('/deals', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return res.status(400).json({ error: 'No contact linked' });
    const contact = await prisma.contact.findUnique({ where: { id: user.contactId }, select: { companyId: true } });
    const { name, amount, notes } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });
    const createData: any = { name, amount: Number(amount), stage: 'PROPOSAL', status: 'OPEN', notes, contact: { connect: { id: user.contactId } }, tenant: { connect: { id: tenantId } } };
    if (contact?.companyId) createData.company = { connect: { id: contact.companyId } };
    const deal = await prisma.deal.create({ data: createData });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notificationEvents.emit('notification', {
        userId: owner.id, type: 'deal_offer', title: 'New Deal Offer',
        message: `${req.user!.name} submitted "${name}" for $${Number(amount).toLocaleString()}`,
        link: '/dashboard/deals', createdAt: new Date().toISOString(),
      });
    }
    res.status(201).json(deal);
  } catch (err) { next(err); }
});

// Get interactions/comments for a deal
router.get('/deals/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    const interactions = await prisma.interaction.findMany({
      where: { dealId: req.params.id, channel: 'DEAL_FEEDBACK' },
      orderBy: { createdAt: 'asc' },
    });
    res.json(interactions);
  } catch (err) { next(err); }
});

// Client adds comment on a deal
router.post('/deals/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const interaction = await prisma.interaction.create({
      data: { channel: 'DEAL_FEEDBACK', direction: 'INBOUND', content, tenant: { connect: { id: tenantId } }, deal: { connect: { id: req.params.id } }, ...(deal.contactId ? { contact: { connect: { id: deal.contactId } } } : {}), ...(deal.companyId ? { company: { connect: { id: deal.companyId } } } : {}) } as any,
    });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notificationEvents.emit('notification', {
        userId: owner.id, type: 'deal_comment', title: 'New Comment on Deal',
        message: `${req.user!.name} commented on "${deal.name}"`,
        link: '/dashboard/deals', createdAt: new Date().toISOString(),
      });
    }
    res.status(201).json(interaction);
  } catch (err) { next(err); }
});

// Get client's tickets
router.get('/tickets', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return res.json([]);
    const tickets = await prisma.ticket.findMany({
      where: { contactId: user.contactId, tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(tickets);
  } catch (err) { next(err); }
});

// Create ticket from client portal
router.post('/tickets', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    const contact = user?.contactId ? await prisma.contact.findUnique({ where: { id: user.contactId }, select: { companyId: true } }) : null;
    const { subject, description, priority, category } = req.body;
    const ticket = await prisma.ticket.create({
      data: { subject, description, priority, category, contactId: user?.contactId, companyId: contact?.companyId, tenant: { connect: { id: tenantId } } } as any,
    });
    res.status(201).json(ticket);
  } catch (err) { next(err); }
});

// Get client's interactions
router.get('/interactions', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return res.json([]);
    const interactions = await prisma.interaction.findMany({
      where: { contactId: user.contactId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(interactions);
  } catch (err) { next(err); }
});

// Update client profile
router.put('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (user?.contactId) {
      await prisma.contact.update({ where: { id: user.contactId }, data: req.body });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});
