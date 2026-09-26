# StockSense Backend — API Structure

> All routes except `/auth/*` require `Authorization: Bearer <token>`.  
> All responses follow the envelope defined in ARCHITECTURE.md §7.

---

## Route Prefix Summary

| Prefix | Module | Auth |
|---|---|---|
| /auth | Auth | Public |
| /dashboard | Dashboard | Any authenticated |
| /products | Products | Any (write: MANAGER) |
| /categories | Categories | Any (write: MANAGER) |
| /uom | UoM | Any (write: MANAGER) |
| /warehouses | Warehouses | Any (write: MANAGER) |
| /locations | Locations | Any (write: MANAGER) |
| /partners | Partners | Any (write: MANAGER) |
| /receipts | Receipts | Any |
| /deliveries | Deliveries | Any |
| /transfers | Transfers | Any |
| /adjustments | Adjustments | Any |
| /stock-ledger | Stock Ledger | Any |
| /profile | Profile | Any |

---

## Auth Endpoints (`/auth`)

### POST /auth/signup
- **Auth**: Public
- **Body**: `{ login_id, email, password }`
- **Validation**: login_id non-empty, email valid, password min 8 chars
- **Logic**: Create user (is_verified=false, role=WAREHOUSE_STAFF), generate OTP, store in otp_verifications
- **Response**: `{ user: {id, login_id, email}, message: "OTP sent" }`
- **Errors**: 409 CONFLICT (login_id or email taken)

### POST /auth/verify-signup-otp
- **Body**: `{ login_id, otp_code }`
- **Logic**: Validate OTP (purpose=SIGNUP_VERIFICATION, not expired, not used), mark used, set is_verified=true
- **Response**: `{ message: "Account verified" }`
- **Errors**: 400 VALIDATION_ERROR, 422 (invalid/expired OTP)

### POST /auth/login
- **Body**: `{ login_id, password }`
- **Logic**: Find user, check is_verified, compare bcrypt, issue JWT
- **Response**: `{ user: {id, login_id, email, role, warehouse_id}, token }`
- **Errors**: 403 NOT_VERIFIED, 401 UNAUTHORIZED

### POST /auth/forgot-password
- **Body**: `{ login_id }` (accepts login_id OR email as one field; search both columns)
- **Logic**: Find user, generate OTP (PURPOSE=PASSWORD_RESET), store
- **Response**: `{ message: "OTP sent" }`

### POST /auth/verify-reset-otp
- **Body**: `{ login_id, otp_code }`
- **Logic**: Validate OTP, issue short-lived reset JWT
- **Response**: `{ reset_token }`

### POST /auth/reset-password
- **Body**: `{ reset_token, new_password }`
- **Logic**: Verify reset_token, hash new_password, update user
- **Response**: `{ message: "Password updated" }`

### GET /auth/me
- **Auth**: Bearer
- **Response**: `{ user }`

### POST /auth/logout
- **Auth**: Bearer
- **Response**: `{ message: "Logged out" }` (stateless — client discards token)

---

## Dashboard (`/dashboard`)

### GET /dashboard/kpis
- **Auth**: Any
- **Query**: `?warehouse_id=` (optional)
- **Response**:
```json
{
  "total_products": 42,
  "low_stock_count": 5,
  "out_of_stock_count": 2,
  "receipts": { "late": 1, "total": 8, "ready_count": 3 },
  "deliveries": { "late": 2, "waiting": 1, "total": 6, "ready_count": 2 },
  "transfers_scheduled": 4
}
```

---

## Products (`/products`)

### GET /products
- **Query**: `?search=&category_id=&page=1&limit=20`
- **Response**: paginated list with category, uom

### POST /products
- **Auth**: MANAGER
- **Body**: `{ name, sku, barcode?, category_id, uom_id, unit_cost, description?, reorder_min_qty?, reorder_max_qty?, initial_stock_quantity?, initial_stock_location_id? }`
- **Logic**: Create product; if both initial_stock_quantity + initial_stock_location_id provided, create+validate ADJUSTMENT internally
- **Response**: `{ product }`

### GET /products/:id
- **Response**: `{ product }` with category, uom

### PUT /products/:id
- **Auth**: MANAGER
- **Body**: updatable fields (not sku)

### DELETE /products/:id
- **Auth**: MANAGER
- **Logic**: Soft delete (is_active=false). Block if referenced by non-canceled operation.

### GET /products/:id/stock
- **Response**: `[{ location_id, location_name, unit_cost, on_hand, reserved_quantity, free_to_use }]`

### PUT /products/:id/stock/:location_id
- **Auth**: Any
- **Body**: `{ counted_quantity }`
- **Logic**: Internally creates+validates ADJUSTMENT (recorded=current, counted=input)
- **Response**: `{ on_hand, free_to_use }`

---

## Categories (`/categories`)

### GET /categories
- **Query**: `?search=&page=&limit=`

### POST /categories
- **Auth**: MANAGER
- **Body**: `{ name, parent_category_id? }`

### GET /categories/:id
### PUT /categories/:id
- **Auth**: MANAGER
### DELETE /categories/:id
- **Auth**: MANAGER
- **Logic**: Soft delete — blocked if any active products use it

---

## Units of Measure (`/uom`)

### GET /uom
### POST /uom
- **Auth**: MANAGER
- **Body**: `{ name, code }`

### GET /uom/:id
### PUT /uom/:id
- **Auth**: MANAGER
### DELETE /uom/:id
- **Auth**: MANAGER

---

## Warehouses (`/warehouses`)

### GET /warehouses
### POST /warehouses
- **Auth**: MANAGER
- **Body**: `{ name, code, address? }`
- **Logic**: Also seeds a default INTERNAL location `{name: 'Stock', code: 'STOCK'}` for the new warehouse

