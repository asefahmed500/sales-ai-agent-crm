import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/database.js';
import { ok, created } from '../../core/response.js';
import { ValidationError, NotFoundError } from '../../core/errors.js';
import { notify } from '../notifications/notifications.controller.js';

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { contact: { include: { company: true } } },
    });
    ok(res, user);
  } catch (err) { next(err); }
}

export async function listDeals(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return ok(res, []);
    const deals = await prisma.deal.findMany({
      where: { contactId: user.contactId, tenantId },
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, deals);
  } catch (err) { next(err); }
}

export async function createDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return next(new ValidationError('No contact linked'));
    const contact = await prisma.contact.findUnique({ where: { id: user.contactId }, select: { companyId: true } });
    const { name, amount, notes } = req.body;
    if (!name || !amount) return next(new ValidationError('Name and amount required'));
    const createData: any = { name, amount: Number(amount), stage: 'PROPOSAL', status: 'OPEN', notes, contact: { connect: { id: user.contactId } }, tenant: { connect: { id: tenantId } } };
    if (contact?.companyId) createData.company = { connect: { id: contact.companyId } };
    const deal = await prisma.deal.create({ data: createData });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notify(owner.id, 'deal_offer', 'New Deal Offer', `${req.user!.name} submitted "${name}" for $${Number(amount).toLocaleString()}`, '/dashboard/deals');
    }
    created(res, deal);
  } catch (err) { next(err); }
}

export async function getDealComments(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!deal) return next(new NotFoundError('Deal'));
    const interactions = await prisma.interaction.findMany({
      where: { dealId: String(req.params.id), channel: 'DEAL_FEEDBACK' },
      orderBy: { createdAt: 'asc' },
    });
    ok(res, interactions);
  } catch (err) { next(err); }
}

export async function addDealComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!deal) return next(new NotFoundError('Deal'));
    const { content } = req.body;
    if (!content) return next(new ValidationError('Content required'));
    const interaction = await prisma.interaction.create({
      data: { channel: 'DEAL_FEEDBACK', direction: 'INBOUND', content, tenant: { connect: { id: tenantId } }, deal: { connect: { id: String(req.params.id) } }, ...(deal.contactId ? { contact: { connect: { id: deal.contactId } } } : {}), ...(deal.companyId ? { company: { connect: { id: deal.companyId } } } : {}) } as any,
    });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notify(owner.id, 'deal_comment', 'New Comment on Deal', `${req.user!.name} commented on "${deal.name}"`, '/dashboard/deals');
    }
    created(res, interaction);
  } catch (err) { next(err); }
}

export async function listTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return ok(res, []);
    const tickets = await prisma.ticket.findMany({
      where: { contactId: user.contactId, tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, tickets);
  } catch (err) { next(err); }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    const contact = user?.contactId ? await prisma.contact.findUnique({ where: { id: user.contactId }, select: { companyId: true } }) : null;
    const { subject, description, priority, category } = req.body;
    const ticket = await prisma.ticket.create({
      data: { subject, description, priority, category, tenant: { connect: { id: tenantId } }, ...(user?.contactId ? { contact: { connect: { id: user.contactId } } } : {}), ...(contact?.companyId ? { company: { connect: { id: contact.companyId } } } : {}) },
    });
    created(res, ticket);
  } catch (err) { next(err); }
}

export async function listInteractions(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return ok(res, []);
    const interactions = await prisma.interaction.findMany({
      where: { contactId: user.contactId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, interactions);
  } catch (err) { next(err); }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return ok(res, []);
    const messages = await prisma.interaction.findMany({
      where: { contactId: user.contactId, tenantId, channel: 'LIVE_CHAT' },
      orderBy: { createdAt: 'asc' },
    });
    ok(res, messages);
  } catch (err) { next(err); }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { content } = req.body;
    if (!content) return next(new ValidationError('Content required'));
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true, name: true } });
    if (!user?.contactId) return next(new ValidationError('No contact linked'));
    const message = await prisma.interaction.create({
      data: { channel: 'LIVE_CHAT', direction: 'INBOUND', content, tenant: { connect: { id: tenantId } }, contact: { connect: { id: user.contactId } } } as any,
    });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notify(owner.id, 'live_chat_message', `Message from ${req.user!.name}`, content.substring(0, 100), '/dashboard/messages');
    }
    created(res, message);
  } catch (err) { next(err); }
}

export async function closeConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true, name: true } });
    if (!user?.contactId) return next(new ValidationError('No contact linked'));
    await prisma.interaction.deleteMany({ where: { contactId: user.contactId, tenantId, channel: 'LIVE_CHAT', direction: 'SYSTEM', content: '__CLOSED__' } });
    const message = await prisma.interaction.create({
      data: { channel: 'LIVE_CHAT', direction: 'SYSTEM', content: '__CLOSED__', tenant: { connect: { id: tenantId } }, contact: { connect: { id: user.contactId } } } as any,
    });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) notify(owner.id, 'live_chat_closed', 'Conversation Closed', `${req.user!.name} closed the conversation`, '/dashboard/messages');
    ok(res, { success: true, message });
  } catch (err) { next(err); }
}

export async function reopenConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (!user?.contactId) return next(new ValidationError('No contact linked'));
    await prisma.interaction.deleteMany({ where: { contactId: user.contactId, tenantId, channel: 'LIVE_CHAT', direction: 'SYSTEM', content: '__CLOSED__' } });
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) notify(owner.id, 'live_chat_reopened', 'Conversation Reopened', `${req.user!.name} reopened the conversation`, '/dashboard/messages');
    ok(res, { success: true });
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    if (user?.contactId) {
      const { name, phone } = req.body;
      await prisma.contact.update({
        where: { id: user.contactId },
        data: { ...(name !== undefined ? { name } : {}), ...(phone !== undefined ? { phone } : {}) },
      });
    }
    ok(res, { success: true });
  } catch (err) { next(err); }
}
