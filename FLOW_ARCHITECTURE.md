# StockSense — End-to-End Flow & Architecture

> This document outlines the architectural blueprint, module flow, and interaction model of StockSense.

---

## 1. System Overview & User Roles

StockSense is a modular, double-entry inventory management system designed for warehouse operations:
- **Inventory Managers:** Master data (warehouses, locations, products, categories, reorder rules), approval, role assignments.
- **Warehouse Staff:** Floor execution (goods receipt, delivery picking/packing, internal transfers, physical counting).

```
                      ┌──────────────────────┐
                      │    Authentication    │
                      │  (Login / Signup /   │
                      │   OTP Verification)  │
                      └──────────┬───────────┘
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │ Authenticated Top-Bar  │
                     │  Navigation & Shell    │
                     └──────────┬─────────────┘
                                │
        ┌───────────────────────┼────────────────────────┬──────────────────────┐
        ▼                       ▼                        ▼                      ▼
┌───────────────┐     ┌───────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Dashboard   │     │   Master Data     │    │ Stock Operations │    │  Stock Ledger   │
│ • KPI Cards   │     │ • Products        │    │ • Receipts       │    │ • Move History  │
│ • X Late      │     │ • Categories      │    │ • Deliveries     │    │ • Audit Logs    │
│ • N to Do     │     │ • Warehouses      │    │ • Transfers      │    │ • Immutable     │
│ • Live Stock  │     │ • Locations       │    │ • Adjustments    │    │   Transactions  │
└───────────────┘     └───────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 2. Route Hierarchy & Navigation Flow

All authenticated pages are wrapped in `/_authenticated` with session validation and top-nav header.

```
/ (Index)
 ├── /auth (Sign In / Sign Up / Contextual OTP / Forgot Password)
 ├── /reset-password (Recovery callback)
 └── /_authenticated (Protected layout with Top Navigation)
      ├── /dashboard (Live KPIs, Receipts/Deliveries status, Warehouse filter)
      ├── /products (Product list, SKU tags, Category filters, Stock inline sub-view)
      ├── /operations/:type (Unified list & Kanban for RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT)
      ├── /operations/:type/:id (Detail view: To Do, Validate, Cancel, Stock Shortage warnings)
      ├── /move-history (Immutable double-entry stock ledger entries)
      ├── /settings (Warehouse & Location management, parent-child racks)
      └── /profile (User account details, warehouse assignment, role display)
```

---

## 3. Operational State Machine Flow

Every physical stock movement passes through one unified status engine:

```
[ DRAFT ] ──────────┐
   │                │
   │ (Confirm)      │ (Confirm if stock short)
   ▼                ▼
[ READY ]       [ WAITING ] ── (Stock becomes available) ──> [ READY ]
   │                │                                           │
   │ (Validate)     │ (Cancel)                                  │ (Validate)
   ▼                ▼                                           ▼
[ DONE ] <──────────┴─────────────── [ CANCELED ] <─────────────┘
 (Writes to Ledger & Updates Live Quants)
```

- **Receipts:** DRAFT → READY (To Do) → DONE (Validate: increases stock).
- **Deliveries:** DRAFT → READY / WAITING (checks source availability) → DONE (Validate: decreases stock).
- **Internal Transfers:** Moves stock from Source Location → Destination Location.
- **Adjustments:** Reconciles Recorded Quantity vs Counted Quantity, logging difference to Ledger.

---

## 4. Double-Entry Stock Ledger Principle

1. `stock_quants` represents the **current live state** (`quantity` and `reserved_quantity`).
2. `stock_ledger_entries` represents the **immutable transaction log**.
3. Direct client updates to `stock_quants` are prohibited. Every change occurs via an operation validation (`validate_operation`), ensuring 100% auditability.
