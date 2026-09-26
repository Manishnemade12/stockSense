# StockSense Backend — Technical Decisions

This file records every significant technical decision made during planning so that implementers understand the reasoning and do not accidentally reverse them.

---

## TD-001: Unified operations table

**Decision**: All four operation types (RECEIPT, DELIVERY, INTERNAL_TRANSFER, ADJUSTMENT) share a single `stock_operations` table.

**Rationale**: The status state machine, reference number scheme, responsible user, warehouse scoping, and ledger relationship are identical across all types. A unified table eliminates duplication, simplifies cross-type queries (Dashboard KPIs, Move History), and keeps the ORM layer thin.

**Impact**: `operation_type` column discriminates the type. Some fields are nullable and only relevant to specific types (e.g. `partner_id` is null for TRANSFER/ADJUSTMENT; `source/destination_location_id` is null for ADJUSTMENT). Controllers/services are split per type for clarity but share the OperationService state engine.

---

## TD-002: Centralised StockService

**Decision**: All reads and writes to `stock_quants` go through `StockService`. No module writes directly to `stock_quants` outside of `StockService` methods.

**Rationale**: Prevents accidental bypassing of reservation logic, balance validation, and the rule that stock changes only happen at Validate time. Makes it easy to audit and test.

**Impact**: Every validate action calls `StockService.*` methods inside a Prisma transaction.

---

## TD-003: Prisma transactions for all multi-step mutations

**Decision**: Every Validate action (and Confirm for Delivery/Transfer) wraps all DB writes in `prisma.$transaction()`.

**Rationale**: An interrupted validate (stock updated but ledger not written, or status not flipped) would leave the database in an inconsistent state. Transactions guarantee atomicity.

**Impact**: All StockService methods accept a Prisma transaction client (`tx`) as first argument so they can be called within a transaction scope.

---

## TD-004: Reference number generation strategy

**Decision**: Reference numbers (`WH1/IN/0001`) are generated server-side using a `SELECT MAX + 1` pattern inside the same transaction that creates the operation.

**Rationale**: A dedicated sequence table would need an extra migration and management. For a hackathon monolith, MAX+1 inside a transaction is safe (no concurrent requests can interleave within the same Postgres transaction).

**Impact**: `ReferenceService.generate()` must always be called inside a `prisma.$transaction()` context to prevent race conditions under concurrent load (acceptable for hackathon scale).

**Format**: `{warehouseCode}/{opCode}/{sequence.padStart(4,'0')}` e.g. `WH1/IN/0001`

| OperationType | opCode |
|---|---|
| RECEIPT | IN |
| DELIVERY | OUT |
| INTERNAL_TRANSFER | INT |
| ADJUSTMENT | ADJ |

---

## TD-005: OTP stored in DB, returned in API response during development

**Decision**: OTPs are stored in the `otp_verifications` table. During hackathon development, the OTP code is returned in the API response body so the frontend can test without a real email server.

**Rationale**: Setting up an email SMTP service would take time and introduce a dependency. For a hackathon demo, the OTP in the response is sufficient.

**Impact**: The `otp_code` field appears in the signup/forgot-password response payload. This would be removed (replaced by actual email sending) before production.

---

## TD-006: No background jobs required

**Decision**: No background jobs, cron tasks, or async workers are implemented.

**Rationale**: Review of all technical documents shows no requirement for async processing:
- Stock updates happen synchronously at validate time
- Low-stock alerts are surfaced via Dashboard KPI queries (polled by frontend), not pushed
- No scheduled reports required
- No external webhooks required

**Impact**: See `BACKGROUND_JOBS.md` for the full analysis.

---

## TD-007: No external integrations required

**Decision**: No external third-party services or APIs are integrated.

**Rationale**: The technical specification is entirely self-contained. No payment, shipping, ERP, or notification service is referenced.

**Impact**: See `EXTERNAL_INTEGRATIONS.md`.

---

## TD-008: Soft delete for master data

**Decision**: Products, warehouses, locations, categories, UoM, and partners are never hard-deleted if they are referenced by any non-canceled operation. Soft delete sets `is_active = false`.

**Rationale**: Historical ledger entries and operations must remain readable even after an entity is "deleted". Hard delete would violate FK constraints.

**Impact**: All list endpoints filter `is_active = true` by default. GET by ID returns even inactive records for historical context.

---

## TD-009: Adjustment lines use a separate table

**Decision**: Adjustment operations use `stock_adjustment_lines` (with `recorded_quantity`, `counted_quantity`, `difference`) rather than the shared `stock_operation_lines` table.

**Rationale**: Adjustments require fields (`recorded_quantity`, `difference`) that don't exist on normal operation lines. Forcing nulls into `stock_operation_lines` would pollute the schema.

**Impact**: The Adjustment service queries `stock_adjustment_lines`; all others query `stock_operation_lines`. OperationService's `writeLedger()` handles both cases.

---

## TD-010: Warehouse creation auto-seeds a default INTERNAL location

**Decision**: `POST /warehouses` automatically creates a default INTERNAL location (`name: 'Stock', code: 'STOCK'`) for the new warehouse.

**Rationale**: Receipts always need a destination INTERNAL location. Without auto-seeding, a user would have to remember to create a location before creating any receipt. This reduces friction.

**Impact**: WarehouseService.create() wraps warehouse + location creation in one transaction.

---

## TD-011: WAREHOUSE_STAFF scope for dashboard and ledger

**Decision**: When a WAREHOUSE_STAFF user calls dashboard/ledger endpoints, responses are filtered to their `warehouse_id`. INVENTORY_MANAGER sees all warehouses.

**Rationale**: Directly from the permission matrix in the technical spec (§3).

**Impact**: Auth middleware attaches `req.user.warehouseId`. Dashboard and ledger services check `req.user.role` and apply the filter conditionally.

---

## TD-012: Login requires is_verified = true

**Decision**: If a user attempts login before OTP verification, a specific 403 error (`NOT_VERIFIED`) is returned rather than a generic 401.

**Rationale**: Directly stated in the technical spec §8 rule 8. The frontend needs to distinguish this case to show the "verify your account" prompt.

**Impact**: AuthService.login() checks `is_verified` before password comparison.

---

## TD-013: Partial validation allowed (no PARTIALLY_DONE state)

**Decision**: If `quantity_done < quantity_planned` on some lines, Validate still proceeds to DONE. There is no PARTIALLY_DONE state. Unfulfilled quantities are not auto-converted to backorders.

**Rationale**: Directly from the technical spec §8 rule 2.

**Impact**: Ledger entries use `quantity_done` values, not `quantity_planned`.

---

## TD-014: Admin user seeded via seed.ts

**Decision**: The first INVENTORY_MANAGER account is created by `prisma/seed.ts`, not through the signup flow.

**Rationale**: The technical spec §9 identifies this as a real gap: signup always defaults to WAREHOUSE_STAFF. A seeded admin is the simplest solution for the hackathon.

**Impact**: seed.ts creates `{ login_id: 'admin', password: 'Admin@1234', role: INVENTORY_MANAGER, is_verified: true }`.

---

## TD-015: `free_to_use` is a computed field, never stored

**Decision**: `free_to_use = quantity − reserved_quantity` is computed at read time and never persisted to the database.

**Rationale**: Directly from the technical spec §4.2 stock_quants note.

**Impact**: All endpoints returning stock data must compute this value in the service layer.
