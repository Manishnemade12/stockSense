import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OperationStatus,
  OperationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../src/prisma/client.js';
import { ReferenceService } from '../src/modules/operations/reference.service.js';
import { OperationService } from '../src/modules/operations/operation.service.js';
import { StockService } from '../src/modules/operations/stock.service.js';
import { AppError } from '../src/utils/errors.js';

vi.mock('../src/prisma/client.js', () => {
  return {
    prisma: {
      stockOperation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      stockQuant: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      stockLedgerEntry: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return await cb(prisma);
        }
        return await Promise.all(cb);
      }),
    },
  };
});

describe('Phase 06 — Operations Core (ReferenceService & OperationService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ReferenceService', () => {
    it('should generate WH1/IN/0001 for first receipt when no previous operation exists', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce(null);

      const ref = await ReferenceService.generate(
        prisma as any,
        'WH1',
        OperationType.RECEIPT
      );

      expect(ref).toBe('WH1/IN/0001');
      expect(prisma.stockOperation.findFirst).toHaveBeenCalledWith({
        where: { reference_no: { startsWith: 'WH1/IN/' } },
        orderBy: { reference_no: 'desc' },
        select: { reference_no: true },
      });
    });

    it('should increment to WH1/IN/0002 for second receipt', async () => {
      vi.mocked(prisma.stockOperation.findFirst).mockResolvedValueOnce({
        reference_no: 'WH1/IN/0001',
      } as any);

      const ref = await ReferenceService.generate(
        prisma as any,
        'WH1',
        OperationType.RECEIPT
      );

      expect(ref).toBe('WH1/IN/0002');
    });

    it('should generate correct prefixes for DELIVERY, TRANSFER, ADJUSTMENT', async () => {
      vi.mocked(prisma.stockOperation.findFirst)
        .mockResolvedValueOnce({ reference_no: 'MAIN/OUT/0041' } as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ reference_no: 'WH2/ADJ/0009' } as any);

      const refOut = await ReferenceService.generate(
        prisma as any,
        'MAIN',
        OperationType.DELIVERY
      );
      const refInt = await ReferenceService.generate(
        prisma as any,
        'MAIN',
        OperationType.INTERNAL_TRANSFER
      );
      const refAdj = await ReferenceService.generate(
        prisma as any,
        'WH2',
        OperationType.ADJUSTMENT
      );

      expect(refOut).toBe('MAIN/OUT/0042');
      expect(refInt).toBe('MAIN/INT/0001');
      expect(refAdj).toBe('WH2/ADJ/0010');
    });
  });

  describe('OperationService.confirm', () => {
    it('should confirm RECEIPT from DRAFT to READY without stock check', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        reference_no: 'WH1/IN/0001',
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.DRAFT,
        lines: [
          {
            id: BigInt(10),
            product_id: BigInt(100),
            quantity_planned: new Prisma.Decimal(50),
          },
        ],
        adjustment_lines: [],
      } as any);

      vi.mocked(prisma.stockOperation.update).mockResolvedValueOnce({
        id: BigInt(1),
        status: OperationStatus.READY,
      } as any);

      const result = await OperationService.confirm(BigInt(1), BigInt(2));

      expect(prisma.stockOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({
            status: OperationStatus.READY,
            responsible_user_id: BigInt(2),
          }),
        })
      );
      expect(result.status).toBe(OperationStatus.READY);
    });

    it('should confirm DELIVERY to READY and reserve stock when stock is sufficient', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(2),
        reference_no: 'WH1/OUT/0001',
        operation_type: OperationType.DELIVERY,
        status: OperationStatus.DRAFT,
        source_location_id: BigInt(10),
        lines: [
          {
            id: BigInt(11),
            product_id: BigInt(100),
            quantity_planned: new Prisma.Decimal(20),
          },
        ],
        adjustment_lines: [],
      } as any);

      // Quant has quantity=100, reserved=10 -> available=90 >= 20
      vi.mocked(prisma.stockQuant.findUnique).mockResolvedValue({
        product_id: BigInt(100),
        location_id: BigInt(10),
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(10),
      } as any);
      vi.mocked(prisma.stockQuant.upsert).mockResolvedValue({
        product_id: BigInt(100),
        location_id: BigInt(10),
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(10),
      } as any);
      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);

      vi.mocked(prisma.stockOperation.update).mockResolvedValueOnce({
        id: BigInt(2),
        status: OperationStatus.READY,
      } as any);

      const result = await OperationService.confirm(BigInt(2), BigInt(2));

      expect(prisma.stockOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OperationStatus.READY,
          }),
        })
      );
      expect(prisma.stockQuant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reserved_quantity: { increment: new Prisma.Decimal(20) },
          },
        })
      );
      expect(result.status).toBe(OperationStatus.READY);
    });

    it('should confirm DELIVERY to WAITING and still reserve stock when stock is insufficient', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(3),
        reference_no: 'WH1/OUT/0002',
        operation_type: OperationType.DELIVERY,
        status: OperationStatus.DRAFT,
        source_location_id: BigInt(10),
        lines: [
          {
            id: BigInt(12),
            product_id: BigInt(100),
            quantity_planned: new Prisma.Decimal(50),
          },
        ],
        adjustment_lines: [],
      } as any);

      // Available = 10 < 50
      vi.mocked(prisma.stockQuant.findUnique).mockResolvedValue({
        product_id: BigInt(100),
        location_id: BigInt(10),
        quantity: new Prisma.Decimal(10),
        reserved_quantity: new Prisma.Decimal(0),
      } as any);
      vi.mocked(prisma.stockQuant.upsert).mockResolvedValue({
        product_id: BigInt(100),
        location_id: BigInt(10),
        quantity: new Prisma.Decimal(10),
        reserved_quantity: new Prisma.Decimal(0),
      } as any);
      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);

      vi.mocked(prisma.stockOperation.update).mockResolvedValueOnce({
        id: BigInt(3),
        status: OperationStatus.WAITING,
      } as any);

      const result = await OperationService.confirm(BigInt(3), BigInt(2));

      expect(prisma.stockOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OperationStatus.WAITING,
          }),
        })
      );
      expect(prisma.stockQuant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reserved_quantity: { increment: new Prisma.Decimal(50) },
          },
        })
      );
      expect(result.status).toBe(OperationStatus.WAITING);
    });

    it('should reject confirming an operation not in DRAFT with INVALID_TRANSITION', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(4),
        status: OperationStatus.READY,
      } as any);

      await expect(
        OperationService.confirm(BigInt(4), BigInt(2))
      ).rejects.toThrowError(AppError);
    });

    it('should reject confirming a locked (DONE/CANCELED) operation', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(5),
        status: OperationStatus.DONE,
      } as any);

      await expect(
        OperationService.confirm(BigInt(5), BigInt(2))
      ).rejects.toThrowError(AppError);
    });
  });

  describe('OperationService.validate', () => {
    it('should validate RECEIPT: increment stock and write stock ledger entry', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(10),
        reference_no: 'WH1/IN/0001',
        operation_type: OperationType.RECEIPT,
        status: OperationStatus.READY,
        destination_location_id: BigInt(20),
        lines: [
          {
            id: BigInt(101),
            product_id: BigInt(5),
            quantity_planned: new Prisma.Decimal(100),
            quantity_done: new Prisma.Decimal(100),
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
        quantity: new Prisma.Decimal(100),
      } as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValue({
        id: BigInt(10),
        status: OperationStatus.DONE,
      } as any);

      const res = await OperationService.validate(BigInt(10), BigInt(1));

      expect(prisma.stockQuant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            quantity: { increment: new Prisma.Decimal(100) },
          },
        })
      );
      expect(prisma.stockLedgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity_change: new Prisma.Decimal(100),
          balance_after: new Prisma.Decimal(100),
          operation_type: OperationType.RECEIPT,
          reference_no: 'WH1/IN/0001',
          created_by: BigInt(1),
        }),
      });
      expect(res.status).toBe(OperationStatus.DONE);
    });

    it('should validate DELIVERY: decrement stock, release reservation, and write negative ledger entry', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(11),
        reference_no: 'WH1/OUT/0001',
        operation_type: OperationType.DELIVERY,
        status: OperationStatus.READY,
        source_location_id: BigInt(20),
        lines: [
          {
            id: BigInt(102),
            product_id: BigInt(5),
            quantity_planned: new Prisma.Decimal(30),
            quantity_done: new Prisma.Decimal(30),
          },
        ],
        adjustment_lines: [],
      } as any);

      vi.mocked(prisma.stockQuant.upsert)
        .mockResolvedValueOnce({
          // for decrement
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(50),
          reserved_quantity: new Prisma.Decimal(30),
        } as any)
        .mockResolvedValueOnce({
          // for release reservation
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(20),
          reserved_quantity: new Prisma.Decimal(30),
        } as any);

      vi.mocked(prisma.stockQuant.findUnique).mockResolvedValue({
        // for ledger balance_after
        product_id: BigInt(5),
        location_id: BigInt(20),
        quantity: new Prisma.Decimal(20),
        reserved_quantity: new Prisma.Decimal(0),
      } as any);

      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValue({
        id: BigInt(11),
        status: OperationStatus.DONE,
      } as any);

      const res = await OperationService.validate(BigInt(11), BigInt(1));

      expect(prisma.stockQuant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            quantity: { decrement: new Prisma.Decimal(30) },
          },
        })
      );
      expect(prisma.stockQuant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reserved_quantity: new Prisma.Decimal(0),
          },
        })
      );
      expect(prisma.stockLedgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity_change: new Prisma.Decimal(-30),
          balance_after: new Prisma.Decimal(20),
          operation_type: OperationType.DELIVERY,
        }),
      });
      expect(res.status).toBe(OperationStatus.DONE);
    });

    it('should validate INTERNAL_TRANSFER: decrement source, increment destination, write dual ledger entries', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(12),
        reference_no: 'WH1/INT/0001',
        operation_type: OperationType.INTERNAL_TRANSFER,
        status: OperationStatus.READY,
        source_location_id: BigInt(20),
        destination_location_id: BigInt(30),
        lines: [
          {
            id: BigInt(103),
            product_id: BigInt(5),
            quantity_planned: new Prisma.Decimal(15),
            quantity_done: new Prisma.Decimal(15),
          },
        ],
        adjustment_lines: [],
      } as any);

      vi.mocked(prisma.stockQuant.upsert)
        .mockResolvedValueOnce({
          // for decrement source
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(40),
          reserved_quantity: new Prisma.Decimal(15),
        } as any)
        .mockResolvedValueOnce({
          // for increment dest
          product_id: BigInt(5),
          location_id: BigInt(30),
          quantity: new Prisma.Decimal(0),
          reserved_quantity: new Prisma.Decimal(0),
        } as any)
        .mockResolvedValueOnce({
          // for release reservation source
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(25),
          reserved_quantity: new Prisma.Decimal(15),
        } as any);

      vi.mocked(prisma.stockQuant.findUnique)
        .mockResolvedValueOnce({
          // source ledger balance_after
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(25),
        } as any)
        .mockResolvedValueOnce({
          // dest ledger balance_after
          product_id: BigInt(5),
          location_id: BigInt(30),
          quantity: new Prisma.Decimal(15),
        } as any);

      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValue({
        id: BigInt(12),
        status: OperationStatus.DONE,
      } as any);

      const res = await OperationService.validate(BigInt(12), BigInt(1));

      // 1 source decrement, 1 dest increment, 1 reservation release
      expect(prisma.stockLedgerEntry.create).toHaveBeenCalledTimes(2);
      expect(res.status).toBe(OperationStatus.DONE);
    });

    it('should validate ADJUSTMENT: apply positive and negative difference correctly', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(13),
        reference_no: 'WH1/ADJ/0001',
        operation_type: OperationType.ADJUSTMENT,
        status: OperationStatus.READY,
        lines: [],
        adjustment_lines: [
          {
            id: BigInt(201),
            product_id: BigInt(5),
            location_id: BigInt(20),
            recorded_quantity: new Prisma.Decimal(10),
            counted_quantity: new Prisma.Decimal(14), // diff = +4
          },
          {
            id: BigInt(202),
            product_id: BigInt(6),
            location_id: BigInt(20),
            recorded_quantity: new Prisma.Decimal(20),
            counted_quantity: new Prisma.Decimal(15), // diff = -5
          },
        ],
      } as any);

      vi.mocked(prisma.stockQuant.upsert).mockImplementation(async (args: any) => {
        if (args.where?.product_id_location_id?.product_id === BigInt(6)) {
          return {
            product_id: BigInt(6),
            location_id: BigInt(20),
            quantity: new Prisma.Decimal(20),
            reserved_quantity: new Prisma.Decimal(0),
          } as any;
        }
        return {
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(10),
          reserved_quantity: new Prisma.Decimal(0),
        } as any;
      });
      vi.mocked(prisma.stockQuant.findUnique)
        .mockResolvedValueOnce({
          // ledger 1 balance
          product_id: BigInt(5),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(14),
        } as any)
        .mockResolvedValueOnce({
          // decrement check product 6
          product_id: BigInt(6),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(20),
          reserved_quantity: new Prisma.Decimal(0),
        } as any)
        .mockResolvedValueOnce({
          // ledger 2 balance
          product_id: BigInt(6),
          location_id: BigInt(20),
          quantity: new Prisma.Decimal(15),
        } as any);

      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockLedgerEntry.create).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValue({
        id: BigInt(13),
        status: OperationStatus.DONE,
      } as any);

      const res = await OperationService.validate(BigInt(13), BigInt(1));

      expect(prisma.stockLedgerEntry.create).toHaveBeenCalledTimes(2);
      expect(res.status).toBe(OperationStatus.DONE);
    });

    it('should reject validate if all lines quantity_done is 0 with ALL_LINES_ZERO', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(14),
        status: OperationStatus.READY,
        operation_type: OperationType.RECEIPT,
        destination_location_id: BigInt(20),
        lines: [
          {
            id: BigInt(104),
            product_id: BigInt(5),
            quantity_planned: new Prisma.Decimal(50),
            quantity_done: new Prisma.Decimal(0),
          },
        ],
        adjustment_lines: [],
      } as any);

      await expect(
        OperationService.validate(BigInt(14), BigInt(1))
      ).rejects.toThrowError(AppError);
    });

    it('should reject validate if status is not READY with INVALID_TRANSITION', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(15),
        status: OperationStatus.DRAFT,
        operation_type: OperationType.RECEIPT,
      } as any);

      await expect(
        OperationService.validate(BigInt(15), BigInt(1))
      ).rejects.toThrowError(AppError);
    });
  });

  describe('OperationService.cancel', () => {
    it('should cancel READY DELIVERY and release stock reservations', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(20),
        reference_no: 'WH1/OUT/0005',
        operation_type: OperationType.DELIVERY,
        status: OperationStatus.READY,
        source_location_id: BigInt(10),
        created_by: BigInt(1),
        lines: [
          {
            id: BigInt(105),
            product_id: BigInt(50),
            quantity_planned: new Prisma.Decimal(25),
          },
        ],
      } as any);

      vi.mocked(prisma.stockQuant.findUnique).mockResolvedValueOnce({
        product_id: BigInt(50),
        location_id: BigInt(10),
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(25),
      } as any);
      vi.mocked(prisma.stockQuant.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockOperation.update).mockResolvedValue({
        id: BigInt(20),
        status: OperationStatus.CANCELED,
      } as any);

      const res = await OperationService.cancel(
        BigInt(20),
        BigInt(1),
        UserRole.INVENTORY_MANAGER
      );

      expect(prisma.stockQuant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reserved_quantity: new Prisma.Decimal(0),
          },
        })
      );
      expect(res.status).toBe(OperationStatus.CANCELED);
    });

    it('should reject cancel on DONE operation with OPERATION_LOCKED', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(21),
        status: OperationStatus.DONE,
      } as any);

      await expect(
        OperationService.cancel(BigInt(21), BigInt(1), UserRole.INVENTORY_MANAGER)
      ).rejects.toThrowError(AppError);
    });

    it('should reject staff canceling non-draft or another users operation with FORBIDDEN', async () => {
      vi.mocked(prisma.stockOperation.findUnique).mockResolvedValueOnce({
        id: BigInt(22),
        status: OperationStatus.READY,
        created_by: BigInt(99), // created by another user
      } as any);

      await expect(
        OperationService.cancel(BigInt(22), BigInt(2), UserRole.WAREHOUSE_STAFF)
      ).rejects.toThrowError(AppError);
    });
  });
});
