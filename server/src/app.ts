import express, { Express, Request, Response, NextFunction } from 'express';
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

  // Feature routes
  app.use('/auth', authRoutes);
  app.use('/warehouses', warehouseRoutes);
  app.use('/locations', locationRoutes);
  app.use('/categories', categoryRoutes);
  app.use('/uom', uomRoutes);
  app.use('/partners', partnerRoutes);
  app.use('/products', productRoutes);
  app.use('/receipts', receiptRoutes);
  // app.use('/deliveries', deliveryRoutes);
  // app.use('/transfers', transferRoutes);
  // app.use('/adjustments', adjustmentRoutes);
  // app.use('/stock-ledger', stockLedgerRoutes);
  // app.use('/dashboard', dashboardRoutes);
  // app.use('/profile', profileRoutes);

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
