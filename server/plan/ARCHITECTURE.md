# StockSense Backend — Architecture

---

## 1. Architecture Pattern

**Modular Monolith** (single Express.js process, single PostgreSQL database).

No microservices, no message queues, no external workers. All business logic runs synchronously inside request-response cycles.

---

## 2. Layer Diagram

```
HTTP Request
    │
    ▼
[ Express Router ]
    │
    ▼
[ Auth Middleware ] ← JWT verification + role attachment
    │
    ▼
[ Zod Validation Middleware ]
    │
    ▼
[ Controller ] ← thin layer: parse req → call service → send response
    │
    ▼
[ Service ] ← all business logic lives here
    │
    ▼
[ Prisma Client ] ← data access layer (ORM)
    │
    ▼
[ PostgreSQL ]
```

---

## 3. Module Map

| Module | Responsibility |
|---|---|
| `auth` | signup, login, OTP, JWT issue/verify |
| `users` | profile read/update |
| `warehouses` | CRUD + seeded virtual locations on create |
| `locations` | CRUD |
| `categories` | CRUD |
| `uom` | CRUD |
| `products` | CRUD + initial stock handling |
| `partners` | CRUD (suppliers + customers) |
| `operations` | shared: confirm/validate/cancel engine, reference-no generation |
| `stock` | centralised stock_quants mutations (increment/decrement/reserve/release) |
| `receipts` | Receipt-specific create + list |
| `deliveries` | Delivery-specific create + list |
| `transfers` | Transfer-specific create + list |
| `adjustments` | Adjustment-specific create + list |
| `stock-ledger` | Move History read |
| `dashboard` | KPI aggregations |

---

## 4. Shared Services (cross-cutting)

### 4.1 `StockService` (`modules/operations/stock.service.ts`)

The **single point of entry** for all `stock_quants` mutations. No other module writes to `stock_quants` directly.

```
StockService.incrementStock(prismaClient, productId, locationId, qty)
StockService.decrementStock(prismaClient, productId, locationId, qty)  ← throws if insufficient
StockService.reserveStock(prismaClient, productId, locationId, qty)
StockService.releaseReservation(prismaClient, productId, locationId, qty)
StockService.getAvailableQty(prismaClient, productId, locationId) → number
StockService.getOnHandQty(prismaClient, productId, locationId) → number
```

All methods accept a Prisma transaction client so they can be composed inside atomic operations.

### 4.2 `OperationService` (`modules/operations/operation.service.ts`)

Handles the status state machine:

```
OperationService.confirm(operationId, userId)   → DRAFT → WAITING | READY
OperationService.validate(operationId, userId)  → READY → DONE (writes quants + ledger)
OperationService.cancel(operationId, userId)    → !DONE → CANCELED
```

Internally uses `StockService` inside Prisma transactions.

### 4.3 `ReferenceService` (`modules/operations/reference.service.ts`)

Generates `WH1/IN/0001` style reference numbers.

```
ReferenceService.generate(warehouseCode, opCode) → string
```

Uses a DB-level counter (or SELECT MAX + 1 inside a transaction) to ensure uniqueness.

---

## 5. Authentication Flow

```
POST /auth/signup
  → validate input (Zod)
  → check login_id + email uniqueness
  → hash password (bcrypt)
  → create user (is_verified=false)
  → generate 6-digit OTP → store in otp_verifications
  → return {user, message}
  [In hackathon dev mode: also return otp_code for testing]

POST /auth/verify-signup-otp
  → validate OTP (not expired, not used, purpose=SIGNUP_VERIFICATION)
  → mark is_used=true, mark user.is_verified=true
  → return success → frontend redirects to Login

POST /auth/login
  → validate input
  → find user by login_id
  → check is_verified=true (else 403 + specific error)
  → compare password (bcrypt)
  → issue JWT {sub: userId, role, warehouse_id, iat, exp}
  → return {user, token}

POST /auth/forgot-password
  → find user by login_id or email
  → generate OTP → store (purpose=PASSWORD_RESET)
  → return success

POST /auth/verify-reset-otp
  → validate OTP
  → issue short-lived reset_token (signed JWT, purpose=RESET)
  → return {reset_token}

POST /auth/reset-password
  → verify reset_token
  → hash new_password
  → update user
```

