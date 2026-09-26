import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';

export const errorHandler = (
  err: Error | AppError | Prisma.PrismaClientKnownRequestError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // 1. Handle known AppError
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode);
    return;
  }

  // 2. Handle Zod validation errors
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    sendError(res, 'VALIDATION_ERROR', message, 400);
    return;
  }

  // 3. Handle Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(', ')
        : String(err.meta?.target || 'field');
      sendError(res, 'CONFLICT', `A unique constraint failed on: ${target}`, 409);
      return;
    }

    if (err.code === 'P2025') {
      sendError(res, 'NOT_FOUND', 'Requested resource was not found', 404);
      return;
    }

    if (err.code === 'P2003') {
      sendError(res, 'CONFLICT', 'Foreign key reference constraint violation', 409);
      return;
    }
  }

  // 4. Unhandled error fallback
  console.error('Unhandled server error:', err);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, 'INTERNAL_ERROR', message, 500);
};
