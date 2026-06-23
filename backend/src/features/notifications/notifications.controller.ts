import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { env } from '../../config/env.js';

export const notificationEvents = new EventEmitter();

export function streamNotifications(req: Request, res: Response) {
  const { userId } = req.params;
  const token = req.query.token as string;

  if (!token) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    if (decoded.id !== userId) {
      res.status(403).json({ error: 'User ID mismatch' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  const handler = (event: any) => {
    if (event.userId === userId || !event.userId) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  notificationEvents.on('notification', handler);

  const keepAlive = setInterval(() => res.write(':keepalive\n\n'), 30000);

  req.on('close', () => {
    notificationEvents.off('notification', handler);
    clearInterval(keepAlive);
    res.end();
  });
}

export function notify(userId: string, type: string, title: string, message: string, link?: string) {
  notificationEvents.emit('notification', {
    userId,
    type,
    title,
    message,
    link,
    createdAt: new Date().toISOString(),
  });
}
