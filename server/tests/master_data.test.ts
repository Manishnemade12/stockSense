import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { UserRole, LocationType, PartnerType } from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';
import { env } from '../src/config/env.js';

vi.mock('../src/prisma/client.js', () => {
  return {
    prisma: {
      warehouse: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      location: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      productCategory: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      unitOfMeasure: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      partner: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
      stockOperation: {
        count: vi.fn(),
      },
      stockOperationLine: {
        count: vi.fn(),
      },
      stockAdjustmentLine: {
        count: vi.fn(),
      },
      stockQuant: {
        count: vi.fn(),
      },
      $transaction: vi.fn(async (cbOrArray) => {
        if (typeof cbOrArray === 'function') {
          return await cbOrArray(prisma);
        }
        return await Promise.all(cbOrArray);
      }),
    },
  };
});

describe('Phase 03 — Master Data', () => {
  const managerToken = jwt.sign(
    { sub: '1', role: UserRole.INVENTORY_MANAGER, warehouseId: null, type: 'ACCESS' },
    env.JWT_SECRET
  );

  const staffToken = jwt.sign(
    { sub: '2', role: UserRole.WAREHOUSE_STAFF, warehouseId: '1', type: 'ACCESS' },
    env.JWT_SECRET
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Warehouses Module', () => {
    it('POST /warehouses should create warehouse + auto-create STOCK location in transaction', async () => {
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.warehouse.create).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Main Warehouse',
        code: 'WH1',
        address: '123 Logistics Way',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.location.create).mockResolvedValueOnce({
        id: BigInt(10),
        name: 'Stock',
        code: 'STOCK',
        location_type: LocationType.INTERNAL,
        warehouse_id: BigInt(1),
        parent_location_id: null,
        is_active: true,
      } as any);

      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Main Warehouse',
          code: 'WH1',
          address: '123 Logistics Way',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Main Warehouse');
      expect(res.body.data.locations).toHaveLength(1);
      expect(res.body.data.locations[0].code).toBe('STOCK');
    });

    it('POST /warehouses should reject duplicate code with 409 CONFLICT', async () => {
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        code: 'WH1',
      } as any);

      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Main Warehouse',
          code: 'WH1',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('POST /warehouses should reject non-manager with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Main Warehouse',
          code: 'WH1',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('GET /warehouses should allow any authenticated user to list warehouses', async () => {
      vi.mocked(prisma.warehouse.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.warehouse.findMany).mockResolvedValueOnce([
        {
          id: BigInt(1),
          name: 'Main Warehouse',
          code: 'WH1',
          address: null,
          is_active: true,
          locations: [],
        } as any,
      ]);

      const res = await request(app)
        .get('/warehouses')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('DELETE /warehouses/:id should fail with 409 if referenced by active operations', async () => {
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.stockOperation.count).mockResolvedValueOnce(3); // 3 active operations

      const res = await request(app)
        .delete('/warehouses/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('active or completed operations');
    });
  });

  describe('Locations Module', () => {
    it('POST /locations with location_type=VENDOR should return 400 BAD_REQUEST', async () => {
      const res = await request(app)
        .post('/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          warehouse_id: '1',
          name: 'Vendor Loc',
          code: 'VEND',
          location_type: 'VENDOR',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only INTERNAL locations');
    });

    it('POST /locations with valid INTERNAL type should create location', async () => {
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Main WH',
        is_active: true,
      } as any);

      vi.mocked(prisma.location.findFirst).mockResolvedValueOnce(null); // uniqueness check

      vi.mocked(prisma.location.create).mockResolvedValueOnce({
        id: BigInt(2),
        warehouse_id: BigInt(1),
        name: 'Rack A',
        code: 'RACK_A',
        location_type: LocationType.INTERNAL,
        is_active: true,
      } as any);

      const res = await request(app)
        .post('/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          warehouse_id: '1',
          name: 'Rack A',
          code: 'RACK_A',
          location_type: 'INTERNAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('RACK_A');
    });

    it('GET /locations?warehouse_id=1 should filter by warehouse_id', async () => {
      vi.mocked(prisma.location.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.location.findMany).mockResolvedValueOnce([
        {
          id: BigInt(10),
          warehouse_id: BigInt(1),
          name: 'Stock',
          code: 'STOCK',
          location_type: LocationType.INTERNAL,
        } as any,
      ]);

      const res = await request(app)
        .get('/locations?warehouse_id=1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].warehouse_id).toBe(1);
    });
  });

  describe('Categories Module', () => {
    it('POST /categories should create category for manager', async () => {
      vi.mocked(prisma.productCategory.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.productCategory.create).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Electronics',
        parent_category_id: null,
      } as any);

      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Electronics',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Electronics');
    });

    it('DELETE /categories/:id should return 409 if active products reference it', async () => {
      vi.mocked(prisma.productCategory.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.product.count).mockResolvedValueOnce(5); // 5 products reference it

      const res = await request(app)
        .delete('/categories/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('active product');
    });
  });

  describe('Units of Measure Module', () => {
    it('POST /uom should create UoM for manager', async () => {
      vi.mocked(prisma.unitOfMeasure.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.unitOfMeasure.create).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Boxes',
        code: 'box',
      } as any);

      const res = await request(app)
        .post('/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Boxes',
          code: 'box',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('box');
    });

    it('POST /uom should reject duplicate code with 409 CONFLICT', async () => {
      vi.mocked(prisma.unitOfMeasure.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        code: 'pcs',
      } as any);

      const res = await request(app)
        .post('/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Pieces',
          code: 'pcs',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('DELETE /uom/:id should return 409 if products reference it', async () => {
      vi.mocked(prisma.unitOfMeasure.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.product.count).mockResolvedValueOnce(2);

      const res = await request(app)
        .delete('/uom/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('active product');
    });
  });

  describe('Partners Module', () => {
    it('POST /partners should create supplier partner for manager', async () => {
      vi.mocked(prisma.partner.create).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Acme Supplies',
        type: PartnerType.SUPPLIER,
        email: 'supplier@acme.com',
        phone: '9876543210',
        address: '456 Industrial St',
        is_active: true,
      } as any);

      const res = await request(app)
        .post('/partners')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Acme Supplies',
          type: 'SUPPLIER',
          email: 'supplier@acme.com',
          phone: '9876543210',
          address: '456 Industrial St',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Acme Supplies');
      expect(res.body.data.type).toBe('SUPPLIER');
    });

    it('GET /partners?type=SUPPLIER should return only suppliers', async () => {
      vi.mocked(prisma.partner.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.partner.findMany).mockResolvedValueOnce([
        {
          id: BigInt(1),
          name: 'Acme Supplies',
          type: PartnerType.SUPPLIER,
          is_active: true,
        } as any,
      ]);

      const res = await request(app)
        .get('/partners?type=SUPPLIER')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('SUPPLIER');
    });

    it('DELETE /partners/:id should return 409 if partner is referenced in active operations', async () => {
      vi.mocked(prisma.partner.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.stockOperation.count).mockResolvedValueOnce(1); // 1 active operation

      const res = await request(app)
        .delete('/partners/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('active or completed operations');
    });
  });
});
