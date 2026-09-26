# Phase 5 — Move History

> **TDD Reference:** `Technical_docs_design.md §6.8, §4.2 (stock_ledger_entries), §7 (GET /stock-ledger), §2 (view modes, search)`  
> **Status:** 🔴 NOT BUILT  
> **Create:** `src/routes/_authenticated/move-history.tsx`

---

## 5.1 Data Source (CRITICAL — §6.8)

> ⚠️ Move History is **NOT** a plain dump of `stock_ledger_entries`.  
> The `Status` column seen in the mockup can show "Ready", not just "Done" — this means the screen joins back to the parent `stock_operations` table to get live status.

### Query Logic
- Source: `stock_operations` joined with `stock_operation_lines` (for not-Done rows)
- For `status=DONE` rows: also pull from `stock_ledger_entries` for the actual moved quantity
- One row per product line (NOT merged per operation — §6.8 explicitly states this)

---

## 5.2 List Columns (§6.8)

| Column | Source | Notes |
|---|---|---|
| Reference | `stock_operations.reference_no` | e.g. `WH1/IN/0001` |
| Date | `stock_operations.scheduled_date` (or `validated_date` if Done) | |
| Contact | `partners.name` via `stock_operations.partner_id` | blank for Transfer/Adjustment |
| From | `locations.name` for `source_location_id` | |
| To | `locations.name` for `destination_location_id` | |
| Quantity | `stock_ledger_entries.quantity_change` (absolute) if Done; else `quantity_planned` | |
| Status | `stock_operations.status` (NOT from ledger table) | Live value from parent operation |

---

## 5.3 Color Coding (§6.8)

- [ ] **Green rows** = stock-in movements (Receipts — stock arriving)
- [ ] **Red rows** = stock-out movements (Deliveries — stock leaving)
- [ ] Internal Transfers / Adjustments — neutral color (or show +/- based on quantity_change sign)

> Base color on `operation_type`:
> - `RECEIPT` → green
> - `DELIVERY` → red
> - `INTERNAL_TRANSFER` → neutral/blue
> - `ADJUSTMENT` → neutral/orange (could be + or -)

---

## 5.4 Filters & Search (§7, §2)

### Filter Controls
| Filter | Query Param |
|---|---|
| Product | `?product_id=` |
| Location | `?location_id=` |
| Warehouse | `?warehouse_id=` |
| Operation Type | `?operation_type=RECEIPT|DELIVERY|INTERNAL_TRANSFER|ADJUSTMENT` |
| Date From | `?date_from=` (ISO-8601) |
| Date To | `?date_to=` (ISO-8601) |
| Search | `?search=` (reference_no partial OR partner name) |
| View | `?view=list|kanban` |
| Pagination | `?page=&limit=` |

### API
```
GET /stock-ledger?product_id=&location_id=&warehouse_id=&operation_type=&date_from=&date_to=&search=&view=&page=&limit=
```

---

## 5.5 View Toggle (§2)

- [ ] List / Kanban toggle button in header
- [ ] Kanban = grouped by `status` (same as operations screens)

---

## 5.6 No "New" Button (§10 clarification #6)

- [ ] **Do NOT add a "New" button** on Move History — ledger entries are system-generated only
- [ ] Only filter + search controls allowed

---

## 5.7 Checklist

- [ ] Route `/move-history` added and registered in routeTree
- [ ] List with all 7 columns from §5.2
- [ ] Green row = RECEIPT, Red row = DELIVERY
- [ ] One row per product line (not merged)
- [ ] Status column reads live from `stock_operations.status`
- [ ] Quantity: use `quantity_change` (absolute) if Done, else `quantity_planned`
- [ ] Search bar: reference_no OR partner name
- [ ] Filters: product, location, warehouse, operation type, date range
- [ ] List/Kanban toggle
- [ ] Pagination
- [ ] NO "New" button
