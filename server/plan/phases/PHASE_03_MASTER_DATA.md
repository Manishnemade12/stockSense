# Phase 03 — Master Data (Warehouses, Locations, Categories, UoM, Partners)

**Estimated Time**: 45 minutes  
**Priority**: P0

---

## Objective

Implement full CRUD for all master data entities that are prerequisites for products and operations.

---

## Components Created

```
src/modules/warehouses/
  warehouses.routes.ts
  warehouses.controller.ts
  warehouses.service.ts
  warehouses.schema.ts

src/modules/locations/
  locations.routes.ts
  locations.controller.ts
  locations.service.ts
  locations.schema.ts

src/modules/categories/
  categories.routes.ts
  categories.controller.ts
  categories.service.ts
  categories.schema.ts

src/modules/uom/
  uom.routes.ts
  uom.controller.ts
  uom.service.ts
  uom.schema.ts

src/modules/partners/
  partners.routes.ts
  partners.controller.ts
  partners.service.ts
  partners.schema.ts
```

---

## Database

Tables used (created in Phase 01):
- `warehouses`
- `locations`
- `product_categories`
- `units_of_measure`
- `partners`

No new migrations.

---

## APIs

### Warehouses

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /warehouses | Any | list all active |
| POST | /warehouses | MANAGER | creates warehouse + seeds default INTERNAL location |
| GET | /warehouses/:id | Any | |
| PUT | /warehouses/:id | MANAGER | |
| DELETE | /warehouses/:id | MANAGER | soft delete; block if referenced by non-canceled operation |

### Locations

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /locations | Any | ?warehouse_id=&location_type= |
| POST | /locations | MANAGER | block creation of VENDOR/CUSTOMER/ADJ_VIRTUAL types |
| GET | /locations/:id | Any | |
| PUT | /locations/:id | MANAGER | |
| DELETE | /locations/:id | MANAGER | soft delete |

### Categories

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /categories | Any | |
| POST | /categories | MANAGER | { name, parent_category_id? } |
| GET | /categories/:id | Any | |
| PUT | /categories/:id | MANAGER | |
| DELETE | /categories/:id | MANAGER | block if active products reference it |

### UoM

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /uom | Any | |
| POST | /uom | MANAGER | { name, code } — code unique |
| GET | /uom/:id | Any | |
| PUT | /uom/:id | MANAGER | |
| DELETE | /uom/:id | MANAGER | block if active products reference it |

### Partners

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /partners | Any | ?type=SUPPLIER\|CUSTOMER&search= |
| POST | /partners | MANAGER | { name, type, email?, phone?, address? } |
| GET | /partners/:id | Any | |
| PUT | /partners/:id | MANAGER | |
| DELETE | /partners/:id | MANAGER | soft delete |

---

## Key Business Logic

### Warehouse creation
```
create warehouse
  +
create default INTERNAL location { name: 'Stock', code: 'STOCK', warehouse_id, location_type: INTERNAL }
  (wrapped in prisma.$transaction)
```

### Location creation
- Validate that `location_type` is `INTERNAL` (block VENDOR/CUSTOMER/ADJUSTMENT_VIRTUAL from user creation)
- If `warehouse_id` is provided, verify warehouse exists and is active
- If `parent_location_id` is provided, verify parent exists in same warehouse

### Soft delete pattern (all entities)
```typescript
async softDelete(id: bigint) {
  // 1. check for references (entity-specific)
  // 2. update is_active = false
}
```

---

## Depends On

- Phase 01 (foundation, Prisma client)
- Phase 02 (auth middleware — all write endpoints require authentication)

## Creates

- Warehouse, Location, Category, UoM, Partner CRUD APIs
- All foreign key prerequisites for Products (Phase 04) and Operations (Phase 06)

## Required By

- Phase 04 (products need category_id, uom_id)
- Phase 06 (operations need warehouse_id, location_id, partner_id)

---

## Testing / Completion Criteria

- [ ] POST /warehouses creates warehouse + auto-creates STOCK location
- [ ] POST /locations with type=VENDOR returns 400
- [ ] GET /locations?warehouse_id=X returns only that warehouse's locations
- [ ] GET /partners?type=SUPPLIER returns only suppliers
- [ ] Duplicate warehouse code returns 409
- [ ] Duplicate UoM code returns 409
- [ ] Delete a category used by a product returns error
