import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Prisma, UserRole, LocationType, OperationType, OperationStatus } from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';
import { env } from '../src/config/env.js';

vi.mock('../src/prisma/client.js', () => {
  return {
    prisma: {
      product: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      productCategory: {
        findUnique: vi.fn(),
      },
      unitOfMeasure: {
        findUnique: vi.fn(),
      },
      location: {
        findUnique: vi.fn(),
      },
      stockQuant: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      stockOperation: {
        count: vi.fn(),
        create: vi.fn(),
      },
      stockOperationLine: {
        count: vi.fn(),
      },
      stockAdjustmentLine: {
        count: vi.fn(),
        create: vi.fn(),
      },
      stockLedgerEntry: {
        create: vi.fn(),
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

describe('Phase 04 — Product Management', () => {
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

  describe('POST /products', () => {
    it('should create product with valid category and uom', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null); // SKU check
      vi.mocked(prisma.productCategory.findUnique).mockResolvedValueOnce({ id: BigInt(1) } as any);
      vi.mocked(prisma.unitOfMeasure.findUnique).mockResolvedValueOnce({ id: BigInt(1) } as any);

      vi.mocked(prisma.product.create).mockResolvedValueOnce({
        id: BigInt(10),
        name: 'Standing Desk',
        sku: 'DESK001',
        category_id: BigInt(1),
        uom_id: BigInt(1),
        unit_cost: 250.0,
        is_active: true,
        category: { id: BigInt(1), name: 'Furniture' },
        uom: { id: BigInt(1), name: 'Pieces', code: 'pcs' },
      } as any);

      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Standing Desk',
          sku: 'DESK001',
          category_id: '1',
          uom_id: '1',
          unit_cost: 250.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Standing Desk');
      expect(res.body.data.sku).toBe('DESK001');
    });

    it('should reject duplicate SKU with 409 CONFLICT', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        sku: 'DESK001',
      } as any);

      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Another Desk',
          sku: 'DESK001',
          category_id: '1',
          uom_id: '1',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('SKU');
    });

    it('should create initial opening stock adjustment when initial_stock is provided', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.productCategory.findUnique).mockResolvedValueOnce({ id: BigInt(1) } as any);
      vi.mocked(prisma.unitOfMeasure.findUnique).mockResolvedValueOnce({ id: BigInt(1) } as any);

      vi.mocked(prisma.location.findUnique).mockResolvedValueOnce({
        id: BigInt(5),
        name: 'Stock',
        code: 'STOCK',
        location_type: LocationType.INTERNAL,
        warehouse_id: BigInt(1),
        warehouse: { code: 'WH1' },
        is_active: true,
      } as any);

      vi.mocked(prisma.product.create).mockResolvedValueOnce({
        id: BigInt(10),
        name: 'Ergonomic Chair',
        sku: 'CHAIR001',
        category_id: BigInt(1),
        uom_id: BigInt(1),
        is_active: true,
      } as any);

      vi.mocked(prisma.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: BigInt(10),
        location_id: BigInt(5),
        quantity: new Prisma.Decimal(0),
        reserved_quantity: new Prisma.Decimal(0),
      } as any);
      vi.mocked(prisma.stockQuant.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.stockOperation.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.stockOperation.create).mockResolvedValueOnce({ id: BigInt(100) } as any);
      vi.mocked(prisma.stockAdjustmentLine.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Ergonomic Chair',
          sku: 'CHAIR001',
          category_id: '1',
          uom_id: '1',
          initial_stock_quantity: 50,
          initial_stock_location_id: '5',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(prisma.stockQuant.upsert).toHaveBeenCalled();
      expect(prisma.stockOperation.create).toHaveBeenCalled();
      expect(prisma.stockAdjustmentLine.create).toHaveBeenCalled();
      expect(prisma.stockLedgerEntry.create).toHaveBeenCalled();
    });

    it('should reject if only initial_stock_quantity is provided without location', async () => {
      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Chair',
          sku: 'CHAIR002',
          category_id: '1',
          uom_id: '1',
          initial_stock_quantity: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-manager users with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Desk',
          sku: 'DESK002',
          category_id: '1',
          uom_id: '1',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /products', () => {
    it('should return paginated products with category and uom', async () => {
      vi.mocked(prisma.product.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
        {
          id: BigInt(1),
          name: 'Standing Desk',
          sku: 'DESK001',
          category: { name: 'Furniture' },
          uom: { name: 'Pieces', code: 'pcs' },
          is_active: true,
        } as any,
      ]);

      const res = await request(app)
        .get('/products?search=desk&page=1&limit=20')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].sku).toBe('DESK001');
    });
  });

  describe('GET /products/:id', () => {
    it('should return single product by id with category and uom', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Standing Desk',
        sku: 'DESK001',
        category: { name: 'Furniture' },
        uom: { name: 'Pieces', code: 'pcs' },
        is_active: true,
      } as any);

      const res = await request(app)
        .get('/products/1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.name).toBe('Standing Desk');
    });

    it('should return 404 for non-existent product', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/products/999')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /products/:id/stock', () => {
    it('should return per-location stock breakdown with computed free_to_use', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        unit_cost: 250.0,
      } as any);

      vi.mocked(prisma.stockQuant.findMany).mockResolvedValueOnce([
        {
          product_id: BigInt(1),
          location_id: BigInt(10),
          quantity: 100,
          reserved_quantity: 20,
          location: { id: BigInt(10), name: 'Stock', code: 'STOCK' },
        } as any,
      ]);

      const res = await request(app)
        .get('/products/1/stock')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toEqual({
        location_id: 10,
        location_name: 'Stock',
        location_code: 'STOCK',
        unit_cost: 250,
        on_hand: 100,
        reserved_quantity: 20,
        free_to_use: 80,
      });
    });
  });

  describe('PUT /products/:id/stock/:location_id (Quick inline stock edit)', () => {
    it('should update stock quant and write adjustment operation and ledger', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        uom_id: BigInt(1),
        is_active: true,
      } as any);

      vi.mocked(prisma.location.findUnique).mockResolvedValueOnce({
        id: BigInt(10),
        location_type: LocationType.INTERNAL,
        warehouse_id: BigInt(1),
        warehouse: { code: 'WH1' },
        is_active: true,
      } as any);

      vi.mocked(prisma.stockQuant.upsert).mockResolvedValue({
        id: BigInt(1),
        product_id: BigInt(1),
        location_id: BigInt(10),
        quantity: new Prisma.Decimal(50),
        reserved_quantity: new Prisma.Decimal(10),
      } as any);
      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.stockOperation.create).mockResolvedValueOnce({ id: BigInt(200) } as any);
      vi.mocked(prisma.stockAdjustmentLine.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .put('/products/1/stock/10')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          counted_quantity: 65,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.on_hand).toBe(65);
      expect(res.body.data.free_to_use).toBe(55); // 65 - 10 reserved
      expect(prisma.stockQuant.upsert).toHaveBeenCalled();
    });
  });

  describe('PUT /products/:id', () => {
    it('should update product fields for manager', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Updated Desk Name',
        unit_cost: 300,
        category: { name: 'Furniture' },
        uom: { name: 'Pieces' },
      } as any);

      const res = await request(app)
        .put('/products/1')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Updated Desk Name',
          unit_cost: 300,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Desk Name');
    });
  });

  describe('DELETE /products/:id', () => {
    it('should soft delete product if not referenced', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.stockOperationLine.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.stockAdjustmentLine.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.stockQuant.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.product.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete('/products/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Product soft-deleted');
    });

    it('should return 409 CONFLICT if product is referenced by active operations', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
      } as any);

      vi.mocked(prisma.stockOperationLine.count).mockResolvedValueOnce(2);

      const res = await request(app)
        .delete('/products/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('referenced by active or completed operations');
    });
  });
});
