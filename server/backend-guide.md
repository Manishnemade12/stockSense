# StockSense Backend — Comprehensive Architecture & Developer Guide

> **System**: StockSense Inventory Management System (Backend API)  
> **Version**: 1.0.0  
> **Stack**: Node.js · Express.js · TypeScript · PostgreSQL · Prisma ORM · Zod · JWT · Vitest  
> **Repository Location**: `server/`

---

## 1. Executive Summary & Architecture Overview

StockSense is a high-reliability, transactional Inventory Management System designed to handle multi-warehouse inventory movements, stock quant balances, reservation mechanisms, and immutable audit ledgers.

### 1.1 Architecture Highlights
- **Layered Clean Architecture**: Strict separation of concerns across Routes → Middlewares → Controllers → Services → Prisma ORM / Database.
- **Unified Operations Pipeline (TD-001)**: All 4 movement types (`RECEIPT`, `DELIVERY`, `INTERNAL_TRANSFER`, `ADJUSTMENT`) utilize a unified `stock_operations` state machine.
- **Centralized Stock Quant Engine (TD-002)**: Direct writes to `stock_quants` are prohibited outside of `StockService`, ensuring atomic reservation, stock validation, and ledger synchronization.
- **ACID Transaction Guarantee (TD-003)**: Multi-step inventory mutations execute inside `prisma.$transaction()` to eliminate partial updates and phantom inventory.
- **Immutable Ledger (Double-Entry Audit)**: Every physical stock change produces an immutable `stock_ledger_entries` record with running `balance_after`.
- **Computed Free-to-Use Stock (TD-015)**: `free_to_use = quantity - reserved_quantity` is computed dynamically at query time and never stored, eliminating data divergence.

```mermaid
flowchart TD
    Client["Client (Web / Mobile)"] -->|JWT Auth / JSON| ExpressApp["Express Application Layer"]
    
    subgraph MiddlewareLayer ["Middleware Layer"]
        AuthMid["auth.middleware (JWT + Role RBAC)"]
        ValMid["validate.middleware (Zod Schema Validation)"]
        ErrMid["error.middleware (Centralized Error Envelope)"]
    end
    
    subgraph ServiceLayer ["Service & Business Logic"]
        AuthSvc["AuthService (OTP / JWT / Password)"]
        MasterSvc["Master Data Services (Warehouse, Location, Partner, UoM)"]
        ProdSvc["ProductService (Catalog & Stock Breakdown)"]
        OpSvc["OperationService (State Machine: Confirm / Validate / Cancel)"]
        StockSvc["StockService (Quant Mutations & Reservations)"]
        RefSvc["ReferenceService (Atomic Sequence Generation)"]
        ReceiptSvc["ReceiptService (Incoming Operations)"]
    end
    
    subgraph DatabaseLayer ["Database (PostgreSQL via Prisma)"]
        DB_Users[("users & otp_verifications")]
        DB_Master[("warehouses, locations, products, partners, uoms")]
        DB_Ops[("stock_operations & stock_operation_lines")]
        DB_Quants[("stock_quants")]
        DB_Ledger[("stock_ledger_entries")]
    end
    
    ExpressApp --> AuthMid --> ValMid
    ValMid --> ServiceLayer
    ServiceLayer --> StockSvc --> DB_Quants
    ServiceLayer --> OpSvc --> DB_Ops
    OpSvc --> DB_Ledger
    ServiceLayer --> MasterSvc --> DB_Master
    ServiceLayer --> AuthSvc --> DB_Users
    ExpressApp --> ErrMid
```

---

## 2. Directory & Module Structure

