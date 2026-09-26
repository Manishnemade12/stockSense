# StockSense Backend — Phase Dependencies

---

## Full Dependency Graph

```
Phase 01: Foundation
  Created by: nothing
  Required by: ALL phases

Phase 02: Auth
  Depends on: Phase 01
  Creates: users table, otp_verifications table, JWT middleware
  Required by: ALL authenticated phases

Phase 03: Master Data
  Depends on: Phase 01, Phase 02
  Creates: warehouses, locations, categories, uom, partners tables + CRUD APIs
  Required by: Phase 04, 06, 07, 08, 09, 10

Phase 04: Products
  Depends on: Phase 01, 02, 03 (categories, uom FKs)
  Creates: products table + CRUD APIs
  Required by: Phase 05, 06, 07, 08, 09, 10

Phase 05: Stock Quants
  Depends on: Phase 03 (locations), Phase 04 (products)
  Creates: stock_quants table, StockService
  Required by: Phase 06, 07, 08, 09, 10, 11

Phase 06: Operations Core
  Depends on: Phase 01-05
  Creates: stock_operations, stock_operation_lines, stock_adjustment_lines tables
  Creates: OperationService, ReferenceService
  Required by: Phase 07, 08, 09, 10, 11, 12

Phase 07: Receipts
  Depends on: Phase 06 (operations core + stock service)
  Creates: /receipts CRUD + confirm/validate/cancel
  Required by: Phase 11 (ledger has receipt entries)

Phase 08: Deliveries
  Depends on: Phase 06, Phase 05 (reservation logic)
  Creates: /deliveries CRUD + confirm/validate/cancel
  Required by: Phase 11

Phase 09: Transfers
  Depends on: Phase 06, Phase 05
  Creates: /transfers CRUD + confirm/validate/cancel
  Required by: Phase 11

Phase 10: Adjustments
  Depends on: Phase 06, Phase 05
  Creates: /adjustments CRUD + confirm/validate
  Required by: Phase 11, Phase 13 (quick stock edit uses adjustment internally)

Phase 11: Stock Ledger
  Depends on: Phase 07, 08, 09, 10 (ledger entries exist after validate)
  Creates: /stock-ledger endpoint
  Required by: Phase 12 (dashboard reads ledger indirectly)

Phase 12: Dashboard
  Depends on: Phase 05 (stock_quants), Phase 06-10 (operations exist)
  Creates: /dashboard/kpis endpoint
  Required by: nothing (terminal)

Phase 13: Quick Stock Edit
  Depends on: Phase 10 (uses AdjustmentService.createAndValidate internally)
  Creates: PUT /products/:id/stock/:location_id
  Required by: nothing (terminal)

Phase 14: Profile
  Depends on: Phase 02 (users table, auth middleware)
  Creates: GET/PUT /profile
  Required by: nothing (terminal)

Phase 15: Testing
  Depends on: Phase 01-14 (tests all phases)
  Creates: test files
  Required by: nothing
```

---

## Service Dependency Map

| Service | Depends on |
|---|---|
| AuthService | Prisma (users, otp_verifications) |
| WarehouseService | Prisma (warehouses, locations) |
| LocationService | Prisma (locations) |
| CategoryService | Prisma (product_categories) |
| UomService | Prisma (units_of_measure) |
| PartnerService | Prisma (partners) |
| ProductService | Prisma (products), AdjustmentService (for initial stock) |
| StockService | Prisma (stock_quants) |
| ReferenceService | Prisma (stock_operations) |
| OperationService | StockService, ReferenceService, Prisma |
| ReceiptService | OperationService, Prisma (stock_operations, stock_operation_lines) |
| DeliveryService | OperationService, StockService, Prisma |
| TransferService | OperationService, StockService, Prisma |
| AdjustmentService | OperationService, StockService, Prisma |
| StockLedgerService | Prisma (stock_ledger_entries, stock_operations, locations, partners) |
| DashboardService | Prisma (products, stock_quants, stock_operations) |

---

## Database Model Dependency Order

Migrations must be applied in this order:

```
1. warehouses
2. locations (FK: warehouses, self)
3. users (FK: warehouses)
4. otp_verifications (FK: users)
5. product_categories (FK: self)
6. units_of_measure
7. products (FK: product_categories, units_of_measure)
8. partners
9. stock_quants (FK: products, locations)
10. stock_operations (FK: warehouses, locations, partners, users x2)
11. stock_operation_lines (FK: stock_operations, products, units_of_measure)
12. stock_adjustment_lines (FK: stock_operations, products, locations, units_of_measure)
13. stock_ledger_entries (FK: products, locations, stock_operations, users)
```

Prisma generates one initial migration (`prisma migrate dev --name init`) that handles all tables correctly as long as the schema is written with proper relation definitions.
