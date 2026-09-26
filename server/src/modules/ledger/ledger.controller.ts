import { Request, Response, NextFunction } from 'express';
import { Prisma, OperationType } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { sendSuccess } from '../../utils/response.js';

export class LedgerController {
  static async getEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const where: Prisma.StockLedgerEntryWhereInput = {};

      if (req.query.product_id) {
        where.product_id = BigInt(req.query.product_id as string);
      }

      if (req.query.location_id) {
        where.location_id = BigInt(req.query.location_id as string);
      }

      if (req.query.operation_type) {
        where.operation_type = req.query.operation_type as OperationType;
      }

      if (req.query.date_from || req.query.date_to) {
        where.movement_date = {};
        if (req.query.date_from) {
          where.movement_date.gte = new Date(req.query.date_from as string);
        }
        if (req.query.date_to) {
          where.movement_date.lte = new Date(req.query.date_to as string);
        }
      }

      if (req.query.search) {
        const search = String(req.query.search);
        where.OR = [
          { reference_no: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [total, entries] = await Promise.all([
        prisma.stockLedgerEntry.count({ where }),
        prisma.stockLedgerEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { movement_date: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
                code: true,
                warehouse_id: true,
                warehouse: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                login_id: true,
                full_name: true,
              },
            },
            operation: {
              select: {
                id: true,
                reference_no: true,
                source_location: { select: { id: true, name: true, code: true } },
                destination_location: { select: { id: true, name: true, code: true } },
                partner: { select: { id: true, name: true } },
              },
            },
          },
        }),
      ]);

      const formatted = entries.map((entry) => ({
        id: Number(entry.id),
        reference_no: entry.reference_no,
        operation_id: Number(entry.operation_id),
        operation_type: entry.operation_type,
        product_id: Number(entry.product_id),
        product_name: entry.product.name,
        product_sku: entry.product.sku,
        location_id: Number(entry.location_id),
        location_name: entry.location.name,
        location_code: entry.location.code,
        warehouse_id: entry.location.warehouse_id ? Number(entry.location.warehouse_id) : null,
        warehouse_name: entry.location.warehouse?.name ?? 'Central',
        quantity_change: Number(entry.quantity_change),
        balance_after: Number(entry.balance_after),
        from_location:
          entry.operation?.source_location?.name ||
          (entry.operation_type === 'RECEIPT' ? entry.operation?.partner?.name || 'Vendor' : '—'),
        to_location:
          entry.operation?.destination_location?.name ||
          (entry.operation_type === 'DELIVERY' ? entry.operation?.partner?.name || 'Customer' : '—'),
        movement_date: entry.movement_date.toISOString(),
        created_by: Number(entry.created_by),
        user_name: entry.user.full_name || entry.user.login_id,
      }));

      sendSuccess(res, formatted, 200, {
        page,
        limit,
        total,
      });
    } catch (error) {
      next(error);
    }
  }
}
