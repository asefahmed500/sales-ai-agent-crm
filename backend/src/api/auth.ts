import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../core/database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

const RESET_SECRET = process.env.JWT_SECRET || 'sg-dev-secret';

export const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is disabled' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
  } catch (err) { next(err); }
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, companyName } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { name: companyName || 'My Company' },
    });

    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'OWNER', tenant: { connect: { id: tenant.id } } },
    });

    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
  } catch (err) { next(err); }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, tenantId: true, contactId: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// Forgot password — send reset email
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ success: true, message: 'If the email exists, reset instructions have been sent.' });

    const resetToken = jwt.sign({ id: user.id, purpose: 'password-reset' }, RESET_SECRET, { expiresIn: '1h' });
    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.json({ success: true, message: 'If the email exists, reset instructions have been sent.' });
  } catch (err) { next(err); }
});

// Reset password — validate token + update
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    let payload: { id: string; purpose: string };
    try {
      payload = jwt.verify(token, RESET_SECRET) as { id: string; purpose: string };
      if (payload.purpose !== 'password-reset') throw new Error('Invalid token purpose');
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: payload.id }, data: { password: hashed } });

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) { next(err); }
});
