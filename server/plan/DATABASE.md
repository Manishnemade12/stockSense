# StockSense Backend — Database Design

> ORM: Prisma · DB: PostgreSQL  
> Conventions: snake_case fields, BIGSERIAL PKs, TIMESTAMPTZ dates, NUMERIC(14,3) qty, NUMERIC(14,2) money, native enums.

---

## 1. Enums

```prisma
enum UserRole {
  INVENTORY_MANAGER
  WAREHOUSE_STAFF
}

enum OperationType {
  RECEIPT
  DELIVERY
  INTERNAL_TRANSFER
  ADJUSTMENT
}

enum OperationStatus {
  DRAFT
  WAITING
  READY
  DONE
  CANCELED
}

enum PartnerType {
  SUPPLIER
  CUSTOMER
}

enum LocationType {
  INTERNAL
  VENDOR
  CUSTOMER
  ADJUSTMENT_VIRTUAL
}

enum OtpPurpose {
  SIGNUP_VERIFICATION
  PASSWORD_RESET
}
```

---

## 2. Models

### 2.1 users

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| login_id | String @unique @db.VarChar(60) | UNIQUE, NOT NULL | Login credential, not email |
| email | String @unique @db.VarChar(160) | UNIQUE, NOT NULL | OTP delivery / notifications |
| full_name | String? @db.VarChar(120) | nullable | Filled via Profile later |
| password_hash | String @db.Text | NOT NULL | Never returned in API |
| role | UserRole @default(WAREHOUSE_STAFF) | NOT NULL | |
| warehouse_id | BigInt? | FK → warehouses, nullable | STAFF scope |
| phone | String? @db.VarChar(20) | nullable | |
| is_verified | Boolean @default(false) | NOT NULL | Login blocked if false |
| is_active | Boolean @default(true) | NOT NULL | |
| created_at | DateTime @default(now()) @db.Timestamptz | NOT NULL | |
| updated_at | DateTime @updatedAt @db.Timestamptz | NOT NULL | |

### 2.2 otp_verifications

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| user_id | BigInt | FK → users, NOT NULL | |
| purpose | OtpPurpose | NOT NULL | |
| otp_code | String @db.VarChar(6) | NOT NULL | |
| expires_at | DateTime @db.Timestamptz | NOT NULL | now() + 10 min |
| is_used | Boolean @default(false) | NOT NULL | |
| created_at | DateTime @default(now()) @db.Timestamptz | NOT NULL | |

### 2.3 warehouses

| Column | Prisma type | Constraints |
|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK |
| name | String @db.VarChar(120) | NOT NULL |
| code | String @unique @db.VarChar(20) | UNIQUE, NOT NULL |
| address | String? @db.Text | nullable |
| is_active | Boolean @default(true) | NOT NULL |
| created_at | DateTime @default(now()) @db.Timestamptz | |
| updated_at | DateTime @updatedAt @db.Timestamptz | |

### 2.4 locations

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| warehouse_id | BigInt? | FK → warehouses, nullable | null for VENDOR/CUSTOMER/ADJ_VIRTUAL |
| parent_location_id | BigInt? | FK → locations (self), nullable | nested locations |
| name | String @db.VarChar(120) | NOT NULL | |
| code | String @db.VarChar(30) | NOT NULL | |
| location_type | LocationType | NOT NULL | |
| is_active | Boolean @default(true) | NOT NULL | |

**Unique constraint**: `@@unique([warehouse_id, code])` — code unique within a warehouse.

### 2.5 product_categories

| Column | Prisma type | Constraints |
|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK |
| name | String @db.VarChar(100) | NOT NULL |
| parent_category_id | BigInt? | FK → product_categories (self), nullable |

### 2.6 units_of_measure

| Column | Prisma type | Constraints |
|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK |
| name | String @db.VarChar(40) | NOT NULL |
| code | String @unique @db.VarChar(10) | UNIQUE, NOT NULL |

### 2.7 products

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| name | String @db.VarChar(150) | NOT NULL | |
| sku | String @unique @db.VarChar(60) | UNIQUE, NOT NULL | |
| barcode | String? @db.VarChar(60) | nullable | |
| category_id | BigInt | FK → product_categories, NOT NULL | |
| uom_id | BigInt | FK → units_of_measure, NOT NULL | |
| unit_cost | Decimal @default(0) @db.Decimal(14,2) | NOT NULL | |
| description | String? @db.Text | nullable | |
| reorder_min_qty | Decimal @default(0) @db.Decimal(14,3) | NOT NULL | |
| reorder_max_qty | Decimal? @db.Decimal(14,3) | nullable | |
| is_active | Boolean @default(true) | NOT NULL | |
| created_at | DateTime @default(now()) @db.Timestamptz | | |
| updated_at | DateTime @updatedAt @db.Timestamptz | | |

### 2.8 partners

| Column | Prisma type | Constraints |
|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK |
| name | String @db.VarChar(150) | NOT NULL |
| type | PartnerType | NOT NULL |
| email | String? @db.VarChar(160) | nullable |
| phone | String? @db.VarChar(20) | nullable |
| address | String? @db.Text | nullable |
| is_active | Boolean @default(true) | NOT NULL |