```
server/
├── prisma/
│   ├── schema.prisma              # Database models, relations, enums & indexes
│   ├── seed.ts                    # Seeds virtual locations, default UoMs, categories & admin
│   └── migrations/                # Version-controlled SQL migration history
├── src/
│   ├── config/
│   │   └── env.ts                 # Validated environment variables (Zod)
│   ├── middleware/
│   │   ├── auth.middleware.ts     # JWT authentication & role-based access control
│   │   ├── error.middleware.ts    # Centralized HTTP error handler & envelope
│   │   └── validate.middleware.ts # Request body/query/params validation with Zod
│   ├── modules/
│   │   ├── auth/                  # Signup, login, OTP verification & password reset
│   │   ├── warehouses/            # Warehouse CRUD + atomic default location creation
│   │   ├── locations/             # Location CRUD + hierarchy & virtual guard
│   │   ├── categories/            # Product category hierarchy CRUD
│   │   ├── uom/                   # Unit of Measure CRUD
│   │   ├── partners/              # Suppliers & Customers CRUD
│   │   ├── products/              # Product catalog, stock breakdown & inline adjustments
│   │   ├── operations/
│   │   │   ├── stock.service.ts       # Centralized stock quant mutations (increment/decrement/reserve)
│   │   │   ├── operation.service.ts   # State machine engine (confirm/validate/cancel)
│   │   │   └── reference.service.ts   # Sequential reference generator (WH1/IN/0001)
│   │   └── receipts/              # Incoming inventory receipts CRUD & lifecycle
│   ├── prisma/
│   │   └── client.ts              # Exported singleton PrismaClient instance
│   ├── utils/
│   │   ├── errors.ts              # AppError custom exception classes & error factory
│   │   └── response.ts            # Standard success, list & pagination formatters
│   ├── app.ts                     # Express application factory & route mounting
│   └── server.ts                  # Server entry point & graceful shutdown
├── tests/                         # Vitest unit & integration test suites
├── plan/                          # Full phase specifications & architectural docs
└── package.json                   # Project scripts and dependencies
```

---

## 3. Database Schema & Data Models

### 3.1 Key Tables & Relationships

| Table Name | Purpose | Key Columns / Constraints |
|---|---|---|
| `users` | Authenticated users & RBAC roles | `id`, `login_id` (unique), `email` (unique), `role` (`INVENTORY_MANAGER` \| `WAREHOUSE_STAFF`), `is_verified` |
| `otp_verifications` | Temporary 6-digit OTP codes | `id`, `user_id`, `purpose` (`SIGNUP` \| `PASSWORD_RESET`), `otp_code`, `expires_at`, `is_used` |
| `warehouses` | Physical storage facilities | `id`, `name`, `code` (unique, e.g. `WH1`), `address`, `is_active` |
| `locations` | Specific zones/racks/bins inside a warehouse or virtual nodes | `id`, `warehouse_id` (nullable for virtual), `code`, `location_type` (`INTERNAL`, `VENDOR`, `CUSTOMER`, `ADJUSTMENT_VIRTUAL`), `parent_location_id` |
| `product_categories` | Hierarchical categorization of goods | `id`, `name`, `parent_category_id` |
| `units_of_measure` | Measurement units for items | `id`, `name`, `code` (unique, e.g. `pcs`, `kg`, `ltr`, `m`) |
| `products` | Master inventory items | `id`, `name`, `sku` (unique), `barcode`, `category_id`, `uom_id`, `unit_cost`, `reorder_min_qty`, `reorder_max_qty` |
| `partners` | Vendors and Customers | `id`, `name`, `type` (`SUPPLIER` \| `CUSTOMER`), `email`, `phone`, `address` |
| `stock_operations` | Header table for all inventory operations | `id`, `reference_no` (unique), `operation_type` (`RECEIPT`, `DELIVERY`, `INTERNAL_TRANSFER`, `ADJUSTMENT`), `status` (`DRAFT`, `WAITING`, `READY`, `DONE`, `CANCELED`), `warehouse_id`, `source_location_id`, `destination_location_id`, `partner_id`, `scheduled_date`, `validated_date` |
| `stock_operation_lines` | Line items for receipts, deliveries, and transfers | `id`, `operation_id`, `product_id`, `uom_id`, `quantity_planned`, `quantity_done` |
| `stock_adjustment_lines` | Line items for manual count adjustments | `id`, `operation_id`, `product_id`, `location_id`, `uom_id`, `recorded_quantity`, `counted_quantity`, `difference` |
| `stock_quants` | Live physical on-hand and reserved balances | `id`, `product_id`, `location_id`, `quantity`, `reserved_quantity` (Composite unique on `[product_id, location_id]`) |
| `stock_ledger_entries` | Immutable audit log of every movement | `id`, `product_id`, `location_id`, `quantity_change`, `balance_after`, `operation_id`, `operation_type`, `reference_no`, `movement_date`, `created_by` |

