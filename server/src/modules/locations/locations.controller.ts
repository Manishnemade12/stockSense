import { Request, Response, NextFunction } from 'express';
import { LocationService } from './locations.service.js';
import { sendSuccess, sendList } from '../../utils/response.js';

export class LocationController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LocationService.create(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await LocationService.getAll(req.query as any);
      sendList(res, items, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await LocationService.getById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await LocationService.update(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await LocationService.softDelete(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
