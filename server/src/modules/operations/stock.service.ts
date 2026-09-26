import { Prisma, StockQuant } from '@prisma/client';
import { Errors } from '../../utils/errors.js';

export type PrismaTx = Prisma.TransactionClient;
export type NumericQty = number | string | Prisma.Decimal;

export class StockService {
  /**
   * Helper to ensure Decimal instance
   */
  private static toDecimal(qty: NumericQty): Prisma.Decimal {
    return qty instanceof Prisma.Decimal ? qty : new Prisma.Decimal(qty);
  }

  /**
   * Upsert: get existing quant or create with 0 quantity and 0 reserved_quantity
   */
  static async getOrCreate(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint
  ): Promise<StockQuant> {
    return await tx.stockQuant.upsert({
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
  }

  /**
   * Add qty to on-hand quantity at location
   */
  static async increment(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint,
    qty: NumericQty
  ): Promise<void> {
    const decimalQty = this.toDecimal(qty);
    await this.getOrCreate(tx, productId, locationId);

    await tx.stockQuant.update({
      where: {
        product_id_location_id: {
          product_id: productId,
          location_id: locationId,
        },
      },
      data: {
        quantity: { increment: decimalQty },
      },
    });
  }

  /**
   * Subtract qty from on-hand quantity at location.
   * Validates that sufficient physical stock exists.
   */
  static async decrement(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint,
    qty: NumericQty
  ): Promise<void> {
    const decimalQty = this.toDecimal(qty);
    const quant = await this.getOrCreate(tx, productId, locationId);

    const onHand = new Prisma.Decimal(quant.quantity);
    if (onHand.lessThan(decimalQty)) {
      throw Errors.insufficientStock(
        `Insufficient stock: required ${decimalQty.toString()}, but only ${onHand.toString()} is on-hand`
      );
    }

    await tx.stockQuant.update({
      where: {
        product_id_location_id: {
          product_id: productId,
          location_id: locationId,
        },
      },
      data: {
        quantity: { decrement: decimalQty },
      },
    });
  }

  /**
   * Reserve stock (increment reserved_quantity)
   */
  static async reserve(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint,
    qty: NumericQty
  ): Promise<void> {
    const decimalQty = this.toDecimal(qty);
    await this.getOrCreate(tx, productId, locationId);

    await tx.stockQuant.update({
      where: {
        product_id_location_id: {
          product_id: productId,
          location_id: locationId,
        },
      },
      data: {
        reserved_quantity: { increment: decimalQty },
      },
    });
  }

  /**
   * Release reservation (decrement reserved_quantity)
   */
  static async releaseReservation(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint,
    qty: NumericQty
  ): Promise<void> {
    const decimalQty = this.toDecimal(qty);
    const quant = await this.getOrCreate(tx, productId, locationId);

    const currentReserved = new Prisma.Decimal(quant.reserved_quantity);
    const newReserved = currentReserved.lessThan(decimalQty)
      ? new Prisma.Decimal(0)
      : currentReserved.minus(decimalQty);

    await tx.stockQuant.update({
      where: {
        product_id_location_id: {
          product_id: productId,
          location_id: locationId,
        },
      },
      data: {
        reserved_quantity: newReserved,
      },
    });
  }

  /**
   * Free-to-use quantity = on-hand quantity - reserved_quantity
   */
  static async getAvailable(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint
  ): Promise<Prisma.Decimal> {
    const quant = await this.getOrCreate(tx, productId, locationId);
    return new Prisma.Decimal(quant.quantity).minus(quant.reserved_quantity);
  }

  /**
   * Raw on-hand quantity
   */
  static async getOnHand(
    tx: PrismaTx,
    productId: bigint,
    locationId: bigint
  ): Promise<Prisma.Decimal> {
    const quant = await this.getOrCreate(tx, productId, locationId);
    return new Prisma.Decimal(quant.quantity);
  }
}
