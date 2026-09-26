# StockSense Backend — Master Plan

> **Stack**: TypeScript · Node.js · Express.js · PostgreSQL · Prisma · Zod · JWT + bcrypt · Vitest  
> **Constraint**: 7–8 hour hackathon — prioritise correctness, dependency-safety, and speed.

---

## 1. High-Level Overview

StockSense is a modular Inventory Management System. The backend exposes a REST API consumed by the frontend. All inventory state changes (stock levels, ledger entries) are funnelled through a single, unified operations pipeline.

### Core domain objects

| Domain | Key entities |
|---|---|
| Auth | users, otp_verifications |
| Master data | warehouses, locations, product_categories, units_of_measure, products, partners |
| Operations | stock_operations, stock_operation_lines, stock_adjustment_lines |
| Stock state | stock_quants |
| Audit trail | stock_ledger_entries |

---

## 2. Phase Summary

| Phase | Name | Est. Time | Priority |
|---|---|---|---|
| 01 | Project Foundation & Infrastructure | 30 min | P0 |
| 02 | Authentication & User Management | 60 min | P0 |
| 03 | Master Data (Warehouse, Location, Category, UoM) | 45 min | P0 |
| 04 | Product Management | 45 min | P0 |
| 05 | Stock Quants & Stock State | 30 min | P0 |
| 06 | Operations Core (CRUD + Status Engine) | 90 min | P0 |
| 07 | Receipts | 30 min | P0 |
| 08 | Deliveries | 30 min | P0 |
| 09 | Internal Transfers | 30 min | P0 |
| 10 | Inventory Adjustments | 30 min | P0 |
| 11 | Stock Ledger & Move History | 20 min | P0 |
| 12 | Dashboard KPIs | 20 min | P0 |
| 13 | Quick Stock Edit (Products → Stock inline) | 20 min | P0 |
| 14 | Profile | 15 min | P1 |
| 15 | Testing (critical paths) | 60 min | P1 |

**Total estimated**: ~7.5 hours

---

## 3. Dependency Chain

```
Phase 01 (Foundation)
  └─► Phase 02 (Auth)
        └─► Phase 03 (Master Data)
              └─► Phase 04 (Products)
                    └─► Phase 05 (Stock Quants)
                          └─► Phase 06 (Operations Core)
                                ├─► Phase 07 (Receipts)
                                ├─► Phase 08 (Deliveries)
                                ├─► Phase 09 (Transfers)
                                └─► Phase 10 (Adjustments)
                                      └─► Phase 11 (Ledger)
                                            └─► Phase 12 (Dashboard)
                                                  └─► Phase 13 (Quick Stock Edit)
                                                        └─► Phase 14 (Profile)
                                                              └─► Phase 15 (Testing)
```

---

## 4. Priority Classification

### P0 — Critical (must demo)
- User signup / login / OTP verification
- Warehouse + Location + Category + UoM CRUD
- Product CRUD
- Receipt create → confirm → validate (stock increases)
- Delivery create → confirm → validate (stock decreases, reservation)
- Internal Transfer create → confirm → validate
- Inventory Adjustment create → confirm → validate
- Stock Ledger (Move History)
- Dashboard KPIs
- Stock Quants live state

### P1 — Important (implement if time permits)
- Password reset via OTP
- Profile view/edit
- Unit tests for critical paths
- Soft-delete reference checking
- Print endpoint for DONE operations

### P2 — Optional (do not compromise P0)
- Reordering rules automation
- Low-stock notifications
- Kanban view grouping logic (same data endpoint — no extra backend work needed)

---

## 5. Key Architectural Decisions

See `TECHNICAL_DECISIONS.md` for full details. Summary:

1. **Unified operations table** — all 4 operation types share `stock_operations`.
2. **Centralised `StockService`** — all `stock_quants` mutations go through one service.
3. **Prisma transactions** — every Validate action runs atomically.
4. **Reference number** generated server-side using per-(warehouse, op_code) sequence.
5. **OTP stored in DB** (no external email service needed for hackathon — return OTP in API response during dev, flag for prod).
6. **No background jobs required** — all operations are synchronous request-response.
7. **No external integrations required** — standalone backend.

---

## 6. Folder Structure (target)

```
server/
├── src/
│   ├── app.ts                  # Express app setup
│   ├── server.ts               # Entry point
│   ├── config/
│   │   └── env.ts              # Zod-validated env vars
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validate.middleware.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts
│   │   ├── users/
│   │   ├── warehouses/
│   │   ├── locations/
│   │   ├── categories/
│   │   ├── uom/
│   │   ├── products/
│   │   ├── partners/
│   │   ├── operations/         # shared operation logic
│   │   │   ├── operation.service.ts
│   │   │   ├── stock.service.ts
│   │   │   └── reference.service.ts
│   │   ├── receipts/
│   │   ├── deliveries/
│   │   ├── transfers/
│   │   ├── adjustments/
│   │   ├── stock-ledger/
│   │   └── dashboard/
│   ├── prisma/
│   │   └── client.ts
│   └── utils/
│       ├── response.ts
│       └── errors.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── plan/
├── tests/
│   └── *.test.ts
├── .env
├── package.json
└── tsconfig.json
```

---

## 7. Living Plan Rules

1. Update this file whenever a phase is completed.
2. If a technical decision changes, update `TECHNICAL_DECISIONS.md` first, then propagate.
3. Never leave phase documentation inconsistent with the actual implementation.
4. Mark completed phases with ✅ as we proceed.
