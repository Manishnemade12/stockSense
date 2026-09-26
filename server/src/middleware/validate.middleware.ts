import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Update req objects with parsed/coerced values
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new AppError('VALIDATION_ERROR', issues, 400));
      } else {
        next(error);
      }
    }
  };
};
