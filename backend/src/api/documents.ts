import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { prisma } from '../core/database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { sendOnboardedNotificationEmail } from '../services/email.service.js';
import { notificationEvents } from './endpoints.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

export const router = Router();

// Client: upload a document
router.post('/upload', authMiddleware, requireRole('CLIENT'), upload.array('files', 5), async (req, res, next) => {
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
        priority: 'MEDIUM',
        status: 'PENDING_REVIEW',
        category: 'DOCUMENT_REVIEW',
        contactId: user?.contactId,
        companyId: contact?.companyId,
        tenant: { connect: { id: tenantId } },
      } as any,
    });

    // Notify all OWNERs in the tenant
    const owners = await prisma.user.findMany({ where: { tenantId, role: 'OWNER' } });
    for (const owner of owners) {
      notificationEvents.emit('notification', {
        userId: owner.id,
        type: 'document_submitted',
        title: 'Document Submitted',
        message: `${req.user!.name} submitted "${title || 'a document'}" for review`,
        link: '/dashboard/documents',
        createdAt: new Date().toISOString(),
      });
    }

    res.status(201).json(ticket);
  } catch (err) { next(err); }
});

// Admin/OWNER: list all document reviews
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const tickets = await prisma.ticket.findMany({
      where: { tenantId, category: 'DOCUMENT_REVIEW' },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (err) { next(err); }
});

// Admin/OWNER: update review status + add comment
router.put('/:id/review', authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, comment } = req.body; // status: APPROVED | REJECTED | PENDING_REVIEW

    const id = req.params.id as string;
    const ticket = await prisma.ticket.findFirst({ where: { id, tenantId } });
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { status } });

    // Add comment as interaction
    if (comment) {
      const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId! } });
      await prisma.interaction.create({
        data: {
          channel: 'DOCUMENT_REVIEW',
          direction: 'INBOUND',
          content: JSON.stringify({ reviewer: req.user!.name, comment }),
          contactId: ticket.contactId,
          companyId: ticket.companyId,
          tenant: { connect: { id: tenantId } },
        } as any,
      });

      // Notify the client
      if (ticket.contactId) {
        const clientUser = await prisma.user.findFirst({ where: { contactId: ticket.contactId, tenantId } });
        if (clientUser) {
          notificationEvents.emit('notification', {
            userId: clientUser.id,
            type: 'document_reviewed',
            title: 'Document Reviewed',
            message: `Your document "${ticket.subject}" was ${status.toLowerCase()} with feedback.`,
            link: '/portal/documents',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// Client: get own documents
router.get('/mine', authMiddleware, requireRole('CLIENT'), async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { contactId: true } });
    const tickets = await prisma.ticket.findMany({
      where: { tenantId, category: 'DOCUMENT_REVIEW', contactId: user?.contactId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (err) { next(err); }
});

// Client or Admin: get comments for a document
router.get('/:id/comments', authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id as string;
    const ticket = await prisma.ticket.findFirst({ where: { id, tenantId } });
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    const interactions = await prisma.interaction.findMany({
      where: { contactId: ticket.contactId!, channel: 'DOCUMENT_REVIEW' },
      orderBy: { createdAt: 'asc' },
    });
    res.json(interactions);
  } catch (err) { next(err); }
});