---

## 6. Authorization Model

```typescript
// Roles
enum Role { INVENTORY_MANAGER, WAREHOUSE_STAFF }

// Auth middleware attaches to req.user:
{
  userId: bigint,
  role: Role,
  warehouseId: bigint | null  // scope for WAREHOUSE_STAFF
}
```

| Action | Required Role |
|---|---|
| Manage Products/Categories/UoM | INVENTORY_MANAGER |
| Manage Warehouses/Locations | INVENTORY_MANAGER |
| Create Receipts | INVENTORY_MANAGER |
| Validate Receipts | ANY |
| Create/Pick/Validate Deliveries | ANY |
| Create/Validate Transfers | ANY |
| Perform Adjustments | ANY |
| Reassign Responsible | INVENTORY_MANAGER |
| Cancel (non-own DRAFT) | INVENTORY_MANAGER |
| View Dashboard | ANY (STAFF: warehouse-scoped) |
| Manage Users | INVENTORY_MANAGER |

---

## 7. Response Envelope

```typescript
// Single object
{ success: true, data: object }

// List
{ success: true, data: array, meta: { page, limit, total } }

// Error
{ success: false, error: { code: string, message: string } }
```

---

## 8. Error Code Catalogue

| Code | Meaning | HTTP Status |
|---|---|---|
| `VALIDATION_ERROR` | Zod validation failed | 400 |
| `UNAUTHORIZED` | No/invalid token | 401 |
| `FORBIDDEN` | Role insufficient | 403 |
| `NOT_VERIFIED` | Account not OTP-verified | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Duplicate sku/code/login_id/email | 409 |
| `INSUFFICIENT_STOCK` | quantity_done > available | 422 |
| `INVALID_TRANSITION` | Invalid status change | 422 |
| `ALL_LINES_ZERO` | All quantity_done = 0 on validate | 422 |
| `OPERATION_LOCKED` | Operation is DONE/CANCELED | 422 |
| `INTERNAL_ERROR` | Unhandled server error | 500 |

---

## 9. Transaction Boundaries

Every multi-step inventory mutation uses `prisma.$transaction()`:

| Action | Operations in transaction |
|---|---|
| Confirm Delivery/Transfer | reserveStock per line + update operation status |
| Cancel Delivery/Transfer (from WAITING/READY) | releaseReservation per line + update status |
| Validate Receipt | incrementStock per line + writeLedger per line + update status |
| Validate Delivery | decrementStock per line + releaseReservation per line + writeLedger per line + update status |
| Validate Transfer | decrementStock (source) + incrementStock (dest) + writeLedger per line + update status |
| Validate Adjustment | computeDiff + updateStock + writeLedger per line + update status |
| Create Product + initial stock | createProduct + createAdjustment + validateAdjustment |

---

## 10. Seeded Data

The `prisma/seed.ts` script must create:

1. **Virtual locations** (system-owned, not user-deletable):
   - `{ name: 'Vendor', code: 'VENDOR', location_type: 'VENDOR', warehouse_id: null }`
   - `{ name: 'Customer', code: 'CUSTOMER', location_type: 'CUSTOMER', warehouse_id: null }`
   - `{ name: 'Adjustment Virtual', code: 'ADJ_VIRT', location_type: 'ADJUSTMENT_VIRTUAL', warehouse_id: null }`

2. **Admin user** (first INVENTORY_MANAGER — since signup defaults to WAREHOUSE_STAFF):
   - `login_id: 'admin'`, `email: 'admin@stocksense.local'`, `role: INVENTORY_MANAGER`, `is_verified: true`

3. **Default UoM**: pcs, kg, ltr, m
4. **Default Category**: General
