import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { LocationController } from './locations.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateLocationSchema,
  UpdateLocationSchema,
  GetLocationByIdSchema,
  GetLocationsQuerySchema,
} from './locations.schema.js';

export const locationRoutes = Router();

locationRoutes.get(
  '/',
  authenticate,
  validate(GetLocationsQuerySchema),
  LocationController.getAll
);

locationRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreateLocationSchema),
  LocationController.create
);

locationRoutes.get(
  '/:id',
  authenticate,
  validate(GetLocationByIdSchema),
  LocationController.getById
);

locationRoutes.put(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(UpdateLocationSchema),
  LocationController.update
);

locationRoutes.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(GetLocationByIdSchema),
  LocationController.softDelete
);

export default locationRoutes;
