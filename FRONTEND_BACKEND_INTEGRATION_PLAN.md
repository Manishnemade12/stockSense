# StockSense — Frontend & Backend Integration Plan 🔌

> **Purpose:** This document provides the complete roadmap and contract specifications for connecting the completed React/TanStack frontend (`client/`) to the Express/Prisma/PostgreSQL backend (`server/`).
> **Reference Documents:** 
> - Backend Plan: [`server/plan/API_STRUCTURE.md`](file:///c:/Users/manis/Desktop/oddo/server/plan/API_STRUCTURE.md)
> - Technical Specification: [`Technical_docs_design.md`](file:///c:/Users/manis/Desktop/oddo/Technical_docs_design.md)
> - Master Backend Plan: [`server/plan/MASTER_PLAN.md`](file:///c:/Users/manis/Desktop/oddo/server/plan/MASTER_PLAN.md)

---

## 1. Architectural Overview & Connection Strategy

```
┌──────────────────────────────────────────────┐
│          StockSense Client (Vite)            │
│          http://localhost:5173               │
│                                              │
│  - TanStack Router & React Query             │
│  - Centralized API Client (src/services/api) │
│  - JWT Bearer Token in localStorage          │
└──────────────────────┬───────────────────────┘
                       │ HTTP / JSON
                       │ (Proxy: /api -> :5000)
                       ▼
┌──────────────────────────────────────────────┐
│          StockSense Server (Express)         │
│          http://localhost:5000/api/v1        │
│                                              │
│  - Auth Middleware (JWT Verification)        │
│  - RBAC Guard (INVENTORY_MANAGER role)       │
│  - Prisma ORM + PostgreSQL Database          │
└──────────────────────────────────────────────┘
```

### Key Connection Principles
1. **Unified API Gateway:** All backend endpoints are exposed under `/api/v1`.
2. **Vite Development Proxy:** Client routes `/api/*` requests through Vite dev server to avoid CORS issues locally.
3. **Consistent Response Envelope:** All backend API responses adhere to the standard format:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": { "page": 1, "limit": 20, "total": 45 } // For paginated endpoints
   }
   ```
   Errors follow:
   ```json
   {
     "success": false,
     "error": {
       "code": "VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | NOT_VERIFIED",
       "message": "Human-readable explanation",
       "details": [ ... ]
     }
   }
   ```
4. **Stateless JWT Authentication:**
   - On successful `POST /auth/login`, backend returns `{ user, token }`.
   - Client persists `token` in `localStorage.getItem("stocksense_token")`.
   - Every authenticated request attaches: `Authorization: Bearer <token>`.
   - A `401 UNAUTHORIZED` response automatically clears local credentials and routes the user to `/auth`.

---

## 2. Dev Environment & Proxy Configuration

### 2.1 Client Vite Proxy (`client/vite.config.ts`)
Add a proxy rule in the Vite config so client code can call `/api/v1/...` directly:

```typescript
// client/vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // ... existing configs
});
```

### 2.2 Client Environment Variables (`client/.env`)
```env
VITE_API_BASE_URL=/api/v1
```

### 2.3 Server Environment Variables (`server/.env`)
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/stocksense?schema=public"
JWT_SECRET="super-secret-jwt-key-stocksense-2026"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
```

---

## 3. Centralized Client API Service Layer

Create `client/src/services/apiClient.ts` to manage all HTTP calls, token attachment, and error toasts:

```typescript
// client/src/services/apiClient.ts
import { toast } from "sonner";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers = {}, ...rest } = options;
  const token = localStorage.getItem("stocksense_token");

  // Build query string
  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        searchParams.append(k, String(v));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    headers: { ...defaultHeaders, ...(headers as Record<string, string>) },
    ...rest,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errMsg = json?.error?.message || response.statusText || "Request failed";
    
    // Auto-redirect on session expiration
    if (response.status === 401 && !endpoint.startsWith("/auth/")) {
      localStorage.removeItem("stocksense_token");
      window.location.href = "/auth";
      throw new Error("Session expired. Please log in again.");
    }

    throw new Error(errMsg);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}
```

---

## 4. Module-by-Module Integration Contracts

### 4.1 Authentication & Profile Module

