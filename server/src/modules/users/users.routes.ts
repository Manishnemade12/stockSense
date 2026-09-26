import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { UsersController } from './users.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

export const userRoutes = Router();

userRoutes.use(authenticate);
userRoutes.use(requireRole(UserRole.INVENTORY_MANAGER));

userRoutes.get('/', UsersController.getAll);
userRoutes.put('/:id', UsersController.update);

export default userRoutes;
