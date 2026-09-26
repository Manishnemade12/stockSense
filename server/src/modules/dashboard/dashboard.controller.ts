import { Request, Response, NextFunction } from 'express';
import { OperationStatus, OperationType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { sendSuccess } from '../../utils/response.js';

export class DashboardController {
  static async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId = req.query.warehouse_id
        ? BigInt(req.query.warehouse_id as string)
        : undefined;

      const now = new Date();

      // 1. Product counts
      const [totalProducts, allProducts] = await Promise.all([
        prisma.product.count({ where: { is_active: true } }),
        prisma.product.findMany({
          where: { is_active: true },
          select: {
            id: true,
            reorder_min_qty: true,
            stock_quants: {
              where: warehouseId
                ? { location: { warehouse_id: warehouseId } }
                : undefined,
              select: {
                quantity: true,
                reserved_quantity: true,
              },
            },
          },
        }),
      ]);

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalOnHand = 0;
      let totalReserved = 0;

      for (const p of allProducts) {
        let pQty = 0;
        let pRes = 0;
        for (const q of p.stock_quants) {
          pQty += Number(q.quantity);
          pRes += Number(q.reserved_quantity);
        }
        totalOnHand += pQty;
        totalReserved += pRes;

        const pFree = pQty - pRes;
        if (pFree <= 0) {
          outOfStockCount++;
        } else if (p.reorder_min_qty && pFree <= Number(p.reorder_min_qty)) {
          lowStockCount++;
        }
      }

      // 2. Receipts KPIs
      const receiptWhere: Prisma.StockOperationWhereInput = {
        operation_type: OperationType.RECEIPT,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      };

      const [receiptTotal, receiptReady, receiptLate] = await Promise.all([
        prisma.stockOperation.count({ where: receiptWhere }),
        prisma.stockOperation.count({
          where: { ...receiptWhere, status: OperationStatus.READY },
        }),
        prisma.stockOperation.count({
          where: {
            ...receiptWhere,
            scheduled_date: { lt: now },
            status: { notIn: [OperationStatus.DONE, OperationStatus.CANCELED] },
          },
        }),
      ]);

      // 3. Deliveries KPIs
      const deliveryWhere: Prisma.StockOperationWhereInput = {
        operation_type: OperationType.DELIVERY,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      };

      const [deliveryTotal, deliveryReady, deliveryWaiting, deliveryLate] =
        await Promise.all([
          prisma.stockOperation.count({ where: deliveryWhere }),
          prisma.stockOperation.count({
            where: { ...deliveryWhere, status: OperationStatus.READY },
          }),
          prisma.stockOperation.count({
            where: { ...deliveryWhere, status: OperationStatus.WAITING },
          }),
          prisma.stockOperation.count({
            where: {
              ...deliveryWhere,
              scheduled_date: { lt: now },
              status: { notIn: [OperationStatus.DONE, OperationStatus.CANCELED] },
            },
          }),
        ]);

      // 4. Internal Transfers scheduled
      const transfersScheduled = await prisma.stockOperation.count({
        where: {
          operation_type: OperationType.INTERNAL_TRANSFER,
          status: { in: [OperationStatus.DRAFT, OperationStatus.WAITING, OperationStatus.READY] },
          ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        },
      });

      const kpis = {
        total_products: totalProducts,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        receipts: {
          total: receiptTotal,
          ready_count: receiptReady,
          late: receiptLate,
        },
        deliveries: {
          total: deliveryTotal,
          ready_count: deliveryReady,
          waiting: deliveryWaiting,
          late: deliveryLate,
        },
        transfers_scheduled: transfersScheduled,
        stock_summary: {
          on_hand: totalOnHand,
          reserved: totalReserved,
          free_to_use: Math.max(0, totalOnHand - totalReserved),
        },
      };

      sendSuccess(res, kpis, 200);
    } catch (error) {
      next(error);
    }
  }
}
