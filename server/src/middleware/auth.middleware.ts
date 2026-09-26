import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { Errors } from '../utils/errors.js';

export interface AuthUser {
  userId: bigint;
  role: UserRole;
  warehouseId: bigint | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware scaffold for Phase 1.
 * Fully implemented in Phase 2 with JWT verification.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(Errors.unauthorized('Authorization header with Bearer token required'));
  }

  // Phase 1 scaffold placeholder: In Phase 2, this verifies JWT and attaches req.user
  return next(Errors.unauthorized('Auth service is being configured in Phase 2'));
};

/**
 * Role-based authorization middleware.
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Errors.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(Errors.forbidden('You do not have permission to perform this action'));
    }

    return next();
  };
};
