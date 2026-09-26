# Phase 3 — Products & Stock

> **TDD Reference:** `Technical_docs_design.md §6.3 (Products/Stock), §4.2 (products, stock_quants, units_of_measure, product_categories), §7 (Products & Stock APIs), §8 rules 2,5,7`  
> **Status:** ✅ COMPLETE — `src/routes/_authenticated/products.tsx`  
> **Review this file and tick off each micro-feature below.**

---

## 3.1 Products List View

### Columns to Display
| Column | Source | Notes |
|---|---|---|
| Product name | `products.name` | |
| SKU | `products.sku` | shown as `[DESK001]` tag/badge |
| Category | `product_categories.name` | joined via `category_id` |
| UoM | `units_of_measure.name` | joined via `uom_id` |
| Unit Cost | `products.unit_cost` | NUMERIC(14,2) |
| Reorder Min Qty | `products.reorder_min_qty` | |
| is_active | `products.is_active` | filter — only show active by default |

### Search & Filter (§7)
```
GET /products?search=&category_id=&page=&limit=
```

### Actions
- [ ] Add Product button → opens Add Product dialog/form
- [ ] Click row → opens Edit Product dialog
- [ ] Soft delete (§8 rule 7): blocked if product referenced by non-canceled operation

---

## 3.2 Add / Edit Product Form

### Fields (§4.2 products table)
| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | ✅ | |
| SKU | text | ✅ | Must be unique (§8 rule 1) |
| Barcode | text | ❌ | optional |
| Category | dropdown → `product_categories` | ✅ | |
| Unit of Measure | dropdown → `units_of_measure` | ✅ | |
| Unit Cost | number | ✅ | default 0 |
| Description | textarea | ❌ | optional |
| Reorder Min Qty | number | ✅ | default 0 |
| Reorder Max Qty | number | ❌ | nullable |
| Initial Stock Qty | number | ❌ | optional — if given, `initial_stock_location_id` becomes required |
| Initial Stock Location | dropdown → `locations` | conditional | required if Initial Stock Qty is given |

> **Initial stock note (§4.2, §7):** On `POST /products`, if both `initial_stock_quantity` + `initial_stock_location_id` are provided, backend auto-creates and validates an ADJUSTMENT operation. Frontend just passes these two extra fields — do NOT manually write `stock_quants`.

### API
```
POST /products → { name, sku, barcode?, category_id, uom_id, unit_cost, reorder_min_qty, reorder_max_qty?, initial_stock_quantity?, initial_stock_location_id? }
PUT /products/{id}
DELETE /products/{id}   → soft delete (is_active=false)
```

---

## 3.3 Stock Sub-Tab (§6.3)

> This is a **sub-tab under Products** — NOT a separate top-level nav item (§10 clarification #1).

### Columns
| Column | Source | Notes |
|---|---|---|
| Product | `products.name` | |
| Per Unit Cost | `products.unit_cost` | |
| On Hand | `stock_quants.quantity` | summed across all locations, or per-location row |
| Free to Use | `quantity − reserved_quantity` | computed on read, not stored |

### Inline Edit Rule (§6.3, §8 rule 5)
- [ ] "On hand" cell is **inline editable**
- [ ] On save → calls `PUT /products/{id}/stock/{location_id}` with `{ counted_quantity }`
- [ ] Backend creates + validates an ADJUSTMENT operation internally
- [ ] **NEVER write to `stock_quants` directly from frontend**
- [ ] Response returns updated `on_hand` + `free_to_use`

### API
```
GET /products/{id}/stock → [{ location_id, location_name, unit_cost, on_hand, free_to_use }]
PUT /products/{id}/stock/{location_id} → { counted_quantity }
```

---

## 3.4 Checklist — Verify in products.tsx

- [ ] Products list with columns: name, SKU badge, category, UoM, unit_cost, reorder_min
- [ ] Search by name/SKU
- [ ] Add Product dialog with all 11 fields (including optional initial_stock)
- [ ] Edit Product dialog (pre-populated)
- [ ] Soft delete with confirmation + block if referenced
- [ ] Stock sub-tab visible under Products nav
- [ ] Per-location stock rows: on_hand + free_to_use columns
- [ ] Inline editable on_hand cell → `PUT /products/{id}/stock/{location_id}`
- [ ] No direct write to `stock_quants`
