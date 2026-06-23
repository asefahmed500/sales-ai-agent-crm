import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal Server Error', message: err.message || 'Something went wrong' });
}
