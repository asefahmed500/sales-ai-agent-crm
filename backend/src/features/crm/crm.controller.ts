import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../core/database.js';
import { ok, created } from '../../core/response.js';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { notify } from '../notifications/notifications.controller.js';

// --- Dashboard Stats ---
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
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
    ok(res, {
      totalContacts, totalCompanies, totalDeals, totalTickets,
      openDealsValue: openDeals._sum.amount || 0, openDealsCount: openDeals._count,
      wonDealsValue: wonDeals._sum.amount || 0, wonDealsCount: wonDeals._count,
      contactsByStage: byStage, dealsByStage: byDealStage,
      recentContacts, recentDeals,
    });
  } catch (err) { next(err); }
}

// --- Pipeline overview (public) ---
export async function getPipelineOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const byStage = await prisma.contact.groupBy({ by: ['stage'], where: { tenantId }, _count: true });
    const openDeals = await prisma.deal.aggregate({ where: { tenantId, status: 'OPEN' }, _sum: { amount: true }, _count: true });
    const wonDeals = await prisma.deal.aggregate({ where: { tenantId, status: 'WON' }, _sum: { amount: true }, _count: true });
    const contacts = await prisma.contact.count({ where: { tenantId } });
    ok(res, {
      contacts, byStage,
      open: { count: openDeals._count, value: openDeals._sum.amount || 0 },
      won: { count: wonDeals._count, value: wonDeals._sum.amount || 0 },
    });
  } catch (err) { next(err); }
}

// --- Pipeline (Kanban-ready) ---
export async function getPipelineKanban(req: Request, res: Response, next: NextFunction) {
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
    ok(res, grouped);
  } catch (err) { next(err); }
}

// --- Contacts ---
export async function listContacts(req: Request, res: Response, next: NextFunction) {
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
    ok(res, { items: contacts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function listContactsSimple(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, contacts);
  } catch (err) { next(err); }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { name, email, phone, role, stage, companyId, source, tags } = req.body;
    const contact = await prisma.contact.create({
      data: { name, email, phone, role, stage, companyId, source, tags, tenant: { connect: { id: tenantId } } },
    });
    notify(req.user!.id, 'contact_created', 'New Contact', `${name} was added to CRM`);
    created(res, contact);
  } catch (err) { next(err); }
}

export async function getContact(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const contact = await prisma.contact.findFirst({ where: { id: String(req.params.id), tenantId }, include: { company: true } });
    if (!contact) return next(new NotFoundError('Contact'));
    ok(res, contact);
  } catch (err) { next(err); }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.contact.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Contact'));
    const contact = await prisma.contact.update({ where: { id: String(req.params.id) }, data: req.body });
    ok(res, contact);
  } catch (err) { next(err); }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.contact.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Contact'));
    await prisma.contact.delete({ where: { id: String(req.params.id) } });
    ok(res, { success: true });
  } catch (err) { next(err); }
}

// --- Companies ---
export async function listCompanies(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '20', search } = req.query;
    const where: any = { tenantId };
    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    const skip = (Number(page) - 1) * Number(limit);
    const [companies, total] = await Promise.all([
      prisma.company.findMany({ where, skip, take: Number(limit), orderBy: { updatedAt: 'desc' }, include: { _count: { select: { contacts: true, deals: true } } } }),
      prisma.company.count({ where }),
    ]);
    ok(res, { items: companies, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function listCompaniesSimple(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const companies = await prisma.company.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, companies);
  } catch (err) { next(err); }
}

export async function createCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { name, domain, industry, size, website, score, tags } = req.body;
    const company = await prisma.company.create({
      data: { name, domain, industry, size, website, score, tags, tenant: { connect: { id: tenantId } } },
    });
    created(res, company);
  } catch (err) { next(err); }
}

export async function getCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const company = await prisma.company.findFirst({
      where: { id: String(req.params.id), tenantId },
      include: { _count: { select: { contacts: true, deals: true, tickets: true } } },
    });
    if (!company) return next(new NotFoundError('Company'));
    ok(res, company);
  } catch (err) { next(err); }
}

export async function updateCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.company.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Company'));
    const company = await prisma.company.update({ where: { id: String(req.params.id) }, data: req.body });
    ok(res, company);
  } catch (err) { next(err); }
}

export async function deleteCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.company.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Company'));
    await prisma.company.delete({ where: { id: String(req.params.id) } });
    ok(res, { success: true });
  } catch (err) { next(err); }
}

