import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { CategoryController } from './categories.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  GetCategoryByIdSchema,
  GetCategoriesQuerySchema,
} from './categories.schema.js';

export const categoryRoutes = Router();

categoryRoutes.get(
  '/',
  authenticate,
  validate(GetCategoriesQuerySchema),
  CategoryController.getAll
);

categoryRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreateCategorySchema),
  CategoryController.create
);

categoryRoutes.get(
  '/:id',
  authenticate,
  validate(GetCategoryByIdSchema),
  CategoryController.getById
);

categoryRoutes.put(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(UpdateCategorySchema),
  CategoryController.update
);

categoryRoutes.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(GetCategoryByIdSchema),
  CategoryController.delete
);

export default categoryRoutes;
