import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { ReceiptController } from './receipts.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateReceiptSchema,
  UpdateReceiptSchema,
  GetReceiptsQuerySchema,
  ReceiptIdParamSchema,
} from './receipts.schema.js';

export const receiptRoutes = Router();

// All receipt routes require authentication
receiptRoutes.use(authenticate);

// List receipts
receiptRoutes.get(
  '/',
  validate(GetReceiptsQuerySchema),
  ReceiptController.getAll
);

// Create receipt (MANAGER only)
receiptRoutes.post(
  '/',
  requireRole(UserRole.INVENTORY_MANAGER),
  validate(CreateReceiptSchema),
  ReceiptController.create
);

// Get single receipt detail
receiptRoutes.get(
  '/:id',
  validate(ReceiptIdParamSchema),
  ReceiptController.getById
);

// Update receipt (while not locked)
receiptRoutes.put(
  '/:id',
  validate(UpdateReceiptSchema),
  ReceiptController.update
);

// State transitions
receiptRoutes.post(
  '/:id/confirm',
  validate(ReceiptIdParamSchema),
  ReceiptController.confirm
);

receiptRoutes.post(
  '/:id/validate',
  validate(ReceiptIdParamSchema),
  ReceiptController.validate
);

receiptRoutes.post(
  '/:id/cancel',
  validate(ReceiptIdParamSchema),
  ReceiptController.cancel
);

// Printable slip
receiptRoutes.get(
  '/:id/print',
  validate(ReceiptIdParamSchema),
  ReceiptController.getPrintData
);