### 3.2 Virtual Locations
Virtual locations are system locations created during database seeding (`warehouse_id = null`):
- `VENDOR` (`LocationType.VENDOR`): The infinite source for incoming `RECEIPT` operations.
- `CUSTOMER` (`LocationType.CUSTOMER`): The destination for outgoing `DELIVERY` operations.
- `ADJUSTMENT_VIRTUAL` (`LocationType.ADJUSTMENT_VIRTUAL`): The balancing node for discrepancy reconciliations.

---

## 4. Authentication, Authorization & Security

### 4.1 Role-Based Access Control (RBAC)
StockSense implements two distinct roles:
1. **`INVENTORY_MANAGER`**: Full system control.
   - Master data creation, modification, and soft deletion.
   - Creation of products, initial opening stocks, and receipts.
   - Global warehouse view across all operations, stock quants, and ledgers.
   - Ability to cancel any operation at any stage prior to finalization (`DONE`).
2. **`WAREHOUSE_STAFF`**: Operational warehouse execution.
   - Read access to products, stock balances, and operations.
   - Scoped strictly to their assigned `warehouse_id`.
   - Able to confirm, update done quantities, and validate operations.
   - Can only cancel their own operations while in `DRAFT` status.

### 4.2 Auth Workflows

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant API as Auth API (/auth)
    participant DB as PostgreSQL
    
    Note over User,DB: Signup & Verification Flow
    User->>API: POST /auth/signup (email, login_id, password)
    API->>DB: Create user (is_verified = false) + Insert 6-digit OTP
    API-->>User: 201 Created (includes otp_code for dev)
    User->>API: POST /auth/verify-signup-otp (login_id, otp_code)
    API->>DB: Validate OTP & set user.is_verified = true
    API-->>User: 200 OK ("Account verified")

    Note over User,DB: Login Flow
    User->>API: POST /auth/login (login_id, password)
    API->>DB: Fetch user (check is_verified)
    API-->>User: 200 OK (JWT Access Token)

    Note over User,DB: Password Reset Flow
    User->>API: POST /auth/forgot-password (login_id)
    API->>DB: Generate PASSWORD_RESET OTP
    API-->>User: 200 OK (includes otp_code for dev)
    User->>API: POST /auth/verify-reset-otp (login_id, otp_code)
    API-->>User: 200 OK (JWT Reset Token)
    User->>API: POST /auth/reset-password (reset_token, new_password)
    API->>DB: Hash password with bcrypt & update password_hash
    API-->>User: 200 OK ("Password updated")
```

---

## 5. Operations Core & Inventory State Machine

### 5.1 Status Progression Engine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Create Operation

    DRAFT --> READY : Confirm (Receipts & Adjustments)
    DRAFT --> READY : Confirm (Delivery/Transfer: Stock Available)
    DRAFT --> WAITING : Confirm (Delivery/Transfer: Stock Short)

    WAITING --> READY : Stock Becomes Available / Re-check
    
    READY --> DONE : Validate (Stock Quants Mutate + Ledger Written)
    
    DRAFT --> CANCELED : Cancel
    WAITING --> CANCELED : Cancel (Reservations Released)
    READY --> CANCELED : Cancel (Reservations Released)
    
    DONE --> [*] : Locked (Immutable)
    CANCELED --> [*] : Locked (Immutable)
```

