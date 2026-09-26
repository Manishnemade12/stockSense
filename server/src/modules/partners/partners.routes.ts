import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { PartnerController } from './partners.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  GetPartnerByIdSchema,
  GetPartnersQuerySchema,
} from './partners.schema.js';

export const partnerRoutes = Router();

partnerRoutes.get(
  '/',
  authenticate,
  validate(GetPartnersQuerySchema),
  PartnerController.getAll
);

partnerRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreatePartnerSchema),
  PartnerController.create
);

partnerRoutes.get(
  '/:id',
  authenticate,
  validate(GetPartnerByIdSchema),
  PartnerController.getById
);

partnerRoutes.put(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(UpdatePartnerSchema),
  PartnerController.update
);

partnerRoutes.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(GetPartnerByIdSchema),
  PartnerController.softDelete
);

export default partnerRoutes;
