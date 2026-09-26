# Phase 04 — Product Management

**Estimated Time**: 45 minutes  
**Priority**: P0

---

## Objective

Implement full product CRUD including initial stock handling (which internally triggers an Adjustment validation).

---

## Components Created

```
src/modules/products/
  products.routes.ts
  products.controller.ts
  products.service.ts
  products.schema.ts
```

---

## Database

Tables used (created in Phase 01):
- `products` (primary)
- `stock_quants` (read during initial stock setup)
- `stock_operations` + `stock_adjustment_lines` (created for initial stock)

No new migrations.

---

## APIs

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /products | Any | ?search=&category_id=&page=&limit= |
| POST | /products | MANAGER | create product; optional initial stock |
| GET | /products/:id | Any | with category + uom |
| PUT | /products/:id | MANAGER | updatable fields |
| DELETE | /products/:id | MANAGER | soft delete, block if referenced |
| GET | /products/:id/stock | Any | per-location stock breakdown |
| PUT | /products/:id/stock/:location_id | Any | quick inline stock edit (Phase 13 depends on this) |

---

## Zod Schemas

```typescript
const CreateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    sku: z.string().min(1).max(60),
    barcode: z.string().max(60).optional(),
    category_id: z.coerce.bigint(),
    uom_id: z.coerce.bigint(),
    unit_cost: z.coerce.number().min(0).default(0),
    description: z.string().optional(),
    reorder_min_qty: z.coerce.number().min(0).default(0),
    reorder_max_qty: z.coerce.number().min(0).optional(),
    initial_stock_quantity: z.coerce.number().min(0).optional(),
    initial_stock_location_id: z.coerce.bigint().optional(),
  }).refine(
    data => {
      // if one is provided, both must be provided
      const hasQty = data.initial_stock_quantity !== undefined
      const hasLoc = data.initial_stock_location_id !== undefined
      return hasQty === hasLoc
    },
    { message: 'initial_stock_quantity and initial_stock_location_id must both be provided or both omitted' }
  )
})
```

---

## Key Business Logic

### POST /products with initial stock
```
1. Create product
2. If initial_stock_quantity + initial_stock_location_id provided:
   a. Get Adjustment Virtual location (location_type = ADJUSTMENT_VIRTUAL)
   b. Generate reference_no (WH_CODE/ADJ/NNNN)
   c. Create stock_operations { type: ADJUSTMENT, status: DRAFT }
   d. Create stock_adjustment_lines {
        recorded_quantity: 0,  (no stock exists yet)
        counted_quantity: initial_stock_quantity,
        difference: initial_stock_quantity
      }
   e. Validate the adjustment (DRAFT → DONE, bypassing READY step for initial stock)
      → calls StockService.increment(locationId, qty)
      → writes ledger entry
3. Return created product
```

This entire flow runs in a single `prisma.$transaction()`.

**Note**: This logic is implemented in `ProductService.create()` but reuses the same `StockService` and ledger-writing logic from Phase 05/06. Since Phase 05 (StockService) must exist before ProductService can use it, the actual initial-stock wiring happens after Phase 06. However, the product model + basic CRUD is done here in Phase 04, and the initial stock wiring is the final step.

### GET /products/:id/stock
```typescript
// Returns per-location breakdown
const quants = await prisma.stock_quants.findMany({
  where: { product_id: id },
  include: { location: true }
})
return quants.map(q => ({
  location_id: q.location_id,
  location_name: q.location.name,
  unit_cost: product.unit_cost,
  on_hand: q.quantity,
  reserved_quantity: q.reserved_quantity,
  free_to_use: q.quantity - q.reserved_quantity,  // computed
}))
```

### GET /products — search
```
search= matches: products.name (icontains) OR products.sku (icontains)
```

### Soft delete
Block if the product is referenced by any `stock_operation_lines` or `stock_adjustment_lines` with operation status NOT IN (CANCELED).

---

## Depends On

- Phase 01 (foundation)
- Phase 02 (auth middleware)
- Phase 03 (category_id, uom_id FKs must exist)
- Phase 05 + 06 (for initial_stock wiring — basic CRUD works without them)

## Creates

- Product CRUD APIs
- Product stock read API
- Quick stock edit endpoint (delegates to AdjustmentService in Phase 10)

## Required By

- Phase 05 (stock_quants reference products)
- Phase 06 (operation lines reference products)
- Phase 07-10 (all operations use products)

---

## Testing / Completion Criteria

- [ ] POST /products creates product with valid category + uom
- [ ] Duplicate SKU returns 409
- [ ] POST /products with initial stock creates adjustment + updates stock_quants
- [ ] GET /products?search=desk matches by name and sku
- [ ] GET /products/:id/stock returns per-location breakdown with free_to_use
- [ ] DELETE /products/:id soft-deletes (is_active=false)
