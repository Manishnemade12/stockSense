# StockSense: System Architecture & Technical Design

## 1. Architectural Philosophy
StockSense is an enterprise-grade Inventory & Warehouse Operating System built upon the mathematical foundation of **Double-Entry Bookkeeping applied to Physical Assets**.

In traditional accounting:
$$\text{Debits} = \text{Credits}$$

In StockSense:
$$\Delta \text{Stock}(\text{Source Location}) = -\Delta \text{Stock}(\text{Destination Location})$$

Inventory is never created or destroyed arbitrarily. Every stock modification represents an audited transfer between two distinct locations:
- **Physical Locations:** Internal warehouse zones, racks, aisles, shelves, and bins.
- **Virtual Locations:** System boundary locations representing external entities:
  - `Vendors` (Inbound origin for Receipts)
  - `Customers` (Outbound destination for Deliveries)
  - `Inventory Loss / Gain` (Adjustments and count reconciliations)
  - `Scrap / Damaged` (Quarantine and decommissioned goods)

---

## 2. High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientTier ["Client Tier (React 19 + TypeScript)"]
        UI_Landing["Landing Page (/)"]
        UI_Auth["Auth & OTP Wizard (/auth)"]
        UI_Dash["Dashboard & KPIs (/dashboard)"]
        UI_Ops["Operations Grid & Kanban (/operations/$type)"]
        UI_Detail["Operation Detail (/operations/$type/$id)"]
        UI_Prod["Products & Stock Breakdown (/products)"]
        UI_Ledger["Stock Move Ledger (/move-history)"]
        UI_Settings["Master Data & RBAC Settings (/settings)"]
        
        API_Client["Centralized REST Client (apiClient.ts)"]
        Auth_State["Auth Session Store (JWT in LocalStorage)"]
    end

    subgraph GatewayTier ["Gateway Tier (Vite Proxy + Express)"]
        Proxy["Vite Dev Proxy (/api to http://localhost:5000)"]
        Express["Express.js Server (Port 5000)"]
        Auth_Middleware["authenticate (JWT Validation)"]
        RBAC_Middleware["requireRole (Role Guard)"]
        Zod_Middleware["validate (Zod Schema)"]
    end

    subgraph ServiceTier ["Service Tier (Business Logic & State Machines)"]
        S_Auth["AuthService (Bcrypt, JWT, OTP)"]
        S_Email["EmailService (Resend Email API)"]
        S_Ops["OperationService (Confirm, Reserve, Validate, Cancel)"]
        S_Stock["StockService (Quant Management, Availability Math)"]
        S_Prod["ProductService (Catalog, Initial Adjustment)"]
        S_Ledger["LedgerService (Immutable Audit Records)"]
        S_Master["MasterDataService (Warehouses, Locations, Partners)"]
    end

    subgraph DataTier ["Data Tier (Prisma + PostgreSQL)"]
        Prisma["Prisma ORM 5.22"]
        Postgres[("PostgreSQL Database (stocksense)")]
    end

    UI_Landing --> API_Client
    UI_Auth --> API_Client
    UI_Dash --> API_Client
    UI_Ops --> API_Client
    UI_Detail --> API_Client
    UI_Prod --> API_Client
    UI_Ledger --> API_Client
    UI_Settings --> API_Client
    API_Client --> Auth_State
    API_Client --> Proxy
    Proxy --> Express
    Express --> Auth_Middleware
    Auth_Middleware --> Zod_Middleware
    Zod_Middleware --> RBAC_Middleware
    RBAC_Middleware --> S_Auth
    RBAC_Middleware --> S_Ops
    RBAC_Middleware --> S_Stock
    RBAC_Middleware --> S_Prod
    RBAC_Middleware --> S_Ledger
    RBAC_Middleware --> S_Master
    S_Auth --> Prisma
    S_Ops --> Prisma
    S_Stock --> Prisma
    S_Prod --> Prisma
    S_Ledger --> Prisma
    S_Master --> Prisma
    Prisma --> Postgres
