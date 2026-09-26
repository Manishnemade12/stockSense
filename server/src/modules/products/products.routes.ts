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