### GET /warehouses/:id
### PUT /warehouses/:id
- **Auth**: MANAGER
### DELETE /warehouses/:id
- **Auth**: MANAGER
- **Logic**: Block if referenced by non-canceled operations

---

## Locations (`/locations`)

### GET /locations
- **Query**: `?warehouse_id=&location_type=`

### POST /locations
- **Auth**: MANAGER
- **Body**: `{ warehouse_id?, parent_location_id?, name, code, location_type }`
- **Note**: VENDOR/CUSTOMER/ADJUSTMENT_VIRTUAL types blocked from user creation

### GET /locations/:id
### PUT /locations/:id
- **Auth**: MANAGER
### DELETE /locations/:id
- **Auth**: MANAGER

---

## Partners (`/partners`)

### GET /partners
- **Query**: `?type=SUPPLIER|CUSTOMER&search=`

### POST /partners
- **Auth**: MANAGER
- **Body**: `{ name, type, email?, phone?, address? }`

### GET /partners/:id
### PUT /partners/:id
- **Auth**: MANAGER
### DELETE /partners/:id
- **Auth**: MANAGER

---

## Receipts (`/receipts`)

### GET /receipts
- **Query**: `?status=&warehouse_id=&search=&view=list|kanban&page=&limit=`
- **Response**: paginated list with reference_no, partner, locations, status, scheduled_date

### POST /receipts
- **Auth**: MANAGER
- **Body**: `{ partner_id, warehouse_id, destination_location_id, scheduled_date, notes?, lines: [{product_id, uom_id, quantity_planned}] }`
- **Logic**: source_location_id auto = Vendor virtual location
- **Response**: `{ operation }` with lines

### GET /receipts/:id
- **Response**: full detail + lines; lines include available_at_source=null, is_short=false (not applicable for receipts)

### PUT /receipts/:id
- **Body**: `{ responsible_user_id?, notes?, lines: [{id?, product_id, uom_id, quantity_planned, quantity_done}] }`
- **Restriction**: Blocked if status = DONE or CANCELED

### POST /receipts/:id/confirm
- **Logic**: DRAFT → READY (receipts skip WAITING)

### POST /receipts/:id/validate
- **Logic**: READY → DONE; increment stock per line; write ledger

### POST /receipts/:id/cancel
- **Logic**: !DONE → CANCELED

### GET /receipts/:id/print
- **Restriction**: status = DONE only
- **Response**: printable slip data

---

## Deliveries (`/deliveries`)

### GET /deliveries
- **Query**: same as receipts

### POST /deliveries
- **Body**: `{ partner_id, warehouse_id, source_location_id, scheduled_date, notes?, lines: [{product_id, uom_id, quantity_planned}] }`
- **Logic**: destination_location_id auto = Customer virtual location

### GET /deliveries/:id
- **Response**: lines include `available_at_source: number, is_short: boolean`

### PUT /deliveries/:id
- Same as receipts

### POST /deliveries/:id/confirm
- **Logic**: DRAFT → READY (stock sufficient) or WAITING (stock insufficient); reserve stock at source

### POST /deliveries/:id/validate
- **Logic**: READY → DONE; decrement stock (consumes reservation); write ledger
- **Errors**: 422 INSUFFICIENT_STOCK if quantity_done > available

### POST /deliveries/:id/cancel
- **Logic**: Release reservation if WAITING/READY; → CANCELED

### GET /deliveries/:id/print
- **Restriction**: DONE only

---

## Transfers (`/transfers`)

### GET /transfers
### POST /transfers
- **Body**: `{ warehouse_id, source_location_id, destination_location_id, scheduled_date, notes?, lines: [{product_id, uom_id, quantity_planned}] }`

### GET /transfers/:id
- Lines include `available_at_source, is_short`

### PUT /transfers/:id
### POST /transfers/:id/confirm
- Same WAITING/READY logic as deliveries + reserve stock

### POST /transfers/:id/validate
- **Logic**: READY → DONE; decrement source + increment destination + write ledger (both sides)

### POST /transfers/:id/cancel
### GET /transfers/:id/print

---

## Adjustments (`/adjustments`)

### GET /adjustments
- **Query**: `?status=&warehouse_id=&search=&view=&page=&limit=`

### POST /adjustments
- **Body**: `{ warehouse_id, scheduled_date, notes?, lines: [{product_id, location_id, counted_quantity}] }`
- **Logic**: Backend fills recorded_quantity from current stock_quants; computes difference

### GET /adjustments/:id
- Lines include recorded_quantity (read-only), counted_quantity, difference

### PUT /adjustments/:id
- Blocked if DONE/CANCELED

### POST /adjustments/:id/confirm
- **Logic**: DRAFT → READY

### POST /adjustments/:id/validate
- **Logic**: READY → DONE; apply difference to stock_quants; write ledger

### POST /adjustments/:id/cancel

---

## Stock Ledger (`/stock-ledger`)

### GET /stock-ledger
- **Query**: `?product_id=&location_id=&warehouse_id=&operation_type=&date_from=&date_to=&search=&view=list|kanban&page=&limit=`
- **Response**: paginated list joining stock_ledger_entries → stock_operations → partners → locations
- **Columns**: reference_no, date (validated_date or scheduled_date), contact, from, to, quantity (abs value), status, direction

---

## Profile (`/profile`)

### GET /profile
- **Response**: `{ user }` (no password_hash)

### PUT /profile
- **Body**: `{ full_name?, phone?, current_password?, new_password? }`
- **Logic**: If password change requested, verify current_password first
