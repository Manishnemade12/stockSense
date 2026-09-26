# StockSense Backend — Services & Modules Design

---

## 1. Module Structure Pattern

Every feature module follows:

```
modules/<feature>/
  <feature>.routes.ts     — Express router: maps HTTP verbs to controller methods
  <feature>.controller.ts — Thin: parse req, call service, send response
  <feature>.service.ts    — Business logic
  <feature>.schema.ts     — Zod schemas for input validation
```

---

## 2. Shared / Cross-Cutting Services

### 2.1 StockService (`modules/operations/stock.service.ts`)

Single point of entry for all `stock_quants` mutations. Accepts a Prisma transaction client.

```typescript
export class StockService {
  // Get or create a stock_quant row (upsert)
  static async getOrCreate(tx, productId, locationId): Promise<StockQuant>

  // +qty to stock_quants.quantity
  static async increment(tx, productId, locationId, qty): Promise<void>

  // -qty from stock_quants.quantity
  // throws AppError(INSUFFICIENT_STOCK) if qty > available
  static async decrement(tx, productId, locationId, qty): Promise<void>

  // += qty to reserved_quantity
  static async reserve(tx, productId, locationId, qty): Promise<void>

  // -= qty from reserved_quantity
  static async releaseReservation(tx, productId, locationId, qty): Promise<void>

  // returns quantity - reserved_quantity
  static async getAvailable(tx, productId, locationId): Promise<Decimal>

  // returns quantity
  static async getOnHand(tx, productId, locationId): Promise<Decimal>
}
```

### 2.2 OperationService (`modules/operations/operation.service.ts`)

```typescript
export class OperationService {
  // DRAFT → WAITING | READY
  static async confirm(operationId: bigint, userId: bigint): Promise<StockOperation>

  // READY → DONE (atomic: stock + ledger + status)
  static async validate(operationId: bigint, userId: bigint): Promise<StockOperation>

  // !DONE → CANCELED (releases reservations if WAITING/READY)
  static async cancel(operationId: bigint, userId: bigint): Promise<StockOperation>

  // Internal helpers
  private static async validateReceipt(tx, operation): Promise<void>
  private static async validateDelivery(tx, operation): Promise<void>
  private static async validateTransfer(tx, operation): Promise<void>
  private static async validateAdjustment(tx, operation): Promise<void>
  private static async writeLedger(tx, operation, lines): Promise<void>
}
```

### 2.3 ReferenceService (`modules/operations/reference.service.ts`)

```typescript
export class ReferenceService {
  static OP_CODE = {
    RECEIPT: 'IN',
    DELIVERY: 'OUT',
    INTERNAL_TRANSFER: 'INT',
    ADJUSTMENT: 'ADJ',
  }

  // Generates WH1/IN/0001 — runs inside a transaction to be atomic
  static async generate(tx, warehouseCode: string, operationType: OperationType): Promise<string>
}
```

Implementation: `SELECT reference_no FROM stock_operations WHERE reference_no LIKE '{code}/{opCode}/%' ORDER BY reference_no DESC LIMIT 1` — parse sequence, increment, zero-pad to 4 digits.

---

## 3. Module-by-Module Responsibilities

### 3.1 AuthService

- `signup(dto)` → create user + OTP
- `verifySignupOtp(dto)` → mark verified
- `login(dto)` → validate + issue JWT
- `forgotPassword(dto)` → generate PASSWORD_RESET OTP
- `verifyResetOtp(dto)` → issue reset_token
- `resetPassword(dto)` → update password_hash

**JWT payload**: `{ sub: userId, role, warehouseId, type: 'ACCESS' | 'RESET' }`

**OTP generation**: `Math.floor(100000 + Math.random() * 900000).toString()` (6-digit)

**OTP expiry**: 10 minutes from creation

### 3.2 ProductService

- `createProduct(dto, userId)` → create product; if initial stock given, delegate to `AdjustmentService.createAndValidate()`
- `getProducts(filters)` → paginated list
- `getProductById(id)`
- `updateProduct(id, dto)`
- `softDeleteProduct(id)` → check references first
- `getProductStock(id)` → all stock_quants for product with free_to_use computed
- `quickUpdateStock(id, locationId, countedQty, userId)` → creates+validates internal ADJUSTMENT

