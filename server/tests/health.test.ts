import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Phase 1 - Foundation & Health Check', () => {
  it('GET /health should return 200 with status ok and timestamp', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'ok');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET /unknown-route should return 404 with NOT_FOUND error code', async () => {
    const res = await request(app).get('/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