```

---

## 3. Stock State Machine & Reservation Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Create Operation
    DRAFT --> WAITING : Confirm Operation
    WAITING --> READY : Stock Fully Reserved
    READY --> DONE : Validate and Finalize
    WAITING --> CANCELED : Cancel (Release Reserved)
    READY --> CANCELED : Cancel (Release Reserved)
    DRAFT --> CANCELED : Cancel Operation
```

### Mathematical Invariants
1. **Quantity on Hand ($Q_{oh}$):**
   $$Q_{oh} \ge 0 \quad \text{for all internal locations}$$
2. **Reserved Quantity ($Q_{res}$):**
   $$0 \le Q_{res} \le Q_{oh}$$
3. **Free to Use Quantity ($Q_{free}$):**
   $$Q_{free} = Q_{oh} - Q_{res} \ge 0$$

---

## 4. Role-Based Access Control (RBAC) Matrix

| Capability / Route | Inventory Manager | Warehouse Staff | Implementation Mechanism |
|---|:---:|:---:|---|
| **View Dashboard & KPIs** | Full Organization | Assigned Warehouse Station Only | Query filter by `user.warehouse_id` |
| **View Receipts & Deliveries** | All Warehouses | Assigned Warehouse Station Only | Query filter by `user.warehouse_id` |
| **Execute & Validate Moves** | Yes | Yes (at assigned station) | `OperationService.assertPermission` |
| **Manual Stock Adjustments** | Yes | No | Backend `requireRole(INVENTORY_MANAGER)` |
| **Warehouse & Location CRUD** | Yes | No (Hidden from Navigation) | `requireRole(INVENTORY_MANAGER)` |
| **Product Catalog Creation** | Yes | No (View Only) | `requireRole(INVENTORY_MANAGER)` |
| **Category & UoM Master Data**| Yes | No (Hidden from Navigation) | `requireRole(INVENTORY_MANAGER)` |
| **Staff Role Assignment** | Yes | No (Forbidden) | `requireRole(INVENTORY_MANAGER)` |

---

## 5. Double-Entry Stock Ledger Model

Whenever an operation transitions to the `DONE` status, the transaction atomically creates an immutable record in `stock_ledger_entries`:

```prisma
model StockLedgerEntry {
  id              BigInt         @id @default(autoincrement())
  product_id      BigInt
  location_id     BigInt
  quantity_change Decimal        @db.Decimal(12, 4)
  balance_after   Decimal        @db.Decimal(12, 4)
  operation_id    BigInt
  operation_type  OperationType
  reference_no    String         @db.VarChar(60)
  movement_date   DateTime       @default(now())
  created_by      BigInt
}
```

This guarantees that:
- Every physical change has a reference to the originating operation (`reference_no`).
- Every move records the timestamp and responsible operator ID.
- Reconciliation can reconstruct the exact state of inventory at any arbitrary point in history.

---

## 6. Transactional Email & Security Architecture (Resend API)

StockSense uses **[Resend](https://resend.com)** for transactional email communication:

```
[User Signup / Password Reset]
               │
               ▼
       [AuthService.ts]
               │
               ▼
       [EmailService.ts]
         ├── Has RESEND_API_KEY?
         │      ├── YES ➔ Dispatches real email via Resend API (resend.emails.send)
         │      └── NO / MOCK ➔ Logs OTP to console & simulator output
         │
         ▼
[User receives 6-digit code via inbox or dev console]
```

### Key Security Invariants
- **Expiry Enforcement:** OTP codes expire after 10 minutes (`expires_at: NOW + 10m`).
- **Single-Use Verification:** Codes are flagged `is_used: true` immediately upon verification or superseded by resend requests.
- **Fail-Safe Transport:** Network or deliverability issues with external mail transport do not block critical database operations; fallback codes are captured in dev mode.
