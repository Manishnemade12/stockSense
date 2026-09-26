import { Request, Response, NextFunction } from 'express';
import { ReceiptService } from './receipts.service.js';
import { sendSuccess, sendList } from '../../utils/response.js';

export class ReceiptController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ReceiptService.create(req.body, req.user!.userId);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await ReceiptService.getAll(req.query as any, req.user!);
      sendList(res, items, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ReceiptService.getById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ReceiptService.update(id, req.body, req.user!.userId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ReceiptService.confirm(id, req.user!.userId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ReceiptService.validate(id, req.user!.userId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ReceiptService.cancel(
        id,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getPrintData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await ReceiptService.getPrintData(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
