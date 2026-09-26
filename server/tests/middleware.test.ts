import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.middleware.js';
import { errorHandler } from '../src/middleware/error.middleware.js';
import { AppError, Errors } from '../src/utils/errors.js';
import { sendSuccess } from '../src/utils/response.js';

describe('Phase 1 - Middleware & Error Handling', () => {
  const createTestApp = () => {
    const testApp = express();
    testApp.use(express.json());

    // Validation test endpoint
    const sampleSchema = z.object({
      body: z.object({
        name: z.string().min(3),
        quantity: z.number().positive(),
      }),
    });

    testApp.post('/test-validate', validate(sampleSchema), (req: Request, res: Response) => {
      sendSuccess(res, { received: req.body });
    });

    // Custom error test endpoints
    testApp.get('/test-conflict', () => {
      throw Errors.conflict('Resource already exists');
    });

    testApp.get('/test-forbidden', () => {
      throw Errors.forbidden('Access denied');
    });

    testApp.get('/test-stock-error', () => {
      throw Errors.insufficientStock();
    });

    testApp.use(errorHandler);
    return testApp;
  };

  const app = createTestApp();

  it('validate middleware should pass valid data', async () => {
    const res = await request(app)
      .post('/test-validate')
      .send({ name: 'Widget', quantity: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toEqual({ name: 'Widget', quantity: 10 });
  });

  it('validate middleware should return 400 with VALIDATION_ERROR on invalid data', async () => {
    const res = await request(app)
      .post('/test-validate')
      .send({ name: 'AB', quantity: -5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('errorHandler should format AppError(CONFLICT) as 409', async () => {
    const res = await request(app).get('/test-conflict');

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Resource already exists');
  });

  it('errorHandler should format AppError(FORBIDDEN) as 403', async () => {
    const res = await request(app).get('/test-forbidden');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('errorHandler should format AppError(INSUFFICIENT_STOCK) as 422', async () => {
    const res = await request(app).get('/test-stock-error');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });
});