| Action | HTTP Method | Endpoint | Payload | Returns |
|---|---|---|---|---|
| **Sign Up** | `POST` | `/auth/signup` | `{ login_id, email, password }` | `{ user, message, otp_code }` *(otp_code returned in dev)* |
| **Verify Signup OTP** | `POST` | `/auth/verify-signup-otp` | `{ login_id, otp_code }` | `{ message: "Account verified" }` |
| **Login** | `POST` | `/auth/login` | `{ login_id, password }` | `{ user: { id, login_id, email, role, warehouse_id }, token }` |
| **Forgot Password** | `POST` | `/auth/forgot-password` | `{ login_id }` | `{ message: "OTP sent", otp_code }` |
| **Verify Reset OTP** | `POST` | `/auth/verify-reset-otp` | `{ login_id, otp_code }` | `{ reset_token }` |
| **Reset Password** | `POST` | `/auth/reset-password` | `{ reset_token, new_password }` | `{ message: "Password updated" }` |
| **Current User** | `GET` | `/auth/me` | — | `{ user }` |
| **Get Profile** | `GET` | `/profile` | — | `{ user: { id, login_id, email, full_name, phone, role, warehouse_id } }` |
| **Update Details** | `PUT` | `/profile` | `{ full_name?, phone? }` | `{ user }` |
| **Change Password** | `PUT` | `/profile/password` | `{ current_password, new_password }` | `{ message: "Password updated" }` |

---

### 4.2 Dashboard Analytics Module

| Action | HTTP Method | Endpoint | Query / Payload | Returns |
|---|---|---|---|---|
| **Fetch KPIs** | `GET` | `/dashboard/kpis` | `?warehouse_id=` | KPI payload: |

```json
{
  "total_products": 42,
  "low_stock_count": 5,
  "out_of_stock_count": 2,
  "receipts": { "late": 1, "total": 8, "ready_count": 3 },
  "deliveries": { "late": 2, "waiting": 1, "total": 6, "ready_count": 2 },
  "transfers_scheduled": 4,
  "stock_summary": {
    "on_hand": 1420,
    "reserved": 180,
    "free_to_use": 1240
  }
}
```

---

### 4.3 Products & Stock Module

| Action | HTTP Method | Endpoint | Payload / Query | Access |
|---|---|---|---|---|
| **List Products** | `GET` | `/products` | `?search=&category_id=&page=1&limit=20` | All |
| **Create Product** | `POST` | `/products` | `{ name, sku, barcode?, category_id, uom_id, unit_cost, description?, reorder_min_qty?, reorder_max_qty?, initial_stock_quantity?, initial_stock_location_id? }` | Manager |
| **Get Product Detail** | `GET` | `/products/:id` | — | All |
| **Update Product** | `PUT` | `/products/:id` | `{ name?, barcode?, category_id?, uom_id?, unit_cost?, description?, reorder_min_qty?, reorder_max_qty? }` | Manager |
| **Soft Delete** | `DELETE` | `/products/:id` | — | Manager (Blocks if active operation references it) |
| **Get Stock per Loc** | `GET` | `/products/:id/stock` | — | All (`[{ location_id, location_name, on_hand, reserved, free_to_use }]`) |
| **Inline Stock Adjust**| `PUT` | `/products/:id/stock/:location_id` | `{ counted_quantity }` | All (Calls internal auto-adjustment) |

---

### 4.4 Operations Core Module (Receipts, Deliveries, Transfers, Adjustments)

All 4 operations share a unified endpoint design:

| Endpoint Pattern | Method | Purpose | Notes |
|---|---|---|---|
| `/:op_type` | `GET` | Paginated List | `?status=&warehouse_id=&search=&view=list\|kanban&page=&limit=` |
| `/:op_type` | `POST` | Create Operation | Specific payload per op type (see below) |
| `/:op_type/:id` | `GET` | Detail & Lines | Returns lines with `available_at_source` and `is_short` flag |
| `/:op_type/:id` | `PUT` | Update Lines / Qty Done | Allowed only if status $\neq$ `DONE` or `CANCELED` |
| `/:op_type/:id/confirm` | `POST` | Status: `DRAFT` $\to$ `READY` or `WAITING` | Deliveries/Transfers with `is_short=true` transition to `WAITING` |
| `/:op_type/:id/validate`| `POST` | Status: `READY` $\to$ `DONE` | Writes `stock_quants` and ledger. Blocked if all `quantity_done = 0`. |
| `/:op_type/:id/cancel`  | `POST` | Status $\to$ `CANCELED` | Blocked if already `DONE` |
| `/:op_type/:id/print`   | `GET` | Printable Slip Data | Allowed only if status is `DONE` |

#### Operation Creation Payloads:
- **Receipts (`POST /receipts`):**
  ```json
  {
    "partner_id": 1,
    "warehouse_id": 1,
    "destination_location_id": 2,
    "scheduled_date": "2026-09-30T10:00:00Z",
    "notes": "Urgent restock",
    "lines": [{ "product_id": 10, "uom_id": 1, "quantity_planned": 50 }]
  }
  ```