### 5.2 State Machine Rules by Operation Type

#### 1. Receipts (`RECEIPT`)
- **Source**: Virtual `VENDOR` Location
- **Destination**: Active `INTERNAL` Location in Warehouse
- **Confirm**: `DRAFT` → `READY` (skips `WAITING` as vendor capacity is unlimited).
- **Validate**: Increments physical `quantity` at destination location; writes positive ledger entry (`+quantity_done`).

#### 2. Deliveries (`DELIVERY`)
- **Source**: Active `INTERNAL` Location in Warehouse
- **Destination**: Virtual `CUSTOMER` Location
- **Confirm**: Checks `StockService.getAvailable()` at source.
  - If sufficient: transitions to `READY`.
  - If insufficient: transitions to `WAITING`.
  - In both cases: holds reservation (`StockService.reserve`) for `quantity_planned`.
- **Validate**: Checks on-hand stock (`quantity >= quantity_done`), decrements physical `quantity`, releases planned reservation (`StockService.releaseReservation`), and writes negative ledger entry (`-quantity_done`).

#### 3. Internal Transfers (`INTERNAL_TRANSFER`)
- **Source**: `INTERNAL` Location (Source Warehouse)
- **Destination**: `INTERNAL` Location (Destination Warehouse)
- **Confirm**: Reserves stock at source location (`READY` or `WAITING`).
- **Validate**: Decrements source location, increments destination location, releases source reservation, and writes dual ledger entries (`-quantity_done` at source, `+quantity_done` at destination).

#### 4. Inventory Adjustments (`ADJUSTMENT`)
- **Location**: Specific `INTERNAL` Location per line.
- **Confirm**: `DRAFT` → `READY`.
- **Validate**: Calculates `difference = counted_quantity - recorded_quantity`.
  - If `difference > 0`: calls `StockService.increment(difference)`.
  - If `difference < 0`: calls `StockService.decrement(|difference|)`.
  - Writes audit ledger entry with the exact difference and resulting `balance_after`.

### 5.3 Reference Number Sequencing (`ReferenceService`)
Format: `{warehouseCode}/{opCode}/{sequence:4}`
- `RECEIPT`: `WH1/IN/0001`
- `DELIVERY`: `WH1/OUT/0001`
- `INTERNAL_TRANSFER`: `WH1/INT/0001`
- `ADJUSTMENT`: `WH1/ADJ/0001`

Sequence generation runs within the same database transaction as the operation creation using `SELECT MAX(reference_no) ...` to guarantee no duplicated sequence numbers.

---

## 6. Complete API Reference

All protected endpoints require an `Authorization: Bearer <JWT_TOKEN>` header.

### 6.1 Authentication (`/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | Public | Register new user account + generate OTP |
| `POST` | `/auth/verify-signup-otp` | Public | Verify signup OTP and activate account |
| `POST` | `/auth/login` | Public | Authenticate with credentials and receive JWT |
| `POST` | `/auth/forgot-password` | Public | Request password reset OTP |
| `POST` | `/auth/verify-reset-otp` | Public | Verify reset OTP and receive short-lived reset token |
| `POST` | `/auth/reset-password` | Public | Update password using reset token |
| `GET` | `/auth/me` | Bearer | Get current authenticated user profile |
| `POST` | `/auth/logout` | Bearer | Stateless client logout acknowledgement |

