import {
  OperationStatus,
  OperationType,
  Prisma,
  StockOperation,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import { StockService } from './stock.service.js';

export class OperationService {
  /**
   * Helper: Find operation by ID or throw 404
   */
  static async getOperationOrThrow(
    id: bigint,
    tx: Prisma.TransactionClient = prisma
  ) {
    const op = await tx.stockOperation.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            uom: true,
          },
        },
        adjustment_lines: {
          include: {
            product: true,
            location: true,
            uom: true,
          },
        },
        warehouse: true,
        source_location: true,
        destination_location: true,
        partner: true,
      },
    });

    if (!op) {
      throw Errors.notFound('Operation not found');
    }

    return op;
  }

  /**
   * Guard: assert operation is not locked (DONE or CANCELED)
   */
  static assertMutable(op: { status: OperationStatus }) {
    if (
      op.status === OperationStatus.DONE ||
      op.status === OperationStatus.CANCELED
    ) {
      throw Errors.operationLocked(
        'Operation is finalized and cannot be modified'
      );
    }
  }

  /**
   * Guard: assert operation is in READY state
   */
  static assertReady(op: { status: OperationStatus }) {
    if (op.status !== OperationStatus.READY) {
      throw Errors.invalidTransition('Operation must be READY to validate');
    }
  }

  /**
   * Guard: assert operation is in DRAFT state
   */
  static assertDraft(op: { status: OperationStatus }) {
    if (op.status !== OperationStatus.DRAFT) {
      throw Errors.invalidTransition('Operation must be in DRAFT to confirm');
    }
  }

  /**
   * Confirm an operation (DRAFT -> READY or WAITING)
   * DELIVERY / INTERNAL_TRANSFER reserve planned stock.
   */
  static async confirm(
    operationId: bigint,
    userId: bigint
  ): Promise<StockOperation> {
    return await prisma.$transaction(async (tx) => {
      const op = await this.getOperationOrThrow(operationId, tx);

      this.assertMutable(op);
      this.assertDraft(op);

      let newStatus: OperationStatus = OperationStatus.READY;

      if (
        op.operation_type === OperationType.DELIVERY ||
        op.operation_type === OperationType.INTERNAL_TRANSFER
      ) {
        if (!op.source_location_id) {
          throw Errors.badRequest('Source location is required for this operation');
        }

        let allSufficient = true;
        for (const line of op.lines) {
          const available = await StockService.getAvailable(
            tx,
            line.product_id,
            op.source_location_id
          );

          if (available.lessThan(line.quantity_planned)) {
            allSufficient = false;
          }

          // Reserve stock based on quantity_planned
          await StockService.reserve(
            tx,
            line.product_id,
            op.source_location_id,
            line.quantity_planned
          );
        }

        newStatus = allSufficient ? OperationStatus.READY : OperationStatus.WAITING;
      }

      return await tx.stockOperation.update({
        where: { id: op.id },
        data: {
          status: newStatus,
          responsible_user_id: op.responsible_user_id ?? userId,
        },
        include: {
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
          adjustment_lines: {
            include: {
              product: true,
              location: true,
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
  }

  /**
   * Validate an operation (READY -> DONE)
   * Updates physical stock_quants and creates immutable stock_ledger_entries.
   */
  static async validate(
    operationId: bigint,
    userId: bigint
  ): Promise<StockOperation> {
    return await prisma.$transaction(async (tx) => {
      const op = await this.getOperationOrThrow(operationId, tx);

      this.assertMutable(op);
      this.assertReady(op);

      if (op.operation_type === OperationType.ADJUSTMENT) {
        if (op.adjustment_lines.length === 0) {
          throw Errors.badRequest('Adjustment must contain at least one line');
        }

        for (const line of op.adjustment_lines) {
          const diff = new Prisma.Decimal(line.counted_quantity.toString()).minus(
            new Prisma.Decimal(line.recorded_quantity.toString())
          );

          if (diff.greaterThan(0)) {
            await StockService.increment(tx, line.product_id, line.location_id, diff);
            await this.writeLedgerEntry(
              tx,
              op.id,
              line.product_id,
              line.location_id,
              diff,
              op.reference_no,
              op.operation_type,
              userId
            );
          } else if (diff.lessThan(0)) {
            await StockService.decrement(
              tx,
              line.product_id,
              line.location_id,
              diff.abs()
            );
            await this.writeLedgerEntry(
              tx,
              op.id,
              line.product_id,
              line.location_id,
              diff,
              op.reference_no,
              op.operation_type,
              userId
            );
          } else {
            await this.writeLedgerEntry(
              tx,
              op.id,
              line.product_id,
              line.location_id,
              new Prisma.Decimal(0),
              op.reference_no,
              op.operation_type,
              userId
            );
          }
        }
      } else {
        if (op.lines.length === 0) {
          throw Errors.badRequest('Operation must contain at least one line');
        }

        const hasNonZeroDone = op.lines.some((line) =>
          new Prisma.Decimal(line.quantity_done.toString()).greaterThan(0)
        );

        if (!hasNonZeroDone) {
          throw Errors.allLinesZero(
            'At least one line must have quantity_done greater than 0'
          );
        }

        if (op.operation_type === OperationType.RECEIPT) {
          if (!op.destination_location_id) {
            throw Errors.badRequest(
              'Destination location is required for receipt validation'
            );
          }

          for (const line of op.lines) {
            const doneQty = new Prisma.Decimal(line.quantity_done.toString());
            if (doneQty.greaterThan(0)) {
              await StockService.increment(
                tx,
                line.product_id,
                op.destination_location_id,
                doneQty
              );
              await this.writeLedgerEntry(
                tx,
                op.id,
                line.product_id,
                op.destination_location_id,
                doneQty,
                op.reference_no,
                op.operation_type,
                userId
              );
            }
          }
        } else if (op.operation_type === OperationType.DELIVERY) {
          if (!op.source_location_id) {
            throw Errors.badRequest(
              'Source location is required for delivery validation'
            );
          }

          for (const line of op.lines) {
            const doneQty = new Prisma.Decimal(line.quantity_done.toString());
            if (doneQty.greaterThan(0)) {
              await StockService.decrement(
                tx,
                line.product_id,
                op.source_location_id,
                doneQty
              );
              await this.writeLedgerEntry(
                tx,
                op.id,
                line.product_id,
                op.source_location_id,
                doneQty.negated(),
                op.reference_no,
                op.operation_type,
                userId
              );
            }

            // Release planned reservation held during confirm
            await StockService.releaseReservation(
              tx,
              line.product_id,
              op.source_location_id,
              line.quantity_planned
            );
          }
        } else if (op.operation_type === OperationType.INTERNAL_TRANSFER) {
          if (!op.source_location_id || !op.destination_location_id) {
            throw Errors.badRequest(
              'Source and destination locations are required for internal transfer validation'
            );
          }

          for (const line of op.lines) {
            const doneQty = new Prisma.Decimal(line.quantity_done.toString());
            if (doneQty.greaterThan(0)) {
              await StockService.decrement(
                tx,
                line.product_id,
                op.source_location_id,
                doneQty
              );
              await StockService.increment(
                tx,
                line.product_id,
                op.destination_location_id,
                doneQty
              );
              await this.writeLedgerEntry(
                tx,
                op.id,
                line.product_id,
                op.source_location_id,
                doneQty.negated(),
                op.reference_no,
                op.operation_type,
                userId
              );
              await this.writeLedgerEntry(
                tx,
                op.id,
                line.product_id,
                op.destination_location_id,
                doneQty,
                op.reference_no,
                op.operation_type,
                userId
              );
            }

            // Release planned reservation
            await StockService.releaseReservation(
              tx,
              line.product_id,
              op.source_location_id,
              line.quantity_planned
            );
          }
        }
      }

      return await tx.stockOperation.update({
        where: { id: op.id },
        data: {
          status: OperationStatus.DONE,
          validated_date: new Date(),
        },
        include: {
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
          adjustment_lines: {
            include: {
              product: true,
              location: true,
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
  }

  /**
   * Cancel an operation (!DONE -> CANCELED)
   * Releases stock reservations if status was WAITING or READY.
   */
  static async cancel(
    operationId: bigint,
    userId: bigint,
    userRole?: UserRole
  ): Promise<StockOperation> {
    return await prisma.$transaction(async (tx) => {
      const op = await this.getOperationOrThrow(operationId, tx);

      if (op.status === OperationStatus.DONE) {
        throw Errors.operationLocked('Cannot cancel a completed operation');
      }

      if (userRole === UserRole.WAREHOUSE_STAFF) {
        if (
          op.status !== OperationStatus.DRAFT ||
          op.created_by !== userId
        ) {
          throw Errors.forbidden(
            'Warehouse staff can only cancel their own draft operations'
          );
        }
      }

      if (
        op.status === OperationStatus.WAITING ||
        op.status === OperationStatus.READY
      ) {
        if (
          (op.operation_type === OperationType.DELIVERY ||
            op.operation_type === OperationType.INTERNAL_TRANSFER) &&
          op.source_location_id
        ) {
          for (const line of op.lines) {
            await StockService.releaseReservation(
              tx,
              line.product_id,
              op.source_location_id,
              line.quantity_planned
            );
          }
        }
      }

      return await tx.stockOperation.update({
        where: { id: op.id },
        data: {
          status: OperationStatus.CANCELED,
        },
        include: {
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
          adjustment_lines: {
            include: {
              product: true,
              location: true,
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
  }

  /**
   * Write an immutable stock ledger entry
   */
  private static async writeLedgerEntry(
    tx: Prisma.TransactionClient,
    operationId: bigint,
    productId: bigint,
    locationId: bigint,
    quantityChange: Prisma.Decimal | number | string,
    referenceNo: string,
    operationType: OperationType,
    createdBy: bigint
  ): Promise<void> {
    const quant = await tx.stockQuant.findUnique({
      where: {
        product_id_location_id: {
          product_id: productId,
          location_id: locationId,
        },
      },
    });

    const balanceAfter = quant ? quant.quantity : new Prisma.Decimal(0);

    await tx.stockLedgerEntry.create({
      data: {
        product_id: productId,
        location_id: locationId,
        quantity_change: new Prisma.Decimal(quantityChange.toString()),
        balance_after: balanceAfter,
        operation_id: operationId,
        operation_type: operationType,
        reference_no: referenceNo,
        movement_date: new Date(),
        created_by: createdBy,
      },
    });
  }
}
