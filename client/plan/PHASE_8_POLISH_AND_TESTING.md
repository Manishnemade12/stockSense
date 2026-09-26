# Phase 8 — Polish, E2E Testing & Final Checks

> **TDD Reference:** Full document — all §§  
> **Status:** 🟡 Final phase — do after all features are built

---

## 8.1 End-to-End Flow Tests

Test each flow end-to-end in the browser before demo:

### Flow 1: Full Receipt Flow
1. Login as Manager
2. Create a new Receipt (partner=supplier, warehouse, destination location, add 2 products)
3. Confirm → status becomes READY
4. Update quantity_done on each line
5. Validate → status becomes DONE
6. Verify stock_quants updated in Products → Stock tab
7. Verify entry appears in Move History (green row)
8. Click Print → print slip opens

### Flow 2: Delivery with Short Stock
1. Create a Delivery for more qty than available
2. Confirm → status becomes WAITING (not READY)
3. Check that the product line is highlighted RED
4. Verify "waiting for stock" banner shown
5. After a Receipt brings in more stock, re-check → should move to READY

### Flow 3: Stock Adjustment (inline from Products)
1. Go to Products → Stock tab
2. Inline-edit "On Hand" for a product-location
3. Save → verify value updated
4. Go to Move History → verify an ADJUSTMENT entry appeared

### Flow 4: Internal Transfer
1. Create Internal Transfer (source → destination within same warehouse)
2. Confirm → READY (if stock sufficient)
3. Validate → DONE
4. Check both locations' stock updated in Products → Stock

### Flow 5: Full Settings + User Management
1. Create a new Warehouse
2. Create a Location under it
3. Create a Supplier (Partner)
4. Create a Product with initial stock at the new location
5. Signup a new user → they default to WAREHOUSE_STAFF
6. In Settings → Users, assign them the new warehouse + promote to INVENTORY_MANAGER

---

## 8.2 Error State Checklist

- [ ] Network error on any API call → toast "Something went wrong, please try again"
- [ ] 401 Unauthorized → clear token, redirect to `/auth`
- [ ] 403 Forbidden (Warehouse Staff trying Manager action) → "You don't have permission"
- [ ] 404 Not Found → friendly "Not found" component
- [ ] Unique constraint error (duplicate SKU / login_id / warehouse code) → specific field error message
- [ ] Validate with all quantity_done = 0 → "Enter at least one quantity to validate"
- [ ] Validate delivery with qty_done > available → specific "Insufficient stock at [location]" error
- [ ] Soft-delete blocked (product in active operation) → "Cannot delete: referenced by active operations"
- [ ] Login with unverified account → "Please verify your email before logging in"

---

## 8.3 UX Polish Checklist

- [ ] All lists have empty state: "No [receipts] found. Create your first one."
- [ ] All list screens have pagination controls
- [ ] Loading skeletons while data is fetching (not spinners alone)
- [ ] Form validation highlights required fields before submit
- [ ] Confirm dialogs on destructive actions (cancel operation, delete/deactivate)
- [ ] Toast notifications on all success actions (Created, Updated, Validated, Canceled, Deleted)
- [ ] Badge colors consistent: DRAFT=gray, WAITING=yellow, READY=blue, DONE=green, CANCELED=red
- [ ] "Late" badge = orange/red, shown next to status on list rows
- [ ] All dropdowns have search/filter when list is long (products, locations, partners)
- [ ] Reference numbers are monospace font for easy reading

---

## 8.4 Responsive & Print

- [ ] App is usable on tablet-width screens (768px+)
- [ ] Print slip (`GET /{ops}/{id}/print`) opens in a clean printable layout without nav/sidebar
- [ ] Print CSS: hide nav, show only slip content, print-friendly font sizes

---

## 8.5 RouteTree Completeness Check

Verify `routeTree.gen.ts` includes all routes:
```
/auth
/reset-password
/_authenticated
  /dashboard
  /products
  /move-history
  /profile
  /settings
  /operations
    /receipts
    /receipts/$id
    /deliveries
    /deliveries/$id
    /transfers
    /transfers/$id
    /adjustments
    /adjustments/$id
```

---

## 8.6 TDD Compliance Final Check

Read through each section of `Technical_docs_design.md` and verify:

- [ ] §2 — All reference numbers use `WH1/IN/0001` format (not `RCPT-00001` from v1)
- [ ] §4.2 — `login_id` ≠ `email` (two separate fields) on Login + Signup screens
- [ ] §4.2 — `full_name` nullable at signup, editable in Profile
- [ ] §4.2 — `role` defaults server-side, never on signup form
- [ ] §5 — Status buttons: "To Do" (DRAFT), "Validate" (READY), "Print" (DONE only)
- [ ] §6.3 — Stock inline edit goes through ADJUSTMENT, not direct write
- [ ] §6.6 — Delivery "To" is Customer loc, NOT vendor (§10 clarification #3)
- [ ] §6.8 — Move History has no "New" button (§10 clarification #6)
- [ ] §8 rule 2 — Partial validate allowed; no PARTIALLY_DONE status
- [ ] §10 #1 — Nav item is "Products", "Stock" is a sub-tab inside it
