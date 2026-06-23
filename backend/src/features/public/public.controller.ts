import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/database.js';
import { ok, created } from '../../core/response.js';

export async function getPipelineSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const byStage = await prisma.contact.groupBy({ by: ['stage'], where: { tenantId }, _count: true });
    const openDeals = await prisma.deal.aggregate({ where: { tenantId, status: 'OPEN' }, _sum: { amount: true }, _count: true });
    const wonDeals = await prisma.deal.aggregate({ where: { tenantId, status: 'WON' }, _sum: { amount: true }, _count: true });
    const contacts = await prisma.contact.count({ where: { tenantId } });
    ok(res, { contacts, byStage, open: { count: openDeals._count, value: openDeals._sum.amount || 0 }, won: { count: wonDeals._count, value: wonDeals._sum.amount || 0 } });
  } catch (err) { next(err); }
}

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const contacts = await prisma.contact.findMany({ where: { tenantId }, include: { company: true }, orderBy: { updatedAt: 'desc' } });
    ok(res, contacts);
  } catch (err) { next(err); }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { name, email, phone, role, companyId } = req.body;
    const contact = await prisma.contact.create({
      data: { name, email, phone, role, companyId, tenant: { connect: { id: tenantId } } } as any,
    });
    created(res, contact);
  } catch (err) { next(err); }
}

export async function listCompanies(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const companies = await prisma.company.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
    ok(res, companies);
  } catch (err) { next(err); }
}

export async function listDeals(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deals = await prisma.deal.findMany({ where: { tenantId }, include: { company: true, contact: true }, orderBy: { updatedAt: 'desc' } });
    ok(res, deals);
  } catch (err) { next(err); }
}

export async function listTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const tickets = await prisma.ticket.findMany({ where: { tenantId }, include: { contact: true, company: true }, orderBy: { updatedAt: 'desc' } });
    ok(res, tickets);
  } catch (err) { next(err); }
}

export async function listOutbox(req: Request, res: Response, next: NextFunction) {
  try {
    const outbox = await prisma.crmOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    ok(res, outbox);
  } catch (err) { next(err); }
}
