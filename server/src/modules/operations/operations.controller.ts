import { Request, Response, NextFunction } from 'express';
import { OperationStatus, OperationType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { sendSuccess } from '../../utils/response.js';
import { Errors } from '../../utils/errors.js';
import { OperationService } from './operation.service.js';
import { ReferenceService } from './reference.service.js';
import { StockService } from './stock.service.js';
import {
  CreateOperationInput,
  UpdateOperationInput,
  GetOperationsQuery,
} from './operations.schema.js';

export class OperationController {
  /**
   * Helper: Format single operation output
   */
  private static async formatOperation(op: any, tx: Prisma.TransactionClient = prisma) {
    const isLate =
      op.scheduled_date &&
      new Date(op.scheduled_date) < new Date() &&
      op.status !== OperationStatus.DONE &&
      op.status !== OperationStatus.CANCELED;

    const formattedLines = [];
    if (op.lines && op.lines.length > 0) {
      for (const line of op.lines) {
        let availableAtSource: number | null = null;
        let isShort = false;

        if (
          op.source_location_id &&
          (op.operation_type === OperationType.DELIVERY ||
            op.operation_type === OperationType.INTERNAL_TRANSFER)
        ) {
          const availDecimal = await StockService.getAvailable(
            tx,
            line.product_id,
            op.source_location_id
          );
          availableAtSource = Number(availDecimal);
          const planned = Number(line.quantity_planned);
          isShort = availableAtSource < planned;
        }

        formattedLines.push({
          id: Number(line.id),
          product_id: Number(line.product_id),
          product: line.product
            ? {
                id: Number(line.product.id),
                name: line.product.name,
                sku: line.product.sku,
              }
            : undefined,
          uom_id: line.uom_id ? Number(line.uom_id) : undefined,
          uom: line.uom
            ? {
                id: Number(line.uom.id),
                name: line.uom.name,
                code: line.uom.code,
              }
            : undefined,
          quantity_planned: Number(line.quantity_planned),
          quantity_done: Number(line.quantity_done),
          notes: line.notes,
          available_at_source: availableAtSource,
          is_short: isShort,
        });
      }
    }

    return {
      id: Number(op.id),
      reference_no: op.reference_no,
      operation_type: op.operation_type,
      status: op.status,
      warehouse_id: Number(op.warehouse_id),
      warehouse: op.warehouse
        ? {
            id: Number(op.warehouse.id),
            name: op.warehouse.name,
            code: op.warehouse.code,
          }
        : undefined,
      source_location_id: op.source_location_id ? Number(op.source_location_id) : null,
      source_location: op.source_location
        ? {
            id: Number(op.source_location.id),
            name: op.source_location.name,
            code: op.source_location.code,
          }
        : null,
      destination_location_id: op.destination_location_id
        ? Number(op.destination_location_id)
        : null,
      destination_location: op.destination_location
        ? {
            id: Number(op.destination_location.id),
            name: op.destination_location.name,
            code: op.destination_location.code,
          }
        : null,
      partner_id: op.partner_id ? Number(op.partner_id) : null,
      partner: op.partner
        ? {
            id: Number(op.partner.id),
            name: op.partner.name,
            type: op.partner.type,
          }
        : null,
      scheduled_date: op.scheduled_date ? op.scheduled_date.toISOString() : null,
      validated_date: op.validated_date ? op.validated_date.toISOString() : null,
      created_by: Number(op.created_by),
      responsible_user_id: op.responsible_user_id ? Number(op.responsible_user_id) : null,
      notes: op.notes,
      is_late: isLate,
      created_at: op.created_at ? op.created_at.toISOString() : null,
      updated_at: op.updated_at ? op.updated_at.toISOString() : null,
      lines: formattedLines,
    };
  }

  /**
   * GET /operations - List with filtering
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetOperationsQuery;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const skip = (page - 1) * limit;

      const where: Prisma.StockOperationWhereInput = {};

      const opType = query.type || query.operation_type;
      if (opType) {
        where.operation_type = opType;
      }

      if (query.status && query.status !== 'ALL') {
        where.status = query.status as OperationStatus;
      }

      if (query.warehouse_id) {
        where.warehouse_id = BigInt(query.warehouse_id);
      }

      if (query.search) {
        where.OR = [
          { reference_no: { contains: query.search, mode: 'insensitive' } },
          { partner: { name: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      const [total, ops] = await Promise.all([
        prisma.stockOperation.count({ where }),
        prisma.stockOperation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            lines: {
              include: {
                product: true,
                uom: true,
              },
            },
            warehouse: true,
            source_location: true,
            destination_location: true,
            partner: true,
          },
        }),
      ]);

      const formatted = await Promise.all(
        ops.map((op) => OperationController.formatOperation(op))
      );

      sendSuccess(
        res,
        formatted,
        200,
        {
          page,
          limit,
          total,
        }
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /operations/:id - Get single operation
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const op = await OperationService.getOperationOrThrow(id);
      const formatted = await OperationController.formatOperation(op);
      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /operations - Create an operation
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.body as CreateOperationInput;
      const userId = BigInt(req.user!.id);
      const warehouseId = BigInt(dto.warehouse_id);

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) {
        throw Errors.notFound('Warehouse not found');
      }

      const created = await prisma.$transaction(async (tx) => {
        const referenceNo = await ReferenceService.generate(
          tx,
          warehouse.code,
          dto.operation_type
        );

        const op = await tx.stockOperation.create({
          data: {
            reference_no: referenceNo,
            operation_type: dto.operation_type,
            status: OperationStatus.DRAFT,
            warehouse_id: warehouseId,
            partner_id: dto.partner_id ? BigInt(dto.partner_id) : null,
            source_location_id: dto.source_location_id
              ? BigInt(dto.source_location_id)
              : null,
            destination_location_id: dto.destination_location_id
              ? BigInt(dto.destination_location_id)
              : null,
            responsible_user_id: dto.responsible_user_id
              ? BigInt(dto.responsible_user_id)
              : userId,
            scheduled_date: dto.scheduled_date ? new Date(dto.scheduled_date) : null,
            notes: dto.notes,
            created_by: userId,
            lines: {
              create: dto.lines.map((line) => ({
                product_id: BigInt(line.product_id),
                uom_id: line.uom_id ? BigInt(line.uom_id) : null,
                quantity_planned: new Prisma.Decimal(line.quantity_planned ?? 1),
                quantity_done: new Prisma.Decimal(line.quantity_done ?? 0),
                notes: line.notes,
              })),
            },
          },
          include: {
            lines: {
              include: {
                product: true,
                uom: true,
              },
            },
            warehouse: true,
            source_location: true,
            destination_location: true,
            partner: true,
          },
        });

        return op;
      });

      const formatted = await OperationController.formatOperation(created);
      sendSuccess(res, formatted, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /operations/:id - Update operation and lines
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const dto = req.body as UpdateOperationInput;

      const existing = await OperationService.getOperationOrThrow(id);
      OperationService.assertMutable(existing);

      const updated = await prisma.$transaction(async (tx) => {
        if (dto.lines && dto.lines.length > 0) {
          await tx.stockOperationLine.deleteMany({
            where: { operation_id: id },
          });

          await tx.stockOperationLine.createMany({
            data: dto.lines.map((l) => ({
              operation_id: id,
              product_id: BigInt(l.product_id),
              uom_id: l.uom_id ? BigInt(l.uom_id) : null,
              quantity_planned: new Prisma.Decimal(l.quantity_planned ?? 1),
              quantity_done: new Prisma.Decimal(l.quantity_done ?? 0),
              notes: l.notes,
            })),
          });
        }

        return await tx.stockOperation.update({
          where: { id },
          data: {
            partner_id:
              dto.partner_id !== undefined
                ? dto.partner_id
                  ? BigInt(dto.partner_id)
                  : null
                : undefined,
            source_location_id:
              dto.source_location_id !== undefined
                ? dto.source_location_id
                  ? BigInt(dto.source_location_id)
                  : null
                : undefined,
            destination_location_id:
              dto.destination_location_id !== undefined
                ? dto.destination_location_id
                  ? BigInt(dto.destination_location_id)
                  : null
                : undefined,
            scheduled_date: dto.scheduled_date
              ? new Date(dto.scheduled_date)
              : undefined,
            notes: dto.notes !== undefined ? dto.notes : undefined,
          },
          include: {
            lines: {
              include: {
                product: true,
                uom: true,
              },
            },
            warehouse: true,
            source_location: true,
            destination_location: true,
            partner: true,
          },
        });
      });

      const formatted = await OperationController.formatOperation(updated);
      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /operations/:id/confirm
   */
  static async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const userId = BigInt(req.user!.id);
      const result = await OperationService.confirm(id, userId);
      const formatted = await OperationController.formatOperation(result);
      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /operations/:id/validate
   */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const userId = BigInt(req.user!.id);
      const result = await OperationService.validate(id, userId);
      const formatted = await OperationController.formatOperation(result);
      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /operations/:id/cancel
   */
  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const userId = BigInt(req.user!.id);
      const userRole = req.user!.role;
      const result = await OperationService.cancel(id, userId, userRole);
      const formatted = await OperationController.formatOperation(result);
      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /operations/:id/print
   */
  static async getPrintData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const op = await OperationService.getOperationOrThrow(id);
      const formatted = await OperationController.formatOperation(op);
      sendSuccess(res, formatted, 200);
    } catch (error) {
      next(error);
    }
  }
}
