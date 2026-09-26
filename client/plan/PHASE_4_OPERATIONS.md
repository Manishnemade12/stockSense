# Phase 4 — Operations (Receipts, Deliveries, Transfers, Adjustments)

> **TDD Reference:** `Technical_docs_design.md §5 (status workflow), §6.5–6.7 (screen flows), §7 (Operations API), §8 (business rules), §2 (reference format, view modes, search)`  
> **Status:** 🔴 NOT BUILT — Create these routes:
> - `src/routes/_authenticated/operations/receipts.tsx`
> - `src/routes/_authenticated/operations/deliveries.tsx`
> - `src/routes/_authenticated/operations/transfers.tsx`
> - `src/routes/_authenticated/operations/adjustments.tsx`
> - `src/components/operations/OperationsList.tsx` (shared component)
> - `src/components/operations/OperationDetail.tsx` (shared component)
> - `src/components/operations/KanbanView.tsx` (shared component)

---

## 4.0 Universal Status Flow (§5)

```
[*] → DRAFT
DRAFT → READY      (Receipt / Adjustment confirm, or Delivery/Transfer with stock OK)
DRAFT → WAITING    (Delivery / Transfer with insufficient stock at source)
WAITING → READY    (Stock becomes available)
READY → DONE       (Validate → writes stock_quants + ledger)
DRAFT/WAITING/READY → CANCELED
DONE → [*]  (terminal, immutable)
```

### Button Logic Per Status (§5)
| Current Status | Button shown | Action |
|---|---|---|
| DRAFT | **"To Do"** | `POST /{ops}/{id}/confirm` |
| READY | **"Validate"** | `POST /{ops}/{id}/validate` |
| Any (non-DONE) | "Cancel" | `POST /{ops}/{id}/cancel` |
| DONE | **"Print"** (enabled) | `GET /{ops}/{id}/print` |

### Late Tag Logic (§5)
- `Late` badge = `scheduled_date < now() AND status NOT IN (DONE, CANCELED)`

---

## 4.1 Shared List Screen (all 4 operations)

### URL pattern
```
/operations/receipts
/operations/deliveries
/operations/transfers
/operations/adjustments
```

### Query params
```
?status=&warehouse_id=&search=&view=list|kanban&page=&limit=
```

### List View Columns

#### Receipts (§6.5)
| Column | Source |
|---|---|
| Reference | `stock_operations.reference_no` (e.g. `WH1/IN/0001`) |
| From | source location short-code (= `vendor` virtual loc for Receipts) |
| To | destination location short-code |
| Contact | `partners.name` (supplier) |
| Schedule Date | `scheduled_date` |
| Status | badge: DRAFT / WAITING / READY / DONE / CANCELED |

