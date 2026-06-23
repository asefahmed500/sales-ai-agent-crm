import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/database.js';
import { generateToken } from '../../middleware/auth.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import { env } from '../../config/env.js';
import { ok, created } from '../../core/response.js';
import { UnauthorizedError, ConflictError, ValidationError, ForbiddenError } from '../../core/errors.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new ValidationError('Email and password required'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(new UnauthorizedError('Invalid credentials'));
    if (!user.isActive) return next(new ForbiddenError('Account is disabled'));

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return next(new UnauthorizedError('Invalid credentials'));

    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId });
    ok(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
  } catch (err) { next(err); }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, companyName } = req.body;
    if (!email || !password || !name) return next(new ValidationError('Email, password, and name required'));

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(new ConflictError('Email already registered'));

    const hashed = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { name: companyName || 'My Company' },
    });

    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'OWNER', tenant: { connect: { id: tenant.id } } },
    });

    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId });
    created(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
  } catch (err) { next(err); }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, tenantId: true, contactId: true, createdAt: true },
    });
    ok(res, user);
  } catch (err) { next(err); }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) return next(new ValidationError('Email required'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      ok(res, { success: true, message: 'If the email exists, reset instructions have been sent.' });
      return;
    }

    const resetToken = jwt.sign({ id: user.id, purpose: 'password-reset' }, env.JWT_SECRET, { expiresIn: '1h' });
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    ok(res, { success: true, message: 'If the email exists, reset instructions have been sent.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return next(new ValidationError('Token and password required'));
    if (password.length < 8) return next(new ValidationError('Password must be at least 8 characters'));

    let payload: { id: string; purpose: string };
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as { id: string; purpose: string };
      if (payload.purpose !== 'password-reset') throw new Error('Invalid token purpose');
    } catch {
      return next(new ValidationError('Invalid or expired reset token'));
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: payload.id }, data: { password: hashed } });

    ok(res, { success: true, message: 'Password has been reset successfully.' });
  } catch (err) { next(err); }
}