### 3.3 WarehouseService

- `create(dto)` → create warehouse + seed default INTERNAL location `Stock`
- `getAll()`, `getById(id)`, `update(id, dto)`, `softDelete(id)`

### 3.4 LocationService

- Standard CRUD
- Block user-creation of VENDOR/CUSTOMER/ADJUSTMENT_VIRTUAL types

### 3.5 ReceiptService

- `create(dto, userId)` → build stock_operations (type=RECEIPT) + lines
  - source_location_id = Vendor virtual location (looked up by location_type=VENDOR)
- `list(filters)` → paginated
- `getById(id)` → full detail + lines
- Confirm/Validate/Cancel delegated to OperationService

### 3.6 DeliveryService

- `create(dto, userId)` → build stock_operations (type=DELIVERY) + lines
  - destination_location_id = Customer virtual location
- Lines response includes `available_at_source`, `is_short` computed fields
- Confirm/Validate/Cancel delegated to OperationService

### 3.7 TransferService

- `create(dto, userId)` → both source and destination locations from request
- Lines response includes `available_at_source`, `is_short`
- Confirm/Validate/Cancel delegated to OperationService

### 3.8 AdjustmentService

- `create(dto, userId)` → create stock_operations (type=ADJUSTMENT, source/dest=null) + stock_adjustment_lines
  - recorded_quantity auto-filled from current stock_quants
  - difference = counted − recorded
- `createAndValidate(dto, userId)` → internal use (product initial stock + quick edit)
- Confirm/Validate/Cancel delegated to OperationService

### 3.9 StockLedgerService

- `list(filters)` → paginated query of stock_ledger_entries joined with stock_operations, partners, locations
- Computes `direction` (IN/OUT) based on quantity_change sign

### 3.10 DashboardService

- `getKpis(warehouseId?)` → runs all 6 KPI aggregation queries

---

## 4. Middleware

### 4.1 `auth.middleware.ts`

```typescript
export const authenticate = (req, res, next) => {
  // Extract Bearer token
  // Verify JWT
  // Attach req.user = { userId, role, warehouseId }
  // next() or 401
}

export const requireRole = (role: UserRole) => (req, res, next) => {
  // Check req.user.role === role
  // next() or 403
}
```

### 4.2 `validate.middleware.ts`

```typescript
export const validate = (schema: ZodSchema) => (req, res, next) => {
  // schema.parse({ body: req.body, query: req.query, params: req.params })
  // Attach parsed data to req.validated
  // next() or 400 VALIDATION_ERROR
}
```

### 4.3 `error.middleware.ts`

```typescript
export const errorHandler = (err, req, res, next) => {
  // Handle AppError (known errors)
  // Handle Prisma errors (P2002 = conflict, etc.)
  // Handle Zod errors
  // Fallback: 500 INTERNAL_ERROR
}
```

---

## 5. AppError Class (`utils/errors.ts`)

```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number
  ) { super(message) }
}

// Factory helpers:
export const Errors = {
  notFound: (msg) => new AppError('NOT_FOUND', msg, 404),
  conflict: (msg) => new AppError('CONFLICT', msg, 409),
  unauthorized: () => new AppError('UNAUTHORIZED', 'Authentication required', 401),
  forbidden: () => new AppError('FORBIDDEN', 'Insufficient permissions', 403),
  notVerified: () => new AppError('NOT_VERIFIED', 'Please verify your account', 403),
  insufficientStock: () => new AppError('INSUFFICIENT_STOCK', 'Not enough stock at source location', 422),
  invalidTransition: (msg) => new AppError('INVALID_TRANSITION', msg, 422),
  operationLocked: () => new AppError('OPERATION_LOCKED', 'Operation is finalized', 422),
  allLinesZero: () => new AppError('ALL_LINES_ZERO', 'At least one line must have quantity_done > 0', 422),
}
```

---

## 6. Response Helper (`utils/response.ts`)

```typescript
export const sendSuccess = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data })

export const sendList = (res, data, meta) =>
  res.status(200).json({ success: true, data, meta })

export const sendError = (res, code, message, statusCode) =>
  res.status(statusCode).json({ success: false, error: { code, message } })
```