// --- Deals ---
export async function listDeals(req: Request, res: Response, next: NextFunction) {
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
    ok(res, { items: deals, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function listDealsSimple(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deals = await prisma.deal.findMany({
      where: { tenantId },
      include: { company: true, contact: true },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, deals);
  } catch (err) { next(err); }
}

export async function createDeal(req: Request, res: Response, next: NextFunction) {
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
    created(res, deal);
  } catch (err) { next(err); }
}

export async function getDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: String(req.params.id), tenantId }, include: { company: true, contact: true } });
    if (!deal) return next(new NotFoundError('Deal'));
    ok(res, deal);
  } catch (err) { next(err); }
}

export async function updateDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.deal.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Deal'));
    const deal = await prisma.deal.update({ where: { id: String(req.params.id) }, data: req.body });
    ok(res, deal);
  } catch (err) { next(err); }
}

export async function deleteDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.deal.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Deal'));
    await prisma.deal.delete({ where: { id: String(req.params.id) } });
    ok(res, { success: true });
  } catch (err) { next(err); }
}

// --- Deal Comments ---
export async function getDealComments(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deal = await prisma.deal.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!deal) return next(new NotFoundError('Deal'));
    const interactions = await prisma.interaction.findMany({
      where: { dealId: String(req.params.id), tenantId, channel: 'DEAL_FEEDBACK' },
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
      data: { channel: 'DEAL_FEEDBACK', direction: 'OUTBOUND', content, tenant: { connect: { id: tenantId } }, deal: { connect: { id: String(req.params.id) } }, ...(deal.contactId ? { contact: { connect: { id: deal.contactId } } } : {}), ...(deal.companyId ? { company: { connect: { id: deal.companyId } } } : {}) } as any,
    });
    if (deal.contactId) {
      const clientUser = await prisma.user.findFirst({ where: { contactId: deal.contactId, tenantId, role: 'CLIENT' } });
      if (clientUser) {
        notify(clientUser.id, 'deal_feedback', 'Feedback on Your Deal', `Admin commented on "${deal.name}"`, '/portal/deals');
      }
    }
    created(res, interaction);
  } catch (err) { next(err); }
}

// --- Tickets ---
export async function listTickets(req: Request, res: Response, next: NextFunction) {
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
    ok(res, { items: tickets, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function listTicketsSimple(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const tickets = await prisma.ticket.findMany({
      where: { tenantId },
      include: { contact: true, company: true },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, tickets);
  } catch (err) { next(err); }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { subject, description, priority, category, contactId, companyId } = req.body;
    const ticket = await prisma.ticket.create({
      data: { subject, description, priority, category, contactId, companyId, tenant: { connect: { id: tenantId } } } as any,
    });
    notify(req.user!.id, 'ticket_created', 'New Ticket', `"${subject}" ticket opened`);
    created(res, ticket);
  } catch (err) { next(err); }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const ticket = await prisma.ticket.findFirst({ where: { id: String(req.params.id), tenantId }, include: { contact: true, company: true } });
    if (!ticket) return next(new NotFoundError('Ticket'));
    ok(res, ticket);
  } catch (err) { next(err); }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.ticket.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('Ticket'));
    const ticket = await prisma.ticket.update({ where: { id: String(req.params.id) }, data: req.body });
    ok(res, ticket);
  } catch (err) { next(err); }
}

// --- Users ---
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
        skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { tenantId } }),
    ]);
    ok(res, { items: users, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { email, password, name, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: role || 'CLIENT', tenant: { connect: { id: tenantId } } } as any,
    });
    created(res, { id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.user.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('User'));
    const data: any = { ...req.body };
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.update({
      where: { id: String(req.params.id) }, data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    ok(res, user);
  } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.user.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('User'));
    await prisma.user.delete({ where: { id: String(req.params.id) } });
    ok(res, { success: true });
  } catch (err) { next(err); }
}

