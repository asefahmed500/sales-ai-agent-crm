import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../core/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendInvitationEmail, sendOnboardedNotificationEmail } from '../services/email.service.js';
import { notificationEvents } from './endpoints.js';

export const router = Router();

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;
  let pw = '';
  pw += upper[crypto.randomInt(upper.length)];
  pw += lower[crypto.randomInt(lower.length)];
  pw += digits[crypto.randomInt(digits.length)];
  for (let i = 0; i < 5; i++) pw += all[crypto.randomInt(all.length)];
  return pw.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

// Generate onboarding link + create CLIENT user with temp password
router.post('/generate', authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { contactId, companyId } = req.body;
    if (!contactId || !companyId) return res.status(400).json({ error: 'contactId and companyId required' });

    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const company = await prisma.company.findFirst({ where: { id: companyId, tenantId } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: contact.email } });

    const tempPassword = generatePassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    if (user) {
      // Update existing user password
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, isActive: true } });
    } else {
      // Create CLIENT user
      user = await prisma.user.create({
        data: {
          email: contact.email,
          password: hashed,
          name: contact.name,
          role: 'CLIENT',
          contact: { connect: { id: contact.id } },
          tenant: { connect: { id: tenantId } },
        } as any,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const link = await prisma.onboardingLink.create({
      data: { token, expiresAt, tenant: { connect: { id: tenantId } }, contact: { connect: { id: contactId } }, company: { connect: { id: companyId } } } as any,
      include: { contact: true, company: true },
    });

    const portalUrl = `http://localhost:3000/portal/register?token=${token}`;

    // Send invitation email with credentials
    sendInvitationEmail(contact.email, contact.name, portalUrl, company.name, tempPassword);

    // SSE notification to admin
    notificationEvents.emit('notification', {
      userId: req.user!.id,
      type: 'invitation_sent',
      title: 'Invitation Sent',
      message: `Credentials sent to ${contact.name} (${contact.email})`,
      link: '/dashboard/clients',
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      ...link,
      portalUrl,
      credentials: { email: contact.email, password: tempPassword },
    });
  } catch (err) { next(err); }
});

// Verify onboarding token
router.get('/verify/:token', async (req, res, next) => {
  try {
    const link = await prisma.onboardingLink.findUnique({ where: { token: req.params.token }, include: { contact: true, company: true } });
    if (!link) return res.status(404).json({ error: 'Invalid token' });
    if (link.status !== 'PENDING') return res.status(400).json({ error: `Link already ${link.status.toLowerCase()}` });
    if (link.expiresAt < new Date()) return res.status(400).json({ error: 'Link expired' });

    res.json({ valid: true, contact: link.contact, company: link.company });
  } catch (err) { next(err); }
});

// Complete onboarding - mark link as used, activate user
router.post('/complete/:token', async (req, res, next) => {
  try {
    const link = await prisma.onboardingLink.findUnique({ where: { token: req.params.token } });
    if (!link) return res.status(404).json({ error: 'Invalid token' });
    if (link.status !== 'PENDING') return res.status(400).json({ error: `Link already ${link.status.toLowerCase()}` });
    if (link.expiresAt < new Date()) return res.status(400).json({ error: 'Link expired' });

    await prisma.onboardingLink.update({
      where: { id: link.id },
      data: { status: 'USED', usedAt: new Date() },
    });

    await prisma.contact.update({
      where: { id: link.contactId },
      data: { stage: 'WON' },
    });

    // Activate the user
    await prisma.user.updateMany({
      where: { email: link.contactId }, // use contact's email
      data: { isActive: true },
    });

    // Get the tenant owner to notify them
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId: link.tenantId, role: 'OWNER' },
    });
    const contact = await prisma.contact.findUnique({ where: { id: link.contactId } });
    const company = await prisma.company.findUnique({ where: { id: link.companyId } });

    for (const owner of tenantUsers) {
      notificationEvents.emit('notification', {
        userId: owner.id,
        type: 'client_onboarded',
        title: 'Client Onboarded',
        message: `${contact?.name || 'A client'} has completed onboarding`,
        link: '/dashboard/clients',
        createdAt: new Date().toISOString(),
      });

      if (contact && company) {
        sendOnboardedNotificationEmail(owner.email, owner.name, contact.name, company.name);
      }
    }

    res.json({ success: true, contactId: link.contactId, companyId: link.companyId });
  } catch (err) { next(err); }
});
