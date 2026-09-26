import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { ProductController } from './products.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateProductSchema,
  UpdateProductSchema,
  GetProductByIdSchema,
  GetProductsQuerySchema,
  QuickUpdateStockSchema,
} from './products.schema.js';

export const productRoutes = Router();

productRoutes.get(
  '/',
  authenticate,
  validate(GetProductsQuerySchema),
  ProductController.getAll
);

productRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreateProductSchema),
  ProductController.create
);

productRoutes.get(
  '/quants/all',
  authenticate,
  async (req, res, next) => {
    try {
      const { prisma } = await import('../../prisma/client.js');
      const { sendSuccess } = await import('../../utils/response.js');
      const quants = await prisma.stockQuant.findMany({
        where: { location: { is_active: true } },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit_cost: true,
              uom: { select: { code: true } },
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              code: true,
              warehouse_id: true,
              warehouse: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
        orderBy: { product_id: 'asc' },
      });

      const formatted = quants.map((q) => ({
        id: Number(q.id),
        product_id: Number(q.product_id),
        location_id: Number(q.location_id),
        quantity: Number(q.quantity),
        reserved_quantity: Number(q.reserved_quantity),
        products: q.product
          ? {
              id: Number(q.product.id),
              name: q.product.name,
              sku: q.product.sku,
              unit_cost: Number(q.product.unit_cost),
              units_of_measure: q.product.uom
                ? { code: q.product.uom.code }
                : null,
            }
          : null,
        locations: q.location
          ? {
              id: Number(q.location.id),
              name: q.location.name,
              code: q.location.code,
              warehouse_id: q.location.warehouse_id
                ? Number(q.location.warehouse_id)
                : null,
              warehouses: q.location.warehouse
                ? {
                    id: Number(q.location.warehouse.id),
                    name: q.location.warehouse.name,
                    code: q.location.warehouse.code,
                  }
                : null,
            }
          : null,
      }));

      sendSuccess(res, formatted, 200);
    } catch (err) {
      next(err);
    }
  }
);

productRoutes.get(
  '/:id',
  authenticate,
  validate(GetProductByIdSchema),
  ProductController.getById
);

productRoutes.put(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(UpdateProductSchema),
  ProductController.update
);

productRoutes.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(GetProductByIdSchema),
  ProductController.softDelete
);

productRoutes.get(
  '/:id/stock',
  authenticate,
  validate(GetProductByIdSchema),
  ProductController.getProductStock
);

productRoutes.put(
  '/:id/stock/:location_id',
  authenticate,
  validate(QuickUpdateStockSchema),
  ProductController.quickUpdateStock
);

export default productRoutes;
