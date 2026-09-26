import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { UomController } from './uom.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateUomSchema,
  UpdateUomSchema,
  GetUomByIdSchema,
  GetUomQuerySchema,
} from './uom.schema.js';

export const uomRoutes = Router();

uomRoutes.get(
  '/',
  authenticate,
  validate(GetUomQuerySchema),
  UomController.getAll
);

uomRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreateUomSchema),
  UomController.create
);

uomRoutes.get(
  '/:id',
  authenticate,
  validate(GetUomByIdSchema),
  UomController.getById
);

uomRoutes.put(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(UpdateUomSchema),
  UomController.update
);

uomRoutes.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(GetUomByIdSchema),
  UomController.delete
);

export default uomRoutes;
