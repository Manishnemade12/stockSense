import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { sendSuccess } from '../../utils/response.js';
import { Errors } from '../../utils/errors.js';

export class UsersController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          login_id: true,
          email: true,
          full_name: true,
          role: true,
          warehouse_id: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          phone: true,
          is_verified: true,
          is_active: true,
          created_at: true,
        },
      });

      const formatted = users.map((u) => ({
        id: Number(u.id),
        login_id: u.login_id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        warehouse_id: u.warehouse_id ? Number(u.warehouse_id) : null,
        warehouse: u.warehouse
          ? {
              id: Number(u.warehouse.id),
              name: u.warehouse.name,
              code: u.warehouse.code,
            }
          : null,
        phone: u.phone,
        is_verified: u.is_verified,
        is_active: u.is_active,
        created_at: u.created_at.toISOString(),
      }));

      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const currentUserId = BigInt(req.user!.id);
      const { role, warehouse_id, is_active, full_name, phone } = req.body;

      if (id === currentUserId && role && role !== UserRole.INVENTORY_MANAGER) {
        throw Errors.forbidden('Cannot demote your own administrator account');
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          role: role as UserRole | undefined,
          warehouse_id:
            warehouse_id !== undefined
              ? warehouse_id
                ? BigInt(warehouse_id)
                : null
              : undefined,
          is_active: typeof is_active === 'boolean' ? is_active : undefined,
          full_name: full_name !== undefined ? full_name : undefined,
          phone: phone !== undefined ? phone : undefined,
        },
        select: {
          id: true,
          login_id: true,
          email: true,
          full_name: true,
          role: true,
          warehouse_id: true,
          is_active: true,
        },
      });

      sendSuccess(
        res,
        {
          id: Number(updated.id),
          login_id: updated.login_id,
          email: updated.email,
          full_name: updated.full_name,
          role: updated.role,
          warehouse_id: updated.warehouse_id ? Number(updated.warehouse_id) : null,
          is_active: updated.is_active,
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
