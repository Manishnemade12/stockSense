import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { StockService } from '../src/modules/operations/stock.service.js';
import { prisma } from '../src/prisma/client.js';
import { AppError } from '../src/utils/errors.js';

vi.mock('../src/prisma/client.js', () => {
  return {
    prisma: {
      stockQuant: {
        upsert: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
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

describe('Phase 05 — StockService (stock_quants mutations)', () => {
  const mockTx = prisma as any;
  const productId = BigInt(10);
  const locationId = BigInt(20);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreate', () => {
    it('should upsert stock quant with default 0 if not existing', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(0),
        reserved_quantity: new Prisma.Decimal(0),
      });

      const quant = await StockService.getOrCreate(mockTx, productId, locationId);

      expect(quant.quantity.toString()).toBe('0');
      expect(mockTx.stockQuant.upsert).toHaveBeenCalledWith({
        where: {
          product_id_location_id: {
            product_id: productId,
            location_id: locationId,
          },
        },
        create: {
          product_id: productId,
          location_id: locationId,
          quantity: new Prisma.Decimal(0),
          reserved_quantity: new Prisma.Decimal(0),
        },
        update: {},
      });
    });
  });

  describe('increment', () => {
    it('should increment on-hand quantity for a product at location', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(50),
        reserved_quantity: new Prisma.Decimal(0),
      });

      vi.mocked(mockTx.stockQuant.update).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(75),
        reserved_quantity: new Prisma.Decimal(0),
      });

      await StockService.increment(mockTx, productId, locationId, 25);

      expect(mockTx.stockQuant.update).toHaveBeenCalledWith({
        where: {
          product_id_location_id: {
            product_id: productId,
            location_id: locationId,
          },
        },
        data: {
          quantity: { increment: new Prisma.Decimal(25) },
        },
      });
    });
  });

  describe('decrement', () => {
    it('should decrement on-hand quantity when sufficient stock is available', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(50),
        reserved_quantity: new Prisma.Decimal(10),
      });

      vi.mocked(mockTx.stockQuant.update).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(30),
        reserved_quantity: new Prisma.Decimal(10),
      });

      await StockService.decrement(mockTx, productId, locationId, 20);

      expect(mockTx.stockQuant.update).toHaveBeenCalledWith({
        where: {
          product_id_location_id: {
            product_id: productId,
            location_id: locationId,
          },
        },
        data: {
          quantity: { decrement: new Prisma.Decimal(20) },
        },
      });
    });

    it('should throw INSUFFICIENT_STOCK when decrement qty exceeds on-hand quantity', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(15),
        reserved_quantity: new Prisma.Decimal(0),
      });

      await expect(
        StockService.decrement(mockTx, productId, locationId, 30)
      ).rejects.toThrow(AppError);

      try {
        vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
          id: BigInt(1),
          product_id: productId,
          location_id: locationId,
          quantity: new Prisma.Decimal(15),
          reserved_quantity: new Prisma.Decimal(0),
        });
        await StockService.decrement(mockTx, productId, locationId, 30);
      } catch (err: any) {
        expect(err.code).toBe('INSUFFICIENT_STOCK');
        expect(err.statusCode).toBe(422);
      }
    });
  });

  describe('reserve and releaseReservation', () => {
    it('should increment reserved_quantity on reserve()', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(0),
      });

      vi.mocked(mockTx.stockQuant.update).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(15),
      });

      await StockService.reserve(mockTx, productId, locationId, 15);

      expect(mockTx.stockQuant.update).toHaveBeenCalledWith({
        where: {
          product_id_location_id: {
            product_id: productId,
            location_id: locationId,
          },
        },
        data: {
          reserved_quantity: { increment: new Prisma.Decimal(15) },
        },
      });
    });

    it('should decrement reserved_quantity on releaseReservation()', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(20),
      });

      vi.mocked(mockTx.stockQuant.update).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(5),
      });

      await StockService.releaseReservation(mockTx, productId, locationId, 15);

      expect(mockTx.stockQuant.update).toHaveBeenCalledWith({
        where: {
          product_id_location_id: {
            product_id: productId,
            location_id: locationId,
          },
        },
        data: {
          reserved_quantity: new Prisma.Decimal(5),
        },
      });
    });
  });

  describe('getAvailable and getOnHand', () => {
    it('should return on_hand - reserved for getAvailable()', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(35),
      });

      const available = await StockService.getAvailable(mockTx, productId, locationId);
      expect(available.toString()).toBe('65');
    });

    it('should return raw quantity for getOnHand()', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValueOnce({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(35),
      });

      const onHand = await StockService.getOnHand(mockTx, productId, locationId);
      expect(onHand.toString()).toBe('100');
    });
  });

  describe('Transactional composition', () => {
    it('should successfully execute multiple StockService operations inside prisma.$transaction', async () => {
      vi.mocked(mockTx.stockQuant.upsert).mockResolvedValue({
        id: BigInt(1),
        product_id: productId,
        location_id: locationId,
        quantity: new Prisma.Decimal(100),
        reserved_quantity: new Prisma.Decimal(20),
      });

      await prisma.$transaction(async (tx) => {
        await StockService.reserve(tx, productId, locationId, 10);
        await StockService.increment(tx, productId, locationId, 50);
        const available = await StockService.getAvailable(tx, productId, locationId);
        expect(available).toBeDefined();
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
