# Phase 3 — Products & Stock

> **TDD Reference:** `Technical_docs_design.md §6.3 (Products/Stock), §4.2 (products, stock_quants, units_of_measure, product_categories), §7 (Products & Stock APIs), §8 rules 2,5,7`  
> **Status:** ✅ COMPLETE — `src/routes/_authenticated/products.tsx`  
> **Review this file and tick off each micro-feature below.**

---

## 3.1 Products List View

### Columns to Display
| Column | Source | Notes |
|---|---|---|
| Product name | `products.name` | Includes barcode preview when available |
| SKU | `products.sku` | shown as `[DESK001]` tag/badge |
| Category | `product_categories.name` | joined via `category_id` |
| UoM | `units_of_measure.name` | joined via `uom_id` |
| Unit Cost | `products.unit_cost` | NUMERIC(14,2) with currency format |
| Reorder Min Qty | `products.reorder_min_qty` | paired with optional max |
| is_active | `products.is_active` | filter & status badge (Active / Archived) |

### Search & Filter (§7)
```
GET /products?search=&category_id=&page=&limit=
```

### Actions
- [x] Add Product button → opens Add Product dialog/form
- [x] Click edit action → opens Edit Product dialog (pre-populated)
- [x] Soft delete (§8 rule 7): blocked if product referenced by non-canceled operation

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

> **Initial stock note (§4.2, §7):** On `POST /products`, if both `initial_stock_quantity` + `initial_stock_location_id` are provided, backend auto-creates and validates an ADJUSTMENT operation via `setStock`. Frontend never writes `stock_quants` directly.

---

## 3.3 Stock Sub-Tab (§6.3)

> This is a **sub-tab under Products** — NOT a separate top-level nav item (§10 clarification #1).

### Columns
| Column | Source | Notes |
|---|---|---|
| Product | `products.name` | with SKU badge |
| Per Unit Cost | `products.unit_cost` | |
| On Hand | `stock_quants.quantity` | live balance |
| Free to Use | `quantity − reserved_quantity` | computed on read, not stored |

### Inline Edit Rule (§6.3, §8 rule 5)
- [x] "On hand" cell is **inline editable** with real-time difference badge (`+5` / `-2`)
- [x] On save → calls `set_stock` RPC with `{ counted }`
- [x] Backend creates + validates an ADJUSTMENT operation internally
- [x] **NEVER write to `stock_quants` directly from frontend**
- [x] Live totals strip (Total On Hand, Total Reserved, Total Free to Use)

---

## 3.4 Checklist — Verify in products.tsx

- [x] Products list with columns: name, SKU badge, category, UoM, unit_cost, reorder_min
- [x] Search by name/SKU/barcode & Category filter dropdown
- [x] Add Product dialog with all 11 fields (including optional initial_stock)
- [x] Edit Product dialog (pre-populated)
- [x] Soft delete with confirmation + block if referenced
- [x] Stock sub-tab visible under Products nav
- [x] Per-location stock rows: on_hand + reserved + free_to_use columns
- [x] Inline editable on_hand cell → `setStock` RPC
- [x] No direct write to `stock_quants`