// --- Agent Tasks ---
export async function listAgentTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [tasks, total] = await Promise.all([
      prisma.agentTask.findMany({ where: { tenantId }, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.agentTask.count({ where: { tenantId } }),
    ]);
    ok(res, { items: tasks, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function createAgentTask(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { agent, type, config, interval } = req.body;
    const nextRunAt = new Date(Date.now() + (interval || 3600) * 1000);
    const task = await prisma.agentTask.create({
      data: { agent, type, config, interval: interval || 3600, nextRunAt, tenant: { connect: { id: tenantId } } } as any,
    });
    created(res, task);
  } catch (err) { next(err); }
}

export async function updateAgentTask(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.agentTask.findFirst({ where: { id: String(req.params.id), tenantId } });
    if (!existing) return next(new NotFoundError('AgentTask'));
    const task = await prisma.agentTask.update({ where: { id: String(req.params.id) }, data: req.body });
    ok(res, task);
  } catch (err) { next(err); }
}

// --- Notifications ---
export async function sendNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { userId, title, message, link } = req.body;
    if (!userId || !title || !message) return next(new ValidationError('userId, title, and message required'));
    const targetUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!targetUser) return next(new NotFoundError('User'));
    notify(userId, 'manual', title, message, link);
    ok(res, { success: true });
  } catch (err) { next(err); }
}

// --- Live Chat ---
export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      include: {
        _count: { select: { interactions: true } },
        interactions: { where: { channel: 'LIVE_CHAT' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const result = contacts.map((c) => {
      const last = c.interactions[0];
      return {
        id: c.id, name: c.name, email: c.email,
        lastMessage: last || null,
        messageCount: c._count.interactions,
        isClosed: last?.direction === 'SYSTEM' && last?.content === '__CLOSED__',
      };
    });
    ok(res, result);
  } catch (err) { next(err); }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const messages = await prisma.interaction.findMany({
      where: { contactId: String(req.params.contactId), tenantId, channel: 'LIVE_CHAT' },
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
    const contact = await prisma.contact.findFirst({ where: { id: String(req.params.contactId), tenantId } });
    if (!contact) return next(new NotFoundError('Contact'));
    const message = await prisma.interaction.create({
      data: { channel: 'LIVE_CHAT', direction: 'OUTBOUND', content, tenant: { connect: { id: tenantId } }, contact: { connect: { id: String(req.params.contactId) } } } as any,
    });
    const clientUser = await prisma.user.findFirst({ where: { contactId: String(req.params.contactId), tenantId, role: 'CLIENT' } });
    if (clientUser) notify(clientUser.id, 'live_chat_message', 'New Message', content.substring(0, 100), '/portal/messages');
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER', id: { not: req.user!.id } } });
    for (const owner of owners) notify(owner.id, 'live_chat_message', `Message from ${contact.name}`, content.substring(0, 100), '/dashboard/messages');
    created(res, message);
  } catch (err) { next(err); }
}

export async function closeConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const contact = await prisma.contact.findFirst({ where: { id: String(req.params.contactId), tenantId } });
    if (!contact) return next(new NotFoundError('Contact'));
    await prisma.interaction.deleteMany({ where: { contactId: String(req.params.contactId), tenantId, channel: 'LIVE_CHAT', direction: 'SYSTEM', content: '__CLOSED__' } });
    const message = await prisma.interaction.create({
      data: { channel: 'LIVE_CHAT', direction: 'SYSTEM', content: '__CLOSED__', tenant: { connect: { id: tenantId } }, contact: { connect: { id: String(req.params.contactId) } } } as any,
    });
    const clientUser = await prisma.user.findFirst({ where: { contactId: String(req.params.contactId), tenantId, role: 'CLIENT' } });
    if (clientUser) notify(clientUser.id, 'live_chat_closed', 'Conversation Closed', `Admin closed the conversation with ${contact.name}`, '/portal/messages');
    ok(res, { success: true, message });
  } catch (err) { next(err); }
}

export async function reopenConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    await prisma.interaction.deleteMany({ where: { contactId: String(req.params.contactId), tenantId, channel: 'LIVE_CHAT', direction: 'SYSTEM', content: '__CLOSED__' } });
    const clientUser = await prisma.user.findFirst({ where: { contactId: String(req.params.contactId), tenantId, role: 'CLIENT' } });
    if (clientUser) notify(clientUser.id, 'live_chat_reopened', 'Conversation Reopened', `Admin reopened the conversation`, '/portal/messages');
    ok(res, { success: true });
  } catch (err) { next(err); }
}

// --- Onboarding Links ---
export async function listOnboardingLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [links, total] = await Promise.all([
      prisma.onboardingLink.findMany({ where: { tenantId }, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { contact: true, company: true } }),
      prisma.onboardingLink.count({ where: { tenantId } }),
    ]);
    ok(res, { items: links, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}