### 6.2 Master Data (`/warehouses`, `/locations`, `/categories`, `/uom`, `/partners`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/warehouses` | Any | List active warehouses (supports `?search=`, pagination) |
| `POST` | `/warehouses` | Manager | Create warehouse + automatically seeds default `STOCK` location |
| `GET` | `/warehouses/:id` | Any | Get warehouse details with child locations |
| `PUT` | `/warehouses/:id` | Manager | Update warehouse name/address |
| `DELETE` | `/warehouses/:id` | Manager | Soft-delete warehouse (`is_active = false`) |
| `GET` | `/locations` | Any | List locations (supports `?warehouse_id=`, `?type=`) |
| `POST` | `/locations` | Manager | Create location (blocks manual virtual types) |
| `GET` | `/locations/:id` | Any | Get location details |
| `PUT` | `/locations/:id` | Manager | Update location details |
| `DELETE` | `/locations/:id` | Manager | Soft-delete location |
| `GET` | `/categories` | Any | List product categories |
| `POST` | `/categories` | Manager | Create category |
| `GET` | `/categories/:id` | Any | Get category details |
| `PUT` | `/categories/:id` | Manager | Update category name / parent |
| `DELETE` | `/categories/:id` | Manager | Soft-delete category |
| `GET` | `/uom` | Any | List units of measure |
| `POST` | `/uom` | Manager | Create unit of measure (unique `code`) |
| `GET` | `/uom/:id` | Any | Get unit of measure |
| `PUT` | `/uom/:id` | Manager | Update unit of measure |
| `DELETE` | `/uom/:id` | Manager | Soft-delete unit of measure |
| `GET` | `/partners` | Any | List suppliers and customers (`?type=SUPPLIER\|CUSTOMER`) |
| `POST` | `/partners` | Manager | Create partner |
| `GET` | `/partners/:id` | Any | Get partner details |
| `PUT` | `/partners/:id` | Manager | Update partner |
| `DELETE` | `/partners/:id` | Manager | Soft-delete partner |

### 6.3 Products & Stock (`/products`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/products` | Any | Paginated product list with category and UoM |
| `POST` | `/products` | Manager | Create product (optional opening stock creates automatic adjustment) |
| `GET` | `/products/:id` | Any | Get product details |
| `PUT` | `/products/:id` | Manager | Update product attributes (SKU immutable) |
| `DELETE` | `/products/:id` | Manager | Soft-delete product |
| `GET` | `/products/:id/stock` | Any | Per-location breakdown (`on_hand`, `reserved`, `free_to_use`) |
| `PUT` | `/products/:id/stock/:location_id` | Any | Quick inline stock update (creates adjustment + ledger) |

### 6.4 Receipts (`/receipts`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/receipts` | Any | List receipts (`?status=`, `?warehouse_id=`, `?search=`, computed `is_late`) |
| `POST` | `/receipts` | Manager | Create receipt in `DRAFT` (auto source = `VENDOR`) |
| `GET` | `/receipts/:id` | Any | Detailed receipt view with lines (`is_short = false`) |
| `PUT` | `/receipts/:id` | Any | Update notes, responsible user, and line quantities before finalization |
| `POST` | `/receipts/:id/confirm` | Any | Transition `DRAFT` → `READY` |
| `POST` | `/receipts/:id/validate` | Any | Transition `READY` → `DONE` (increments stock, writes ledger) |
| `POST` | `/receipts/:id/cancel` | Any | Cancel receipt (`!DONE` → `CANCELED`) |
| `GET` | `/receipts/:id/print` | Any | Get formatted printable slip data (`DONE` status only) |

---

## 7. Response Envelope & Standard Error Formats

### 7.1 Single Entity Success Envelope (200 / 201)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Main Warehouse",
    "code": "WH1"
  }
}
```

### 7.2 Paginated List Envelope (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reference_no": "WH1/IN/0001",
      "status": "READY",
      "is_late": false
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### 7.3 Standard Error Envelope (4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough stock at source location: required 20, available 5"
  }
}
```

