# StockSense 📦⚡
> **Enterprise-Grade Double-Entry Warehouse & Inventory Operating System**  
> *Engineered for zero-discrepancy stock management, atomic ledger traceability, and strict role-based operations.*

---

## 🎙️ Official Presentation & Pitch Guide
*Use this exact pitch to introduce StockSense before opening the platform.*

### ⏱️ Delivery Time: ~60 to 90 Seconds

#### **1. Greeting & Team Introduction (15 Seconds)**
> *"Good morning / afternoon everyone!*  
> *My name is **Manish Nemade**, and with me is my team partner **Abhay**.*  
>  
> *Today, we are thrilled to present **StockSense** — an intelligent, full-stack inventory operating system engineered to eliminate stock discrepancies, eradicate phantom inventory, and streamline modern supply chain logistics."*

#### **2. The Real-World Bottleneck / The Hook (25 Seconds)**
> *"In modern warehousing, over 80% of dispatch failures and fulfillment delays stem from three critical flaws in legacy ERPs:*  
> 1. **Cluttered, Monolithic Interfaces:** Warehouse operators on the floor are forced into complex screens designed for executive accountants, causing mis-picks and dispatch bottlenecks.  
> 2. **Silent Stockouts & Overselling:** Orders are confirmed without atomic reservation checks. Pickers walk to a bin only to discover that the inventory isn't physically there.  
> 3. **Absence of a True Audit Ledger:** When stock levels mismatch at the end of the month, managers have no cryptographic or mathematical trail to diagnose where, when, and by whom the discrepancy was introduced."*

#### **3. Introducing StockSense: The Core Innovation (25 Seconds)**
> *"To solve this permanently, we engineered **StockSense** from first principles:*  
>  
> - **1. Double-Entry Inventory Accounting:** Just as financial accounting requires every debit to have a matching credit, StockSense treats physical goods with the same mathematical rigor. Every stock move has an immutable Source and Destination. Goods never magically appear or disappear.  
> - **2. Persona-First Architecture & Active Safeguards:** We provide separate, tailored workspaces. A **Warehouse Staff** operator gets a high-speed, distraction-free execution terminal with built-in **Short-Stock Guards** preventing invalid picks. Meanwhile, an **Inventory Manager** has multi-warehouse governance, automated reorder thresholds, and live ledger analytics."*

#### **4. Launching into the Live Walkthrough (10 Seconds)**
> *"Let's explore StockSense in action — first through the lens of a **Warehouse Operator** fulfilling fast receipts and transfers at Central Warehouse, and then as an **Inventory Manager** exercising complete operational oversight."*

---

## 👥 Demo Personas & Pre-Seeded Credentials

| Persona | Role | Login ID | Password | Scope & Operational Boundary |
|---|---|---|---|---|
| 🛡️ **Inventory Manager** | `INVENTORY_MANAGER` (Admin) | `admin` | `Admin@1234` | Full access: all warehouses, locations, product CRUD, settings, master data, user roles, manual stock adjustments, and global analytics. |
| 👷 **Warehouse Staff** | `WAREHOUSE_STAFF` (Operator) | `staff` | `User@1234` | Focused station: pinned to **Central Warehouse (WH1)**. Fast receipts, internal transfers, and deliveries. Administrative menus are automatically hidden. |

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client["React 19 Frontend<br/>(TanStack Router & Query, Tailwind CSS)"]
    Proxy["Vite Dev Proxy<br/>(/api ➔ :5000)"]
    Gateway["Express.js API Gateway<br/>(Port 5000)"]
    Auth["JWT Bearer Authentication & RBAC Middleware"]
    
    subgraph Backend Modules
        M_Auth["Auth & OTP Module"]
        M_Ops["Operations State Machine"]
        M_Prod["Product & Quant Engine"]
        M_Master["Master Data (WH/Loc/Cat/UoM/Partner)"]
        M_Dash["Dashboard KPIs & Analytics"]
        M_Ledger["Double-Entry Stock Ledger"]
    end

    Prisma["Prisma ORM 5.22<br/>(Connection Pooling, Transactions)"]
    Postgres[("PostgreSQL Database<br/>(Local localhost:5432/stocksense)")]

    Client -->|HTTP/REST| Proxy
    Proxy -->|Proxy Forward| Gateway
    Gateway --> Auth
    Auth --> M_Auth
    Auth --> M_Ops
    Auth --> M_Prod
    Auth --> M_Master
    Auth --> M_Dash
    Auth --> M_Ledger
    Backend Modules --> Prisma
    Prisma --> Postgres
