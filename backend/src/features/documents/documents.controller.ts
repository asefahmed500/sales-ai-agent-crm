import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { prisma } from '../../core/database.js';
import { ok, created } from '../../core/response.js';
import { NotFoundError } from '../../core/errors.js';
import { notify } from '../notifications/notifications.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});

export const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    const contact = user?.contactId ? await prisma.contact.findUnique({ where: { id: user.contactId }, select: { companyId: true } }) : null;
    const { title, description } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];
    const filePaths = files.map((f) => `/uploads/${f.filename}`);

    const ticket = await prisma.ticket.create({
      data: {
        subject: title || 'Document Submission',
        description: JSON.stringify({ text: description || '', files: filePaths }),
        priority: 'MEDIUM', status: 'PENDING_REVIEW',
        category: 'DOCUMENT_REVIEW',
        contactId: user?.contactId, companyId: contact?.companyId,
        tenant: { connect: { id: tenantId } },
      } as any,
    });

    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notify(owner.id, 'document_submitted', 'Document Submitted', `${req.user!.name} submitted "${title || 'a document'}" for review`, '/dashboard/documents');
    }

    created(res, ticket);
  } catch (err) { next(err); }
}

export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const tickets = await prisma.ticket.findMany({
      where: { tenantId, category: 'DOCUMENT_REVIEW' },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, tickets);
  } catch (err) { next(err); }
}

export async function reviewDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { status, comment } = req.body;
    const id = String(req.params.id);
    const ticket = await prisma.ticket.findFirst({ where: { id, tenantId } });
    if (!ticket) return next(new NotFoundError('Document'));

    const updated = await prisma.ticket.update({ where: { id }, data: { status } });

    if (comment) {
      await prisma.interaction.create({
        data: {
          channel: 'DOCUMENT_REVIEW', direction: 'INBOUND',
          content: JSON.stringify({ reviewer: req.user!.name, comment }),
          contactId: ticket.contactId, companyId: ticket.companyId,
          tenant: { connect: { id: tenantId } },
        } as any,
      });

      if (ticket.contactId) {
        const clientUser = await prisma.user.findFirst({ where: { contactId: ticket.contactId, tenantId } });
        if (clientUser) {
          notify(clientUser.id, 'document_reviewed', 'Document Reviewed', `Your document "${ticket.subject}" was ${status.toLowerCase()} with feedback.`, '/portal/documents');
        }
      }
    }

    ok(res, updated);
  } catch (err) { next(err); }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    const tickets = await prisma.ticket.findMany({
      where: { tenantId, category: 'DOCUMENT_REVIEW', contactId: user?.contactId },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, tickets);
  } catch (err) { next(err); }
}

export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);
    const ticket = await prisma.ticket.findFirst({ where: { id, tenantId } });
    if (!ticket) return next(new NotFoundError('Document'));
    if (!ticket.contactId) return ok(res, []);
    const interactions = await prisma.interaction.findMany({
      where: { contactId: ticket.contactId, channel: 'DOCUMENT_REVIEW' },
      orderBy: { createdAt: 'asc' },
    });
    ok(res, interactions);
  } catch (err) { next(err); }
}
