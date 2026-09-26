import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { WarehouseController } from './warehouses.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  GetWarehouseByIdSchema,
  GetWarehousesQuerySchema,
} from './warehouses.schema.js';

export const warehouseRoutes = Router();

warehouseRoutes.get(
  '/',
  authenticate,
  validate(GetWarehousesQuerySchema),
  WarehouseController.getAll
);

warehouseRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreateWarehouseSchema),
  WarehouseController.create
);

warehouseRoutes.get(
  '/:id',
  authenticate,
  validate(GetWarehouseByIdSchema),
  WarehouseController.getById
);

warehouseRoutes.put(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(UpdateWarehouseSchema),
  WarehouseController.update
);

warehouseRoutes.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(GetWarehouseByIdSchema),
  WarehouseController.softDelete
);

export default warehouseRoutes;