### 2.9 stock_operations

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| reference_no | String @unique @db.VarChar(30) | UNIQUE, NOT NULL | Server-generated: WH1/IN/0001 |
| operation_type | OperationType | NOT NULL | |
| status | OperationStatus @default(DRAFT) | NOT NULL | |
| warehouse_id | BigInt | FK → warehouses, NOT NULL | |
| source_location_id | BigInt? | FK → locations, nullable | null for ADJUSTMENT |
| destination_location_id | BigInt? | FK → locations, nullable | null for ADJUSTMENT |
| partner_id | BigInt? | FK → partners, nullable | required for RECEIPT/DELIVERY |
| scheduled_date | DateTime @db.Timestamptz | NOT NULL | |
| validated_date | DateTime? @db.Timestamptz | nullable | Set on Validate |
| created_by | BigInt | FK → users, NOT NULL | Immutable after creation |
| responsible_user_id | BigInt? | FK → users, nullable | Reassignable by Manager |
| notes | String? @db.Text | nullable | |
| created_at | DateTime @default(now()) @db.Timestamptz | | |
| updated_at | DateTime @updatedAt @db.Timestamptz | | |

**Indexes**:
- `@@index([operation_type, status])`
- `@@index([warehouse_id])`
- `@@index([scheduled_date])`

### 2.10 stock_operation_lines

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| operation_id | BigInt | FK → stock_operations, NOT NULL | |
| product_id | BigInt | FK → products, NOT NULL | |
| uom_id | BigInt | FK → units_of_measure, NOT NULL | defaults from product |
| quantity_planned | Decimal @db.Decimal(14,3) | NOT NULL | |
| quantity_done | Decimal @default(0) @db.Decimal(14,3) | NOT NULL | |
| notes | String? @db.Text | nullable | |

**Indexes**: `@@index([operation_id])`, `@@index([product_id])`

### 2.11 stock_adjustment_lines

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| operation_id | BigInt | FK → stock_operations, NOT NULL | |
| product_id | BigInt | FK → products, NOT NULL | |
| location_id | BigInt | FK → locations, NOT NULL | |
| uom_id | BigInt | FK → units_of_measure, NOT NULL | |
| recorded_quantity | Decimal @db.Decimal(14,3) | NOT NULL | Auto-filled from stock_quants |
| counted_quantity | Decimal @db.Decimal(14,3) | NOT NULL | User input |
| difference | Decimal @db.Decimal(14,3) | NOT NULL | Backend-computed: counted − recorded |

### 2.12 stock_quants

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| product_id | BigInt | FK → products, NOT NULL | |
| location_id | BigInt | FK → locations, NOT NULL | |
| quantity | Decimal @default(0) @db.Decimal(14,3) | NOT NULL | On-hand |
| reserved_quantity | Decimal @default(0) @db.Decimal(14,3) | NOT NULL | Reserved by WAITING/READY ops |
| updated_at | DateTime @updatedAt @db.Timestamptz | | |

**Unique constraint**: `@@unique([product_id, location_id])`  
**Computed (not stored)**: `free_to_use = quantity − reserved_quantity`

### 2.13 stock_ledger_entries

| Column | Prisma type | Constraints | Notes |
|---|---|---|---|
| id | BigInt @id @default(autoincrement()) | PK | |
| product_id | BigInt | FK → products, NOT NULL | |
| location_id | BigInt | FK → locations, NOT NULL | |
| quantity_change | Decimal @db.Decimal(14,3) | NOT NULL | Signed (+/-) |
| balance_after | Decimal @db.Decimal(14,3) | NOT NULL | Running balance at location |
| operation_id | BigInt | FK → stock_operations, NOT NULL | |
| operation_type | OperationType | NOT NULL | Denormalized for query speed |
| reference_no | String @db.VarChar(30) | NOT NULL | Denormalized |
| movement_date | DateTime @db.Timestamptz | NOT NULL | |
| created_by | BigInt | FK → users, NOT NULL | |

**Indexes**: `@@index([product_id])`, `@@index([location_id])`, `@@index([operation_id])`, `@@index([movement_date])`

---

## 3. Key Constraints Summary

| Rule | Enforcement |
|---|---|
| SKU uniqueness | DB UNIQUE constraint on products.sku |
| Warehouse code uniqueness | DB UNIQUE constraint on warehouses.code |
| UoM code uniqueness | DB UNIQUE constraint on units_of_measure.code |
| One quant per (product, location) | DB UNIQUE constraint on stock_quants |
| Reference number uniqueness | DB UNIQUE constraint on stock_operations.reference_no |
| login_id uniqueness | DB UNIQUE constraint on users.login_id |
| email uniqueness | DB UNIQUE constraint on users.email |
| Soft delete (never hard-delete referenced rows) | Application-level check before is_active=false |

---

## 4. Cascade Rules

| Relation | On delete |
|---|---|
| stock_operations → stock_operation_lines | CASCADE (lines die with operation) |
| stock_operations → stock_adjustment_lines | CASCADE |
| stock_operations → stock_ledger_entries | RESTRICT (ledger is immutable, shouldn't cascade) |
| users → otp_verifications | CASCADE |
| All other FKs | RESTRICT (use soft delete instead) |

---

## 5. Migration Strategy

1. `prisma migrate dev --name init` creates all tables.
2. `prisma db seed` runs `seed.ts` to seed virtual locations, admin user, default UoM, default category.
3. Each subsequent phase that adds a model runs a new named migration.
4. Never manually alter the DB schema — always use Prisma migrations.
