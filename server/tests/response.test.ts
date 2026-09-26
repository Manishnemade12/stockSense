import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { sendSuccess, sendList, sendError } from '../src/utils/response.js';

describe('Phase 1 - Response Envelope & BigInt Serialization', () => {
  // Ensure BigInt polyfill is present
  (BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
    return Number(this);
  };

  const app = express();
  app.use(express.json());

  app.get('/single-object', (req: Request, res: Response) => {
    sendSuccess(res, { id: BigInt(12345), name: 'Sample Item' });
  });

  app.get('/list-objects', (req: Request, res: Response) => {
    sendList(
      res,
      [
        { id: BigInt(1), name: 'Item 1' },
        { id: BigInt(2), name: 'Item 2' },
      ],
      { page: 1, limit: 20, total: 2 }
    );
  });

  app.get('/custom-error', (req: Request, res: Response) => {
    sendError(res, 'CUSTOM_CODE', 'A custom failure message', 422);
  });

  it('sendSuccess should serialize BigInt IDs as numbers without throwing', async () => {
    const res = await request(app).get('/single-object');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: 12345,
        name: 'Sample Item',
      },
    });
  });

  it('sendList should serialize lists with pagination metadata', async () => {
    const res = await request(app).get('/list-objects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 2,
      },
    });
  });

  it('sendError should return standardized error envelope', async () => {
    const res = await request(app).get('/custom-error');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'CUSTOM_CODE',
        message: 'A custom failure message',
      },
    });
  });
});
