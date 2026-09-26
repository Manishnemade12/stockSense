import { Request, Response, NextFunction } from 'express';
import { CategoryService } from './categories.service.js';
import { sendSuccess, sendList } from '../../utils/response.js';

export class CategoryController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CategoryService.create(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await CategoryService.getAll(req.query as any);
      sendList(res, items, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await CategoryService.getById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await CategoryService.update(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await CategoryService.delete(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