#### Deliveries (§6.6)
Same as Receipts but Contact = customer. Fix: "To" = Customer virtual loc, NOT "vendor" (§10 clarification #3).

#### Transfers (§6.7)
| Reference | From | To | Schedule Date | Status | (no Contact column) |

#### Adjustments (§6.7)
| Reference | Location | Schedule Date | Status |

### Search Bar (§2)
- Matches `reference_no` (partial) **OR** partner/contact name
- Same contract on every list screen

### List / Kanban Toggle (§2)
- [ ] Toggle button (List | Kanban) in the list header
- [ ] Kanban = cards grouped by `status` column
- [ ] Same data, same API endpoint — just different layout
- [ ] Persist toggle in URL: `?view=list` or `?view=kanban`

### New Button
- [ ] "New" button → opens detail form in create mode

---

## 4.2 Shared Detail/Form Screen

### Common Fields (all operations)
| Field | Source | Notes |
|---|---|---|
| Reference | `reference_no` | Auto-generated server-side, read-only |
| Scheduled Date | `scheduled_date` | required |
| Responsible | `responsible_user_id` → `users.full_name` | auto-filled with logged-in user on create; reassignable only by Manager |
| Notes | `notes` | optional |
| Status | `status` | read-only badge |

### Receipt-Specific Fields (§6.5)
| Field | Source |
|---|---|
| Receive From | `partner_id` → suppliers dropdown |
| Warehouse | `warehouse_id` dropdown |
| Destination Location | `destination_location_id` dropdown |
| Products table | SKU + Quantity (= `quantity_planned`) rows |

### Delivery-Specific Fields (§6.6)
| Field | Source | Notes |
|---|---|---|
| Deliver To | `partner_id` → customers dropdown | |
| Delivery Address | `partners.address` | display only (read from partner) |
| Source Location | `source_location_id` dropdown | |
| Products table | SKU + Quantity rows | ⚠️ **Red line if `is_short=true`** (see §4.3) |

### Transfer-Specific Fields (§6.7)
| Field | Source |
|---|---|
| Source Location | `source_location_id` dropdown |
| Destination Location | `destination_location_id` dropdown |
| Products table | SKU + Quantity rows |

### Adjustment-Specific Fields (§6.7)
| Field | Source | Notes |
|---|---|---|
| Location | `location_id` on each line | |
| Products table (2 qty cols) | `recorded_quantity` (read-only, system-filled) + `counted_quantity` (user input) | Backend fills `recorded_quantity` from `stock_quants` |

---

## 4.3 Short Stock Red-Flag (Deliveries & Transfers) — §6.6

> Backend returns `is_short` boolean + `available_at_source` per line in `GET /{ops}/{id}`.

### Frontend Rule
- [ ] If `line.is_short === true` → render that line row in **red** (red text, red background tint, red border on qty cell)
- [ ] Show an alert/notification banner at the top of the form: "⚠️ Some items are out of stock at the source location"
- [ ] Do NOT block the form — still allow editing and saving DRAFT
- [ ] Confirming with `is_short` lines → status goes to `WAITING` (not `READY`)

---

## 4.4 Products Table (within operations forms)

### Common Columns
| Column | Field | Notes |
|---|---|---|
| Product | `product_id` → name + SKU badge | dropdown when adding |
| UoM | `uom_id` | defaults from product |
| Qty Planned | `quantity_planned` | user input |
| Qty Done | `quantity_done` | user input (default 0, updated before Validate) |

### Add Line Button
- [ ] "New Product" row → opens product picker dropdown
- [ ] Adds line to table

### Delete Line Button
- [ ] "×" button on each row → removes line from operation (only while status ≠ DONE)

---

## 4.5 Print Slip (§5, §7)

- [ ] "Print" button ONLY visible/enabled when `status = DONE`
- [ ] Calls `GET /{ops}/{id}/print`
- [ ] Opens printable view (or new tab) with the receipt/delivery slip

---

## 4.6 API Contracts (§7)

### List
```
GET /receipts?status=&warehouse_id=&search=&view=list|kanban&page=&limit=
GET /deliveries?...
GET /transfers?...
GET /adjustments?...
```

### Create
```
POST /receipts → { partner_id, warehouse_id, destination_location_id, scheduled_date, lines: [{product_id, uom_id, quantity_planned}] }
POST /deliveries → { partner_id, warehouse_id, source_location_id, scheduled_date, lines: [...] }
POST /transfers → { warehouse_id, source_location_id, destination_location_id, scheduled_date, lines: [...] }
POST /adjustments → { warehouse_id, lines: [{product_id, location_id, counted_quantity}] }
```

### Get Detail
```
GET /receipts/{id}  → full detail + lines; each line has available_at_source, is_short
GET /deliveries/{id}
GET /transfers/{id}
GET /adjustments/{id}
```

### Update
```
PUT /receipts/{id} → { responsible_user_id?, lines (quantity_done updates) }  ← only if status ≠ DONE/CANCELED
```

### Status Actions
```
POST /receipts/{id}/confirm   → DRAFT → READY (or WAITING for delivery/transfer)
POST /receipts/{id}/validate  → READY → DONE (writes stock_quants + ledger)
POST /receipts/{id}/cancel    → → CANCELED
GET  /receipts/{id}/print     → only if status=DONE
```
(Same pattern for /deliveries, /transfers, /adjustments)

> **Adjustment-specific:** also has `POST /adjustments/{id}/confirm` (DRAFT → READY)

---

## 4.7 Business Rules to Enforce on Frontend (§8)

- [ ] Rule 2: Cannot validate if ALL lines have `quantity_done = 0` — show error
- [ ] Rule 3: If `quantity_done > available_at_source` on validate → backend returns specific error → show it clearly
- [ ] Rule 4: If `status = DONE` → all fields read-only, no PUT, no add/delete lines
- [ ] Rule 5: Never write stock directly — always go through operations
- [ ] Rule 7: If deleting a product used in an operation → confirm dialog "This product is referenced in active operations"

---

## 4.8 Checklist

- [ ] `/operations/receipts` — list view with search + view toggle
- [ ] `/operations/receipts/:id` — detail form with To Do/Validate/Cancel/Print buttons
- [ ] `/operations/deliveries` — list + detail with red-line short-stock flag
- [ ] `/operations/transfers` — list + detail
- [ ] `/operations/adjustments` — list + detail (Recorded Qty read-only + Counted Qty input)
- [ ] Kanban view on all 4 (grouped by status, card per operation)
- [ ] "Late" badge on list rows where applicable
- [ ] Short-stock red row + banner on Delivery/Transfer detail
- [ ] Print button (DONE only)
- [ ] Partial validate allowed (not all lines need full qty_done)
- [ ] Immutable form when status=DONE
