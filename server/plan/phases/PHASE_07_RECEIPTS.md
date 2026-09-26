# Phase 07 — Receipts

**Estimated Time**: 30 minutes  
**Priority**: P0

---

## Objective

Implement the Receipts module (incoming stock operations). Receipts flow: DRAFT → READY → DONE.

---

## Components Created

```
src/modules/receipts/
  receipts.routes.ts
  receipts.controller.ts
  receipts.service.ts
  receipts.schema.ts
```

---

## Database

Tables used:
- `stock_operations` (type=RECEIPT)
- `stock_operation_lines`
- `stock_quants` (via StockService on validate)
- `stock_ledger_entries` (via OperationService on validate)

---

## APIs

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /receipts | Any | ?status=&warehouse_id=&search=&view=list\|kanban&page=&limit= |
| POST | /receipts | MANAGER | create receipt in DRAFT |
| GET | /receipts/:id | Any | full detail + lines |
| PUT | /receipts/:id | Any | update while not DONE/CANCELED |
| POST | /receipts/:id/confirm | Any | DRAFT → READY |
| POST | /receipts/:id/validate | Any | READY → DONE |
| POST | /receipts/:id/cancel | Any | → CANCELED |
| GET | /receipts/:id/print | Any | only when DONE |

---

## Zod Schemas

```typescript
const CreateReceiptSchema = z.object({
  body: z.object({
    partner_id: z.coerce.bigint(),
    warehouse_id: z.coerce.bigint(),
    destination_location_id: z.coerce.bigint(),
    scheduled_date: z.string().datetime(),
    notes: z.string().optional(),
    lines: z.array(z.object({
      product_id: z.coerce.bigint(),
      uom_id: z.coerce.bigint(),
      quantity_planned: z.coerce.number().positive(),
    })).min(1),
  })
})

const UpdateReceiptSchema = z.object({
  params: z.object({ id: z.coerce.bigint() }),
  body: z.object({
    responsible_user_id: z.coerce.bigint().optional(),
    notes: z.string().optional(),
    lines: z.array(z.object({
      id: z.coerce.bigint().optional(),
      product_id: z.coerce.bigint(),
      uom_id: z.coerce.bigint(),
      quantity_planned: z.coerce.number().positive(),
      quantity_done: z.coerce.number().min(0).optional(),
    })).optional(),
  })
})
```

---

## Key Business Logic

### ReceiptService.create(dto, userId)
```
1. Lookup Vendor virtual location (location_type = VENDOR)
2. Lookup warehouse to get code for reference generation
3. Inside prisma.$transaction():
   a. ReferenceService.generate(warehouseCode, RECEIPT)
   b. Create stock_operations {
        operation_type: RECEIPT,
        status: DRAFT,
        source_location_id: vendorLocation.id,
        destination_location_id: dto.destination_location_id,
        partner_id: dto.partner_id,
        ...
      }
   c. Create stock_operation_lines for each line
4. Return created operation with lines
```

### GET /receipts list response shape
```json
{
  "id": 1,
  "reference_no": "WH1/IN/0001",
  "status": "DRAFT",
  "partner": { "id": 1, "name": "Supplier Co" },
  "source_location": { "id": 1, "name": "Vendor", "code": "VENDOR" },
  "destination_location": { "id": 3, "name": "Stock", "code": "STOCK" },
  "scheduled_date": "2026-09-01T00:00:00Z",
  "is_late": false
}
```

`is_late` = `scheduled_date < now() AND status NOT IN (DONE, CANCELED)`

### GET /receipts/:id detail — lines shape
```json
{
  "lines": [{
    "id": 1,
    "product_id": 5,
    "product": { "name": "Steel Rods", "sku": "STL001" },
    "uom": { "name": "kg", "code": "kg" },
    "quantity_planned": 50,
    "quantity_done": 0,
    "available_at_source": null,
    "is_short": false
  }]
}
```

`available_at_source` and `is_short` are null/false for receipts (source is Vendor — unlimited).

### Print endpoint
```typescript
// GET /receipts/:id/print
// Only allowed when status = DONE
// Returns structured data for frontend to render a printable slip
{
  reference_no: string,
  operation_type: 'RECEIPT',
  status: 'DONE',
  partner: { name, address },
  warehouse: { name },
  destination_location: { name },
  validated_date: string,
  lines: [{ product_name, sku, uom_code, quantity_done }]
}
```

---

## Depends On

- Phase 01-05 (foundation, auth, master data, products, stock service)
- Phase 06 (OperationService.confirm/validate/cancel, ReferenceService)

## Creates

- /receipts CRUD + state machine endpoints

## Required By

- Phase 11 (ledger has receipt entries after validate)
- Phase 12 (dashboard receipt KPIs)

---

## Testing / Completion Criteria

- [ ] POST /receipts creates in DRAFT with vendor source location auto-set
- [ ] Reference number format: WH1/IN/0001
- [ ] GET /receipts returns list with is_late computed
- [ ] GET /receipts/:id returns lines with is_short=false
- [ ] POST /receipts/:id/confirm: DRAFT → READY
- [ ] POST /receipts/:id/validate: READY → DONE + stock_quants increased at destination
- [ ] stock_ledger_entries created after validate
- [ ] Cannot PUT a DONE receipt
- [ ] GET /receipts/:id/print returns 400 if not DONE
