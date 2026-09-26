import { Router } from 'express';
import { LedgerController } from './ledger.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const ledgerRoutes = Router();

ledgerRoutes.use(authenticate);
ledgerRoutes.get('/', LedgerController.getEntries);

export default ledgerRoutes;