### 7.4 Standard System Error Codes
- `VALIDATION_ERROR` (400): Schema or type failure
- `BAD_REQUEST` (400): Malformed input or invalid relationship
- `UNAUTHORIZED` (401): Missing or invalid JWT
- `FORBIDDEN` (403): Role authorization failure
- `NOT_VERIFIED` (403): Account requires OTP activation
- `NOT_FOUND` (404): Entity does not exist
- `CONFLICT` (409): Unique constraint violation (e.g. duplicate SKU or warehouse code)
- `INSUFFICIENT_STOCK` (422): Quantity requested exceeds available balance
- `INVALID_TRANSITION` (422): State machine violation (e.g. validating from DRAFT)
- `ALL_LINES_ZERO` (422): Validation attempted without done quantities
- `OPERATION_LOCKED` (422): Mutation attempted on `DONE` or `CANCELED` records
- `INTERNAL_ERROR` (500): Unhandled exception

---

## 8. Setup, Environment & Execution

### 8.1 Prerequisites
- **Node.js**: v18.0.0+ (v20+ recommended)
- **PostgreSQL**: v14+
- **npm** or **pnpm**

### 8.2 Environment Configuration (`.env`)
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stocksense?schema=public
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars-long
JWT_EXPIRES_IN=7d
OTP_EXPIRES_MINUTES=10
```

### 8.3 CLI Commands & Scripts

```bash
# Install dependencies
npm install

# Run database migrations
npm run prisma:migrate

# Seed database (Virtual locations, default UoMs, categories, admin user)
npm run prisma:seed

# Start development server with hot reload
npm run dev

# Run full Vitest test suite
npm test

# Run TypeScript compilation check
npm run build

# Start production server
npm start
```

### 8.4 Default Seeded Accounts & Master Data
- **Admin User**:
  - `login_id`: `admin`
  - `password`: `Admin@1234`
  - `role`: `INVENTORY_MANAGER`
  - `is_verified`: `true`
- **Default Units of Measure**: `Pieces` (`pcs`), `Kilograms` (`kg`), `Liters` (`ltr`), `Meters` (`m`)
- **Default Category**: `General`
- **Virtual Locations**: `Vendor` (`VENDOR`), `Customer` (`CUSTOMER`), `Adjustment Virtual` (`ADJ_VIRT`)

---

## 9. Current Implementation Status

| Phase | Module | Status | Highlights |
|---|---|---|---|
| **01** | Foundation & Infrastructure | ✅ Complete | Express, Prisma client, standard response envelopes, centralized error middleware, environment validation |
| **02** | Authentication & User Management | ✅ Complete | Signup OTP, account verification, login, password reset flow, JWT issuance & auth RBAC middleware |
| **03** | Master Data Management | ✅ Complete | Warehouses (with atomic default location), locations (hierarchy & virtual protection), categories, UoMs, partners |
| **04** | Product Management | ✅ Complete | Product catalog, SKU uniqueness, opening stock adjustment flow, per-location stock breakdown, inline quick stock adjustment |
| **05** | Stock Quants & StockService | ✅ Complete | Centralized `StockService` with transactional mutations (`increment`, `decrement`, `reserve`, `releaseReservation`, `getAvailable`, `getOnHand`) |
| **06** | Operations Core & Reference Service | ✅ Complete | Unified state engine (`confirm`, `validate`, `cancel`), sequential reference generation (`WH1/IN/0001`), immutable stock ledger audit writes |
| **07** | Receipts | ✅ Complete | Incoming stock operations, automatic vendor routing, status lifecycle, stock increments, ledger entries, print slip endpoint |

---

## 10. Quality Assurance & Test Coverage

All test suites execute through Vitest and enforce transaction isolation, mock fidelity, and role gating.

```
✓ tests/operations_core.test.ts (17 tests)
✓ tests/receipts.test.ts (12 tests)
✓ tests/products.test.ts (13 tests)
✓ tests/auth.test.ts (18 tests)
✓ tests/stock_service.test.ts (9 tests)
✓ tests/master_data.test.ts (16 tests)
✓ tests/response.test.ts (3 tests)
✓ tests/middleware.test.ts (5 tests)
✓ tests/health.test.ts (2 tests)

Test Files  9 passed (9)
Tests       95 passed (95)
Build       0 TypeScript Errors (Clean)
```
