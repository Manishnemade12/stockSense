import { Router } from 'express';
import { OperationController } from './operations.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  CreateOperationSchema,
  UpdateOperationSchema,
  GetOperationsQuerySchema,
  OperationIdParamSchema,
} from './operations.schema.js';

export const operationRoutes = Router();

operationRoutes.use(authenticate);

// List operations
operationRoutes.get(
  '/',
  validate(GetOperationsQuerySchema),
  OperationController.getAll
);

// Create operation
operationRoutes.post(
  '/',
  validate(CreateOperationSchema),
  OperationController.create
);

// Get single operation
operationRoutes.get(
  '/:id',
  validate(OperationIdParamSchema),
  OperationController.getById
);

// Update operation lines & header
operationRoutes.put(
  '/:id',
  validate(UpdateOperationSchema),
  OperationController.update
);

// State transitions
operationRoutes.post(
  '/:id/confirm',
  validate(OperationIdParamSchema),
  OperationController.confirm
);

operationRoutes.post(
  '/:id/validate',
  validate(OperationIdParamSchema),
  OperationController.validate
);

operationRoutes.post(
  '/:id/cancel',
  validate(OperationIdParamSchema),
  OperationController.cancel
);

// Printable slip
operationRoutes.get(
  '/:id/print',
  validate(OperationIdParamSchema),
  OperationController.getPrintData
);

export default operationRoutes;
