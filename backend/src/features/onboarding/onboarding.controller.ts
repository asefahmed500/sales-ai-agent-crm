import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../core/database.js';
import { ok, created } from '../../core/response.js';
import { ValidationError, NotFoundError } from '../../core/errors.js';
import { sendInvitationEmail, sendOnboardedNotificationEmail } from '../../services/email.service.js';
import { notify } from '../notifications/notifications.controller.js';
import { env } from '../../config/env.js';

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

export async function generateLink(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { contactId, companyId } = req.body;
    if (!contactId || !companyId) return next(new ValidationError('contactId and companyId required'));

    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact) return next(new NotFoundError('Contact'));
    const company = await prisma.company.findFirst({ where: { id: companyId, tenantId } });
    if (!company) return next(new NotFoundError('Company'));

    let user = await prisma.user.findUnique({ where: { email: contact.email } });
    const tempPassword = generatePassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, isActive: true } });
    } else {
      user = await prisma.user.create({
        data: { email: contact.email, password: hashed, name: contact.name, role: 'CLIENT', contact: { connect: { id: contact.id } }, tenant: { connect: { id: tenantId } } } as any,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const link = await prisma.onboardingLink.create({
      data: { token, expiresAt, tenant: { connect: { id: tenantId } }, contact: { connect: { id: contactId } }, company: { connect: { id: companyId } } } as any,
      include: { contact: true, company: true },
    });

    const portalUrl = `${env.FRONTEND_URL}/portal/register?token=${token}`;
    sendInvitationEmail(contact.email, contact.name, portalUrl, company.name, tempPassword);

    notify(req.user!.id, 'invitation_sent', 'Invitation Sent', `Credentials sent to ${contact.name} (${contact.email})`, '/dashboard/clients');

    created(res, { ...link, portalUrl, credentials: { email: contact.email, password: tempPassword } });
  } catch (err) { next(err); }
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await prisma.onboardingLink.findUnique({ where: { token: String(req.params.token) }, include: { contact: true, company: true } }) as any;
    if (!link) return next(new NotFoundError('Invalid token'));
    if (link.status !== 'PENDING') return next(new ValidationError(`Link already ${link.status.toLowerCase()}`));
    if (link.expiresAt < new Date()) return next(new ValidationError('Link expired'));

    ok(res, { valid: true, contact: link.contact, company: link.company });
  } catch (err) { next(err); }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await prisma.onboardingLink.findUnique({ where: { token: String(req.params.token) } });
    if (!link) return next(new NotFoundError('Invalid token'));
    if (link.status !== 'PENDING') return next(new ValidationError(`Link already ${link.status.toLowerCase()}`));
    if (link.expiresAt < new Date()) return next(new ValidationError('Link expired'));

    await prisma.onboardingLink.update({ where: { id: link.id }, data: { status: 'USED', usedAt: new Date() } });
    await prisma.contact.update({ where: { id: link.contactId }, data: { stage: 'WON' } });

    const contact = await prisma.contact.findUnique({ where: { id: link.contactId } });
    if (contact) {
      await prisma.user.updateMany({ where: { email: contact.email }, data: { isActive: true } });
    }

    const tenantUsers = await prisma.user.findMany({ where: { tenantId: link.tenantId, role: 'OWNER' } });
    const company = await prisma.company.findUnique({ where: { id: link.companyId } });

    for (const owner of tenantUsers) {
      notify(owner.id, 'client_onboarded', 'Client Onboarded', `${contact?.name || 'A client'} has completed onboarding`, '/dashboard/clients');
      if (contact && company) {
        sendOnboardedNotificationEmail(owner.email, owner.name, contact.name, company.name);
      }
    }

    ok(res, { success: true, contactId: link.contactId, companyId: link.companyId });
  } catch (err) { next(err); }
}
