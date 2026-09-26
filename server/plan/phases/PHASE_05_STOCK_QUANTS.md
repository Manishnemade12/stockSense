# Phase 05 — Stock Quants & StockService

**Estimated Time**: 30 minutes  
**Priority**: P0

---

## Objective

Implement the `StockService` — the single, centralised service that owns all `stock_quants` mutations. This is the most critical shared service in the entire backend.

---

## Components Created

```
src/modules/operations/stock.service.ts
```

No routes or controllers — this is a pure service used by Operations (Phase 06-10).

---

## Database

Tables used:
- `stock_quants` (primary)

No new migrations.

---

## StockService Implementation

```typescript
import { Prisma } from '@prisma/client'
import { Errors } from '../../utils/errors'

type PrismaTx = Prisma.TransactionClient

export class StockService {

  // Upsert: get existing quant or create with 0 quantity
  static async getOrCreate(tx: PrismaTx, productId: bigint, locationId: bigint) {
    return tx.stockQuant.upsert({
      where: { product_id_location_id: { product_id: productId, location_id: locationId } },
      create: { product_id: productId, location_id: locationId, quantity: 0, reserved_quantity: 0 },
      update: {},
    })
  }

  // Add qty to on-hand
  static async increment(tx: PrismaTx, productId: bigint, locationId: bigint, qty: Prisma.Decimal) {
    await this.getOrCreate(tx, productId, locationId)
    await tx.stockQuant.update({
      where: { product_id_location_id: { product_id: productId, location_id: locationId } },
      data: { quantity: { increment: qty } },
    })
  }

  // Subtract qty from on-hand (validates availability first)
  static async decrement(tx: PrismaTx, productId: bigint, locationId: bigint, qty: Prisma.Decimal) {
    const quant = await this.getOrCreate(tx, productId, locationId)
    const available = new Prisma.Decimal(quant.quantity).minus(quant.reserved_quantity)
    // Note: for validate, reservation has already been counted. Use raw quantity check.
    if (new Prisma.Decimal(quant.quantity).lessThan(qty)) {
      throw Errors.insufficientStock()
    }
    await tx.stockQuant.update({
      where: { product_id_location_id: { product_id: productId, location_id: locationId } },
      data: { quantity: { decrement: qty } },
    })
  }

  // Reserve stock (increment reserved_quantity)
  static async reserve(tx: PrismaTx, productId: bigint, locationId: bigint, qty: Prisma.Decimal) {
    await this.getOrCreate(tx, productId, locationId)
    await tx.stockQuant.update({
      where: { product_id_location_id: { product_id: productId, location_id: locationId } },
      data: { reserved_quantity: { increment: qty } },
    })
  }

  // Release reservation (decrement reserved_quantity)
  static async releaseReservation(tx: PrismaTx, productId: bigint, locationId: bigint, qty: Prisma.Decimal) {
    await tx.stockQuant.update({
      where: { product_id_location_id: { product_id: productId, location_id: locationId } },
      data: { reserved_quantity: { decrement: qty } },
    })
  }

  // free-to-use quantity = quantity - reserved_quantity
  static async getAvailable(tx: PrismaTx, productId: bigint, locationId: bigint): Promise<Prisma.Decimal> {
    const quant = await this.getOrCreate(tx, productId, locationId)
    return new Prisma.Decimal(quant.quantity).minus(quant.reserved_quantity)
  }

  // raw on-hand quantity
  static async getOnHand(tx: PrismaTx, productId: bigint, locationId: bigint): Promise<Prisma.Decimal> {
    const quant = await this.getOrCreate(tx, productId, locationId)
    return new Prisma.Decimal(quant.quantity)
  }
}
```

---

## Key Design Rules

1. **All methods accept a Prisma transaction client** — callers must always call within `prisma.$transaction()`.
2. **`getOrCreate` uses upsert** — prevents "quant not found" errors when stock starts from zero.
3. **`decrement` checks raw quantity** — not free_to_use, because at validate time the reservation has already been set. The actual stock physically cannot go below zero.
4. **No direct `stock_quants` writes anywhere else in the codebase** — enforced by code review.

---

## Depends On

- Phase 01 (Prisma client)
- Phase 03 (locations must exist)
- Phase 04 (products must exist)

## Creates

- `StockService` — shared by ALL operation phases

## Required By

- Phase 06 (OperationService uses StockService)
- Phase 07 (Receipt validate → increment)
- Phase 08 (Delivery confirm → reserve; validate → decrement)
- Phase 09 (Transfer confirm → reserve; validate → decrement + increment)
- Phase 10 (Adjustment validate → increment or decrement)
- Phase 13 (quick stock edit → adjustment)

---

## Testing / Completion Criteria

- [ ] StockService.increment() creates quant if not exists, then adds qty
- [ ] StockService.decrement() reduces quantity
- [ ] StockService.decrement() throws INSUFFICIENT_STOCK when qty > on_hand
- [ ] StockService.reserve() increases reserved_quantity
- [ ] StockService.releaseReservation() decreases reserved_quantity
- [ ] StockService.getAvailable() returns quantity - reserved_quantity
- [ ] All calls succeed inside prisma.$transaction()
