import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { Errors } from '../utils/errors.js';

export interface AuthUser {
  userId: bigint;
  role: UserRole;
  warehouseId: bigint | null;
}

export interface TokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  warehouseId: string | null;
  type: 'ACCESS' | 'RESET';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware to verify JWT access token and attach user to req.user
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(Errors.unauthorized('Authorization header with Bearer token required'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(Errors.unauthorized('Token is missing'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    if (payload.type !== 'ACCESS') {
      return next(Errors.unauthorized('Invalid token type'));
    }

    req.user = {
      userId: BigInt(payload.sub),
      role: payload.role,
      warehouseId: payload.warehouseId ? BigInt(payload.warehouseId) : null,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(Errors.unauthorized('Token has expired'));
    }
    return next(Errors.unauthorized('Invalid token'));
  }
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
