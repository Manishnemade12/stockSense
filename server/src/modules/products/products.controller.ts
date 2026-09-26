import { Request, Response, NextFunction } from 'express';
import { ProductService } from './products.service.js';
import { sendSuccess, sendList } from '../../utils/response.js';

export class ProductController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProductService.create(req.body, req.user!.userId);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await ProductService.getAll(req.query as any);
      sendList(res, items, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ProductService.getById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ProductService.update(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ProductService.softDelete(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getProductStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = BigInt(req.params.id);
      const result = await ProductService.getProductStock(productId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async quickUpdateStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = BigInt(req.params.id);
      const locationId = BigInt(req.params.location_id);
      const { counted_quantity } = req.body;
      const result = await ProductService.quickUpdateStock(
        productId,
        locationId,
        counted_quantity,
        req.user!.userId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