```

---

## 🔄 Core Engineering Principles

### 1. Double-Entry Inventory Mechanics
Every inventory transaction is modeled as a transfer from a **Source Location** to a **Destination Location**:
- **Receipts:** From Virtual `Vendor Location` ➔ Internal `Stock Location` (+ On-Hand).
- **Deliveries:** From Internal `Stock Location` ➔ Virtual `Customer Location` (- On-Hand).
- **Internal Transfers:** From Internal `Bay A` ➔ Internal `Bay B` (Zero aggregate delta, location balance update).
- **Adjustments:** From/To Virtual `Inventory Loss/Gain Location` with explicit justification notes.

### 2. State Machine Guarantees
```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create Operation
    DRAFT --> WAITING: Confirm Operation
    WAITING --> READY: Stock Availability Reserved
    READY --> DONE: Validate & Finalize (Ledger Entries Generated)
    WAITING --> CANCELED: Cancel (Release Reservations)
    READY --> CANCELED: Cancel (Release Reservations)
    DRAFT --> CANCELED: Cancel Operation
```

1. **DRAFT:** Initial planning state. Lines can be freely edited, added, or removed.
2. **WAITING:** Automatic stock reservation check executed against source locations.
3. **READY:** Stock is fully reserved for fulfillment; line items cannot be stolen by competing orders.
4. **DONE:** Physical movement confirmed. Quantities committed, ledger records permanently generated.
5. **CANCELED:** Terminal state. Any reservations held are automatically returned to `Free to Use`.

---

## 🔌 API Gateway Reference (`/api/v1`)

### Authentication & User Management
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/auth/signup` | Register new user account | Public |
| `POST` | `/auth/verify-signup-otp` | Verify 6-digit email activation code | Public |
| `POST` | `/auth/login` | Authenticate and obtain JWT token | Public |
| `POST` | `/auth/forgot-password` | Request password reset 6-digit OTP | Public |
| `POST` | `/auth/verify-reset-otp` | Verify reset OTP and obtain reset token | Public |
| `POST` | `/auth/reset-password` | Update password using reset token | Public |
| `POST` | `/auth/resend-otp` | Re-generate and resend fresh OTP | Public |
| `GET` | `/auth/me` | Fetch authenticated user profile | Authenticated |
| `PUT` | `/auth/me` | Update name, phone, or preferences | Authenticated |
| `PUT` | `/auth/password` | Change user password | Authenticated |
| `GET` | `/users` | List all staff with assigned roles & warehouses | Manager Only |
| `PUT` | `/users/:id` | Update staff role, warehouse, or active status | Manager Only |

### Operations Engine
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/operations` | Filtered list (type, status, warehouse, search) | Authenticated |
| `POST` | `/operations` | Create new operation with line items | Authenticated |
| `GET` | `/operations/:id` | Get full operation details with lines & stock status | Authenticated |
| `PUT` | `/operations/:id` | Update mutable operation lines or header | Authenticated |
| `POST` | `/operations/:id/confirm` | Transition from `DRAFT` ➔ `WAITING`/`READY` | Authenticated |
| `POST` | `/operations/:id/validate` | Transition from `READY` ➔ `DONE` (Commit ledger) | Authenticated |
| `POST` | `/operations/:id/cancel` | Cancel operation & release reservations | Authenticated |
| `GET` | `/operations/:id/print` | Fetch print-ready dispatch slip / receipt data | Authenticated |

### Products & Inventory
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/products` | List active products with category/UoM | Authenticated |
| `POST` | `/products` | Create product (optional opening stock adjustment) | Manager Only |
| `GET` | `/products/:id` | Get product details with location quant breakdown | Authenticated |
| `PUT` | `/products/:id` | Update product attributes (or active status) | Manager Only |
| `DELETE` | `/products/:id` | Soft-delete / archive product | Manager Only |
| `GET` | `/products/quants/all` | Fetch all stock quants across all locations | Authenticated |
| `PUT` | `/products/:id/stock/:locId` | Direct stock count adjustment | Manager Only |

