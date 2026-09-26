import express, { Express, Request, Response, Router } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware.js';
import { sendSuccess, sendError } from './utils/response.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { warehouseRoutes } from './modules/warehouses/warehouses.routes.js';
import { locationRoutes } from './modules/locations/locations.routes.js';
import { categoryRoutes } from './modules/categories/categories.routes.js';
import { uomRoutes } from './modules/uom/uom.routes.js';
import { partnerRoutes } from './modules/partners/partners.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { receiptRoutes } from './modules/receipts/receipts.routes.js';
import { operationRoutes } from './modules/operations/operations.routes.js';
import { ledgerRoutes } from './modules/ledger/ledger.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { userRoutes } from './modules/users/users.routes.js';

// Polyfill BigInt serialization in JSON responses
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

export const createApp = (): Express => {
  const app = express();

  // Global middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint (Public)
  app.get('/health', (req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // API Router (Unified /api/v1 gateway)
  const apiRouter = Router();

  apiRouter.get('/health', (req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/warehouses', warehouseRoutes);
  apiRouter.use('/locations', locationRoutes);
  apiRouter.use('/categories', categoryRoutes);
  apiRouter.use('/uom', uomRoutes);
  apiRouter.use('/partners', partnerRoutes);
  apiRouter.use('/products', productRoutes);
  apiRouter.use('/receipts', receiptRoutes);
  apiRouter.use('/operations', operationRoutes);
  apiRouter.use('/stock-ledger', ledgerRoutes);
  apiRouter.use('/dashboard', dashboardRoutes);
  apiRouter.use('/users', userRoutes);

  // Mount at both /api/v1 and root for maximum flexibility
  app.use('/api/v1', apiRouter);
  app.use(apiRouter);

  // 404 Not Found handler
  app.use((req: Request, res: Response) => {
    sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;
