# Phase 06 — Operations Core (Status Engine + Reference Service)

**Estimated Time**: 90 minutes  
**Priority**: P0

---

## Objective

Implement the shared operations engine: `OperationService` (confirm/validate/cancel state machine) and `ReferenceService` (reference number generation). This phase is the backbone of all inventory operations.

---

## Components Created

```
src/modules/operations/
  operation.service.ts    # state machine: confirm / validate / cancel
  stock.service.ts        # (already created in Phase 05)
  reference.service.ts    # reference number generation
```

---

## Database

Tables used (created in Phase 01):
- `stock_operations` (primary)
- `stock_operation_lines`
- `stock_adjustment_lines`
- `stock_quants` (via StockService)
- `stock_ledger_entries` (written on validate)

No new migrations.

---

## ReferenceService

```typescript
export class ReferenceService {
  private static readonly OP_CODES: Record<OperationType, string> = {
    RECEIPT: 'IN',
    DELIVERY: 'OUT',
    INTERNAL_TRANSFER: 'INT',
    ADJUSTMENT: 'ADJ',
  }

  static async generate(tx: PrismaTx, warehouseCode: string, opType: OperationType): Promise<string> {
    const opCode = this.OP_CODES[opType]
    const prefix = `${warehouseCode}/${opCode}/`
    
    const last = await tx.stockOperation.findFirst({
      where: { reference_no: { startsWith: prefix } },
      orderBy: { reference_no: 'desc' },
      select: { reference_no: true },
    })
    
    let sequence = 1
    if (last) {
      const lastSeq = parseInt(last.reference_no.split('/').pop() ?? '0', 10)
      sequence = lastSeq + 1
    }
    
    return `${prefix}${String(sequence).padStart(4, '0')}`
  }
}
```

---

## OperationService — State Machine

### confirm(operationId, userId)

```
Preconditions:
  - operation.status === DRAFT
  - operation must not be DONE or CANCELED

For RECEIPT / ADJUSTMENT:
  - DRAFT → READY (no stock check needed)

For DELIVERY / INTERNAL_TRANSFER:
  - Check available stock at source_location for ALL lines
  - If ALL lines have sufficient stock → READY + reserve stock
  - If ANY line is short → WAITING + still reserve stock
    (reserve whatever is available; reservation tracks expected qty)
  Note: reservation is based on quantity_planned, not quantity_done

Atomically:
  1. [DELIVERY/TRANSFER] reserve stock per line via StockService.reserve()
  2. Update operation.status
  All in prisma.$transaction()
```

### validate(operationId, userId)

```
Preconditions:
  - operation.status === READY
  - NOT all lines have quantity_done === 0 (at least one must be > 0)
  - [DELIVERY/TRANSFER] quantity_done <= available stock at source

Based on operation_type:
  RECEIPT:
    For each line:
      StockService.increment(destination_location_id, line.quantity_done)
      writeLedgerEntry(+quantity_done, destination_location)

  DELIVERY:
    For each line:
      StockService.decrement(source_location_id, line.quantity_done)
      StockService.releaseReservation(source_location_id, line.quantity_planned) 
        [releases the full planned reservation; done qty was already consumed]
      writeLedgerEntry(-quantity_done, source_location)

  INTERNAL_TRANSFER:
    For each line:
      StockService.decrement(source_location_id, line.quantity_done)
      StockService.releaseReservation(source_location_id, line.quantity_planned)
      StockService.increment(destination_location_id, line.quantity_done)
      writeLedgerEntry(-quantity_done, source_location)
      writeLedgerEntry(+quantity_done, destination_location)

  ADJUSTMENT:
    For each adjustment line:
      if difference > 0: StockService.increment(location_id, difference)
      if difference < 0: StockService.decrement(location_id, abs(difference))
      writeLedgerEntry(difference, location)

Set operation.status = DONE
Set operation.validated_date = now()
All in prisma.$transaction()
```

### writeLedgerEntry (private)

```typescript
private static async writeLedgerEntry(
  tx: PrismaTx,
  operationId: bigint,
  productId: bigint,
  locationId: bigint,
  quantityChange: Prisma.Decimal,
  referenceNo: string,
  operationType: OperationType,
  createdBy: bigint
): Promise<void> {
  // Get balance_after = current stock_quants.quantity at location (after mutation)
  const quant = await tx.stockQuant.findUniqueOrThrow({
    where: { product_id_location_id: { product_id: productId, location_id: locationId } }
  })
  await tx.stockLedgerEntry.create({
    data: {
      product_id: productId,
      location_id: locationId,
      quantity_change: quantityChange,
      balance_after: quant.quantity,
      operation_id: operationId,
      operation_type: operationType,
      reference_no: referenceNo,
      movement_date: new Date(),
      created_by: createdBy,
    }
  })
}
```

### cancel(operationId, userId)

```
Preconditions:
  - operation.status !== DONE
  - Authorization: MANAGER can cancel any; STAFF can only cancel own DRAFT

If status was WAITING or READY:
  For DELIVERY / INTERNAL_TRANSFER lines:
    StockService.releaseReservation(source_location_id, line.quantity_planned)

Set operation.status = CANCELED
All in prisma.$transaction()
```

---

## Validation Guards

```typescript
// Shared guard: check operation exists + not locked
static async getOperationOrThrow(id: bigint) {
  const op = await prisma.stockOperation.findUnique({ where: { id }, include: { lines: true, adjustment_lines: true } })
  if (!op) throw Errors.notFound('Operation not found')
  return op
}

// Guard: not DONE/CANCELED
static assertMutable(op) {
  if (['DONE','CANCELED'].includes(op.status)) throw Errors.operationLocked()
}

// Guard: must be READY to validate
static assertReady(op) {
  if (op.status !== 'READY') throw Errors.invalidTransition('Operation must be READY to validate')
}

// Guard: must be DRAFT to confirm
static assertDraft(op) {
  if (op.status !== 'DRAFT') throw Errors.invalidTransition('Operation must be in DRAFT to confirm')
}
```

---

## Depends On

- Phase 01 (foundation, Prisma)
- Phase 02 (userId for audit fields)
- Phase 03 (warehouse, location FKs)
- Phase 04 (product FKs)
- Phase 05 (StockService)

## Creates

- `OperationService` — used by ALL operation modules (07-10)
- `ReferenceService` — used by ALL operation create flows (07-10)
- `stock_ledger_entries` written here

## Required By

- Phase 07 (Receipts)
- Phase 08 (Deliveries)
- Phase 09 (Transfers)
- Phase 10 (Adjustments)
- Phase 11 (Ledger reads from stock_ledger_entries written here)

---

## Testing / Completion Criteria

- [ ] ReferenceService generates WH1/IN/0001 for first receipt
- [ ] ReferenceService increments to WH1/IN/0002 for second receipt
- [ ] OperationService.confirm on RECEIPT: DRAFT → READY
- [ ] OperationService.confirm on DELIVERY (sufficient stock): DRAFT → READY + reservation created
- [ ] OperationService.confirm on DELIVERY (insufficient stock): DRAFT → WAITING + reservation created
- [ ] OperationService.validate on RECEIPT: READY → DONE + stock_quants updated + ledger written
- [ ] OperationService.validate on DELIVERY: READY → DONE + stock decremented + ledger written
- [ ] OperationService.validate: all lines quantity_done=0 → 422 ALL_LINES_ZERO
- [ ] OperationService.cancel from READY DELIVERY: reservation released
- [ ] OperationService.validate on DRAFT → 422 INVALID_TRANSITION
