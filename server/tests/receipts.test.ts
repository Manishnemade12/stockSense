import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  LocationType,
  OperationStatus,
  OperationType,
  PartnerType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';
import { env } from '../src/config/env.js';

vi.mock('../src/prisma/client.js', () => {
  return {
    prisma: {
      partner: {
        findUnique: vi.fn(),
      },
      warehouse: {
        findUnique: vi.fn(),
      },
      location: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
      unitOfMeasure: {
        findUnique: vi.fn(),
      },
      stockOperation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      stockOperationLine: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
      },
      stockQuant: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
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

describe('Phase 07 — Receipts', () => {
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

  describe('POST /receipts', () => {
    it('should create receipt in DRAFT status with generated reference number and vendor virtual location', async () => {
      // 1. Partner
      vi.mocked(prisma.partner.findUnique).mockResolvedValueOnce({
        id: BigInt(10),
        name: 'Supplier Co',
        type: PartnerType.SUPPLIER,
        is_active: true,
      } as any);

      // 2. Warehouse
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Main Warehouse',
        code: 'WH1',
        is_active: true,
      } as any);

      // 3. Destination location
      vi.mocked(prisma.location.findUnique).mockResolvedValueOnce({
        id: BigInt(5),
        name: 'Stock',
        code: 'STOCK',
        location_type: LocationType.INTERNAL,
        warehouse_id: BigInt(1),
        is_active: true,
      } as any);

      // 4. Products & UOM
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: BigInt(100),
        name: 'Steel Rods',
        sku: 'STL001',
        is_active: true,
      } as any);
      vi.mocked(prisma.unitOfMeasure.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Kilograms',
        code: 'kg',
      } as any);

      // 5. Vendor location
      vi.mocked(prisma.location.findFirst).mockResolvedValueOnce({
        id: BigInt(99),
        name: 'Vendor',
        code: 'VENDOR',
        location_type: LocationType.VENDOR,
      } as any);

      // 6. Reference seq
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce(null);

      // 7. Create operation
      vi.mocked(prisma.stockOperation.create).mockResolvedValueOnce({
        id: BigInt(1),
        reference_no: 'WH1/IN/0001',
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DRAFT,
        warehouse_id: BigInt(1),
        source_location_id: BigInt(99),
        destination_location_id: BigInt(5),
        partner_id: BigInt(10),
        scheduled_date: new Date('2026-10-01T10:00:00.000Z'),
        created_by: BigInt(1),
        responsible_user_id: BigInt(1),
        notes: 'Monthly replenishment',
        warehouse: { id: BigInt(1), name: 'Main Warehouse', code: 'WH1' },
        partner: { id: BigInt(10), name: 'Supplier Co', type: PartnerType.SUPPLIER },
        source_location: { id: BigInt(99), name: 'Vendor', code: 'VENDOR' },
        destination_location: { id: BigInt(5), name: 'Stock', code: 'STOCK' },
        lines: [
          {
            id: BigInt(1001),
            product_id: BigInt(100),
            uom_id: BigInt(1),
            quantity_planned: new Prisma.Decimal(50),
            quantity_done: new Prisma.Decimal(0),
            product: { id: BigInt(100), name: 'Steel Rods', sku: 'STL001' },
            uom: { id: BigInt(1), name: 'Kilograms', code: 'kg' },
          },
        ],
      } as any);

      const res = await request(app)
        .post('/receipts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          partner_id: '10',
          warehouse_id: '1',
          destination_location_id: '5',
          scheduled_date: '2026-10-01T10:00:00.000Z',
          notes: 'Monthly replenishment',
          lines: [
            {
              product_id: '100',
              uom_id: '1',
              quantity_planned: 50,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reference_no).toBe('WH1/IN/0001');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.lines).toHaveLength(1);
      expect(res.body.data.lines[0].available_at_source).toBeNull();
      expect(res.body.data.lines[0].is_short).toBe(false);
    });

    it('should reject non-manager users with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/receipts')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          partner_id: '10',
          warehouse_id: '1',
          destination_location_id: '5',
          scheduled_date: '2026-10-01T10:00:00.000Z',
          lines: [
            {
              product_id: '100',
              uom_id: '1',
              quantity_planned: 50,
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject destination location not belonging to warehouse', async () => {
      vi.mocked(prisma.partner.findUnique).mockResolvedValueOnce({ id: BigInt(10), is_active: true } as any);
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValueOnce({ id: BigInt(1), is_active: true } as any);
      vi.mocked(prisma.location.findUnique).mockResolvedValueOnce({
        id: BigInt(5),
        location_type: LocationType.INTERNAL,
        warehouse_id: BigInt(2), // belongs to warehouse 2
        is_active: true,
      } as any);

      const res = await request(app)
        .post('/receipts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          partner_id: '10',
          warehouse_id: '1',
          destination_location_id: '5',
          scheduled_date: '2026-10-01T10:00:00.000Z',
          lines: [{ product_id: '100', uom_id: '1', quantity_planned: 50 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /receipts', () => {
    it('should return paginated list of receipts with computed is_late', async () => {
      vi.mocked(prisma.stockOperation.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.stockOperation.findMany).mockResolvedValueOnce([
        {
          id: BigInt(1),
          reference_no: 'WH1/IN/0001',
          operation_type: OperationType.RECEIPT,
          status: OperationStatus.DRAFT,
          scheduled_date: new Date('2020-01-01T00:00:00.000Z'), // in the past -> is_late = true
          warehouse: { id: BigInt(1), name: 'Main Warehouse', code: 'WH1' },
          partner: { id: BigInt(10), name: 'Supplier Co' },
          source_location: { id: BigInt(99), name: 'Vendor', code: 'VENDOR' },
          destination_location: { id: BigInt(5), name: 'Stock', code: 'STOCK' },
          lines: [{ id: BigInt(1) }],
        } as any,
      ]);

      const res = await request(app)
        .get('/receipts?page=1&limit=20')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].is_late).toBe(true);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('GET /receipts/:id', () => {
    it('should return full receipt details with lines and is_short=false', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        reference_no: 'WH1/IN/0001',
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DRAFT,
        scheduled_date: new Date('2030-01-01T00:00:00.000Z'),
        warehouse: { id: BigInt(1), name: 'Main Warehouse', code: 'WH1' },
        partner: { id: BigInt(10), name: 'Supplier Co' },
        lines: [
          {
            id: BigInt(1001),
            product_id: BigInt(100),
            uom_id: BigInt(1),
            quantity_planned: new Prisma.Decimal(50),
            quantity_done: new Prisma.Decimal(0),
            product: { id: BigInt(100), name: 'Steel Rods', sku: 'STL001' },
            uom: { id: BigInt(1), name: 'Kilograms', code: 'kg' },
          },
        ],
      } as any);

      const res = await request(app)
        .get('/receipts/1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.lines[0].is_short).toBe(false);
      expect(res.body.data.lines[0].available_at_source).toBeNull();
      expect(res.body.data.is_late).toBe(false);
    });

    it('should return 404 for non-existent receipt', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/receipts/999')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /receipts/:id', () => {
    it('should update receipt notes and lines when in DRAFT', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DRAFT,
        lines: [{ id: BigInt(10) }],
      } as any);

      vi.mocked(prisma.stockOperationLine.deleteMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.stockOperationLine.createMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValueOnce({
        id: BigInt(1),
        notes: 'Updated note',
        status: OperationStatus.DRAFT,
        lines: [
          {
            id: BigInt(11),
            product_id: BigInt(100),
            uom_id: BigInt(1),
            quantity_planned: new Prisma.Decimal(60),
            quantity_done: new Prisma.Decimal(0),
          },
        ],
      } as any);

      const res = await request(app)
        .put('/receipts/1')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          notes: 'Updated note',
          lines: [
            {
              product_id: '100',
              uom_id: '1',
              quantity_planned: 60,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.stockOperationLine.deleteMany).toHaveBeenCalled();
    });

    it('should reject updating a DONE receipt with OPERATION_LOCKED', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DONE,
      } as any);

      const res = await request(app)
        .put('/receipts/1')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          notes: 'Change note',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('OPERATION_LOCKED');
    });
  });

  describe('State Transitions & Print', () => {
    it('POST /receipts/:id/confirm should transition DRAFT to READY', async () => {
      vi.mocked(prisma.stockOperation.findFirst)
        .mockResolvedValueOnce({
          id: BigInt(1),
          operation_type: OperationType.RECEIPT,
          status: OperationStatus.DRAFT,
        } as any)
        .mockResolvedValueOnce({
          id: BigInt(1),
          operation_type: OperationType.RECEIPT,
          status: OperationStatus.READY,
          lines: [],
        } as any);

      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DRAFT,
        lines: [],
        adjustment_lines: [],
      } as any);

      vi.mocked(prisma.stockOperation.update).mockResolvedValueOnce({
        id: BigInt(1),
        status: OperationStatus.READY,
      } as any);

      const res = await request(app)
        .post('/receipts/1/confirm')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('READY');
    });

    it('POST /receipts/:id/validate should transition READY to DONE and update stock', async () => {
      vi.mocked(prisma.stockOperation.findFirst)
        .mockResolvedValueOnce({
          id: BigInt(1),
          operation_type: OperationType.RECEIPT,
          status: OperationStatus.READY,
        } as any)
        .mockResolvedValueOnce({
          id: BigInt(1),
          operation_type: OperationType.RECEIPT,
          status: OperationStatus.DONE,
          lines: [
            {
              id: BigInt(1001),
              product_id: BigInt(5),
              quantity_planned: new Prisma.Decimal(50),
              quantity_done: new Prisma.Decimal(50),
            },
          ],
        } as any);

      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        reference_no: 'WH1/IN/0001',
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.READY,
        destination_location_id: BigInt(20),
        lines: [
          {
            id: BigInt(1001),
            product_id: BigInt(5),
            quantity_planned: new Prisma.Decimal(50),
            quantity_done: new Prisma.Decimal(50),
          },
        ],
        adjustment_lines: [],
      } as any);

      vi.mocked(prisma.stockQuant.upsert).mockResolvedValue({
        product_id: BigInt(5),
        location_id: BigInt(20),
        quantity: new Prisma.Decimal(0),
        reserved_quantity: new Prisma.Decimal(0),
      } as any);
      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockQuant.findUnique).mockResolvedValue({
        product_id: BigInt(5),
        location_id: BigInt(20),
        quantity: new Prisma.Decimal(50),
      } as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValue({
        id: BigInt(1),
        status: OperationStatus.DONE,
      } as any);

      const res = await request(app)
        .post('/receipts/1/validate')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DONE');
      expect(prisma.stockQuant.update).toHaveBeenCalled();
      expect(prisma.stockLedgerEntry.create).toHaveBeenCalled();
    });

    it('GET /receipts/:id/print should return 400 if receipt is not DONE', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.READY,
      } as any);

      const res = await request(app)
        .get('/receipts/1/print')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('GET /receipts/:id/print should return formatted slip when DONE', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        reference_no: 'WH1/IN/0001',
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DONE,
        partner: { name: 'Supplier Co', address: '123 Test St', phone: '1234567890' },
        warehouse: { name: 'Main Warehouse', code: 'WH1' },
        destination_location: { name: 'Stock', code: 'STOCK' },
        scheduled_date: new Date('2026-09-01T00:00:00.000Z'),
        validated_date: new Date('2026-09-02T10:00:00.000Z'),
        lines: [
          {
            product: { name: 'Steel Rods', sku: 'STL001' },
            uom: { code: 'kg' },
            quantity_planned: new Prisma.Decimal(50),
            quantity_done: new Prisma.Decimal(50),
          },
        ],
      } as any);

      const res = await request(app)
        .get('/receipts/1/print')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reference_no).toBe('WH1/IN/0001');
      expect(res.body.data.status).toBe('DONE');
      expect(res.body.data.lines[0].sku).toBe('STL001');
      expect(res.body.data.lines[0].quantity_done).toBe(50);
    });
  });
});
