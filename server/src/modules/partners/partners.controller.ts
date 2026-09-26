import { Request, Response, NextFunction } from 'express';
import { PartnerService } from './partners.service.js';
import { sendSuccess, sendList } from '../../utils/response.js';

export class PartnerController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PartnerService.create(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await PartnerService.getAll(req.query as any);
      sendList(res, items, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await PartnerService.getById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await PartnerService.update(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await PartnerService.softDelete(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