### Master Data Configuration
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` / `POST` | `/warehouses` | List / Create warehouse | Manager Only (Write) |
| `PUT` / `DELETE`| `/warehouses/:id` | Update / Deactivate warehouse | Manager Only |
| `GET` / `POST` | `/locations` | List / Create storage location | Manager Only (Write) |
| `PUT` / `DELETE`| `/locations/:id` | Update / Deactivate location | Manager Only |
| `GET` / `POST` | `/categories` | List / Create product category | Manager Only (Write) |
| `PUT` / `DELETE`| `/categories/:id` | Update / Deactivate category | Manager Only |
| `GET` / `POST` | `/uom` | List / Create units of measure | Manager Only (Write) |
| `PUT` / `DELETE`| `/uom/:id` | Update / Deactivate UoM | Manager Only |
| `GET` / `POST` | `/partners` | List / Create suppliers or customers | Manager Only (Write) |
| `PUT` / `DELETE`| `/partners/:id` | Update / Deactivate partner | Manager Only |

### Dashboard & Analytics
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/dashboard/kpis` | Real-time counts, low stock alerts, readiness | Authenticated |
| `GET` | `/stock-ledger` | Paginated immutable move ledger entries | Authenticated |

---

## 💻 Tech Stack Breakdown

### Frontend
- **Framework:** React 19 with TypeScript
- **Routing:** TanStack Router (file-based route tree with layout nesting)
- **Data Fetching & Cache:** TanStack Query v5 with optimistic invalidation
- **Design System:** Tailwind CSS, Radix UI primitives, Lucide React Icons, Sonner toasts
- **Dev Server:** Vite with proxy bridge routing `/api` ➔ `http://localhost:5000`

### Backend
- **Runtime:** Node.js (ES Modules) + Express.js
- **ORM & DB Client:** Prisma 5.22
- **Database:** PostgreSQL 15+ (Local or Managed)
- **Security:** JSON Web Tokens (JWT), bcrypt password hashing, Zod schema validation
- **Testing:** Vitest test suite with 95 comprehensive unit and integration tests

---

---

## 📧 Resend Email API for OTP Verification & Recovery

StockSense integrates the **[Resend](https://resend.com)** transactional email delivery engine for account security:
- **Signup Account Activation:** Dispatches an authentic 6-digit verification code with a 10-minute expiry when a user signs up.
- **Forgot Password Recovery:** Dispatches a 6-digit recovery OTP with rate-limiting and countdown cooldown.
- **Dual-Mode Architecture:**
  - **Live Delivery:** When `RESEND_API_KEY` is provided in `server/.env`, emails are dispatched in real-time through Resend's global email infrastructure.
  - **Dev Simulator:** If running locally without an active key or in offline testing, the system automatically simulates delivery by logging the exact OTP code to the console and returning it in development responses, guaranteeing zero friction during evaluation.

### Resend Environment Configuration (`server/.env`)
```env
# Resend Email Delivery API (https://resend.com/api-keys)
RESEND_API_KEY="re_your_api_key_here"
RESEND_FROM_EMAIL="StockSense <onboarding@resend.dev>"
```

---

## ⚡ Quick Start & Setup Guide

### 1. Prerequisites
- Node.js >= 18.0.0
- Local PostgreSQL instance running on `localhost:5432` with database `stocksense` (default user `postgres`, password `postgres`).
- Optional: Free Resend API key from [resend.com](https://resend.com) for live email delivery.

### 2. Backend Setup
```bash
cd server

# Install dependencies
npm install

# Verify .env configuration (sample provided in .env.example)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stocksense?schema=public"
# PORT=5000
# JWT_SECRET="your-secure-jwt-secret-key"
# RESEND_API_KEY="re_your_resend_api_key"
# RESEND_FROM_EMAIL="StockSense <onboarding@resend.dev>"

# Generate Prisma Client & push schema to database
npx prisma generate
npx prisma db push

# Seed initial master data (Admin, Staff, Warehouse WH1, Locations, Categories, UoM)
npm run db:seed

# Run test suite to verify all 95 tests pass
npm test

# Start backend server (listening on port 5000)
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client

# Install dependencies
npm install

# Start Vite client development server (listening on http://localhost:8080 or port indicated)
npm run dev
```

### 4. Access the Application
- Open `http://localhost:8080/` in your browser.
- Explore the **StockSense Landing Page**.
- Click **"Launch StockSense Platform"** or sign in directly with the demo credentials.

---

## 👥 Project Team & Credits
- **Manish Nemade** — Full-Stack Architecture, Database Modeling & Frontend Engineering
- **Abhay** — Backend Integration, Core Workflow Implementation & API Contracts
