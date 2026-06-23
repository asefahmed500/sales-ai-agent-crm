import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { prisma } from '../../core/database.js';
import { runAgentPipeline } from '../../services/agent_executor.js';
import { AGENTS } from './agents.js';
import { env } from '../../config/env.js';
import { ok } from '../../core/response.js';
import { ValidationError } from '../../core/errors.js';

export const trajectoryEvents = new EventEmitter();

export function listAgents(_req: Request, res: Response) {
  ok(res, AGENTS);
}

export async function submitChat(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { sessionId, contactId, message, channel, agent } = req.body;

    if (!sessionId || !message) {
      return next(new ValidationError('sessionId and message are required.'));
    }

    runAgentPipeline({
      sessionId, contactId, message,
      channel: channel || 'CHAT', agent, tenantId,
    }).catch((err) => {
      console.error('Agent execution failed asynchronously:', err);
    });

    ok(res, { status: 'processing', sessionId });
  } catch (err) { next(err); }
}

export function streamAgentTrajectory(req: Request, res: Response) {
  const { sessionId } = req.params;
  const token = req.query.token as string;

  if (!token) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }

  try {
    jwt.verify(token, env.JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Encoding': 'none',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  const handleUpdate = (eventData: any) => {
    if (eventData.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    }
  };

  trajectoryEvents.on('update', handleUpdate);

  req.on('close', () => {
    trajectoryEvents.off('update', handleUpdate);
    res.end();
  });
}

export async function getTrajectory(req: Request, res: Response, next: NextFunction) {
  try {
    const interactionId = String(req.params.interactionId);
    const logs = await prisma.agentTrajectory.findMany({
      where: { interactionId },
      orderBy: { createdAt: 'asc' },
    });
    ok(res, logs);
  } catch (err) { next(err); }
}

export async function getInteractions(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const contactId = String(req.params.contactId);
    const interactions = await prisma.interaction.findMany({
      where: { contactId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
    ok(res, interactions);
  } catch (err) { next(err); }
}