- **Deliveries (`POST /deliveries`):**
  ```json
  {
    "partner_id": 4,
    "warehouse_id": 1,
    "source_location_id": 2,
    "scheduled_date": "2026-10-01T15:00:00Z",
    "lines": [{ "product_id": 10, "uom_id": 1, "quantity_planned": 15 }]
  }
  ```
- **Internal Transfers (`POST /transfers`):**
  ```json
  {
    "warehouse_id": 1,
    "source_location_id": 2,
    "destination_location_id": 3,
    "scheduled_date": "2026-09-28T09:00:00Z",
    "lines": [{ "product_id": 10, "quantity_planned": 20 }]
  }
  ```
- **Adjustments (`POST /adjustments`):**
  ```json
  {
    "warehouse_id": 1,
    "scheduled_date": "2026-09-26T12:00:00Z",
    "lines": [{ "product_id": 10, "location_id": 2, "counted_quantity": 48 }]
  }
  ```

---

### 4.5 Move History Module (`/stock-ledger`)

| Action | HTTP Method | Endpoint | Query Parameters |
|---|---|---|---|
| **Query History** | `GET` | `/stock-ledger` | `?product_id=&location_id=&warehouse_id=&operation_type=&date_from=&date_to=&search=&view=list\|kanban&page=1&limit=20` |

**Response Format:**
```json
{
  "items": [
    {
      "id": 101,
      "reference_no": "WH1/IN/0001",
      "operation_type": "RECEIPT",
      "date": "2026-09-25T14:30:00Z",
      "product_name": "Ergonomic Chair",
      "product_sku": "FURN-001",
      "contact_name": "Steelcase Supplies",
      "from_location": "Vendor",
      "to_location": "Zone A / Rack 1",
      "quantity": 25,
      "status": "DONE"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### 4.6 Master Data & Settings Module

| Entity | List (`GET`) | Create (`POST`) | Edit (`PUT`) | Deactivate (`DELETE`) | Special Business Rules |
|---|---|---|---|---|---|
| **Warehouses** | `/warehouses` | `/warehouses` | `/warehouses/:id` | `/warehouses/:id` | Soft delete blocked if referenced in non-canceled operations. Auto-creates default `STOCK` location. |
| **Locations** | `/locations?warehouse_id=` | `/locations` | `/locations/:id` | `/locations/:id` | Deactivation blocked if `quantity_on_hand > 0`. |
| **Categories** | `/categories` | `/categories` | `/categories/:id` | `/categories/:id` | Parent category hierarchy support. Block delete if products attached. |
| **UoM** | `/uom` | `/uom` | `/uom/:id` | `/uom/:id` | Block delete if products attached. |
| **Partners** | `/partners?type=` | `/partners` | `/partners/:id` | `/partners/:id` | Supplier / Customer filter. Block delete if active operations exist. |
| **User RBAC** | `/users` | — | `/users/:id` | — | Manager-only. Assign `role` and `warehouse_id`. Self-demotion blocked. |

---

## 5. Transition & Linking Checklist

Follow these sequential steps when connecting the frontend to the backend:

- [ ] **Step 1: Backend Server Verification**
  - Ensure `server/` is running on port 5000 (`npm run dev` in `server/`).
  - Verify health endpoint: `curl http://localhost:5000/api/v1/health`.
- [ ] **Step 2: Proxy Setup**
  - Update `client/vite.config.ts` with proxy for `/api` to `http://localhost:5000`.
- [ ] **Step 3: Create Service Adapter**
  - Add `client/src/services/apiClient.ts` with token handling and error toasts.
- [ ] **Step 4: Connect Authentication**
  - Update `src/routes/auth.tsx` to call `POST /auth/login` and `POST /auth/signup`.
  - Store token on login: `localStorage.setItem('stocksense_token', data.token)`.
- [ ] **Step 5: Connect Dashboard KPIs**
  - Update `src/routes/_authenticated/dashboard.tsx` query function to call `/dashboard/kpis`.
- [ ] **Step 6: Connect Products & Stock**
  - Replace direct Supabase queries in `src/routes/_authenticated/products.tsx` with `/products` and `/products/:id/stock/:loc`.
- [ ] **Step 7: Connect Operations**
  - Replace handlers in `operations.$type.tsx` and `operations.$type.$id.tsx` to target `/receipts`, `/deliveries`, etc.
- [ ] **Step 8: Connect Move History**
  - Route `src/routes/_authenticated/move-history.tsx` to `GET /stock-ledger`.
- [ ] **Step 9: Connect Settings & Users**
  - Wire tabs in `src/routes/_authenticated/settings.tsx` to their respective `/warehouses`, `/locations`, `/users` endpoints.
- [ ] **Step 10: E2E Smoke Test**
  - Test Full Receipt Flow $\to$ Validate $\to$ Stock Quant update $\to$ Move History row appearance.
