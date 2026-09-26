# Phase 2 — Authenticated Layout & Dashboard

> **TDD Reference:** `Technical_docs_design.md §1 (nav), §6.2 (Dashboard), §6.9 (Profile menu), §7 (GET /dashboard/kpis)`  
> **Status:** ✅ COMPLETE — `src/routes/_authenticated/route.tsx` + `dashboard.tsx`  
> **Review these files and tick off each micro-feature below.**

---

## 2.1 Authenticated Layout (route.tsx)

### Global Nav Bar (§1)
Every authenticated screen shows this top nav bar.

| Nav Item | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard` | |
| Operations | `/operations/*` | Dropdown or sub-nav: Receipts, Deliveries, Transfers, Adjustments |
| Products | `/products` | |
| Move History | `/move-history` | |
| Settings | `/settings` | |
| Profile icon (top-right) | — | Opens dropdown: "My Profile" + "Logout" |

> ⚠️ Nav is a **top bar** — NOT a left sidebar (mockup is authoritative per §1)

### Profile Icon Dropdown (§6.9)
- [x] "My Profile" → navigates to `/profile`
- [x] "Logout" → calls `supabase.auth.signOut()`, clears cache, redirects to `/auth`

---

## 2.2 Dashboard KPI Cards (§6.2)

### Receipt Card
| Sub-metric | Formula |
|---|---|
| `X Late` | `COUNT(RECEIPT rows WHERE scheduled_date < now() AND status NOT IN (DONE, CANCELED))` |
| `Y operations` | `COUNT(RECEIPT rows NOT IN (DONE, CANCELED))` |
| Button `N to receive` | `COUNT(RECEIPT rows WHERE status = READY)` |

- [x] Button click → routes to `/operations/RECEIPT?status=READY`

### Delivery Card
| Sub-metric | Formula |
|---|---|
| `X Late` | Same formula scoped to `operation_type=DELIVERY` |
| `Y waiting` | `COUNT(DELIVERY WHERE status=WAITING)` |
| `Z operations` | `COUNT(DELIVERY NOT IN (DONE, CANCELED))` |
| Button `N to Deliver` | `COUNT(DELIVERY WHERE status=READY)` |

- [x] Button click → routes to `/operations/DELIVERY?status=READY`

### Stat Cards (formula-only — §6.2)
| KPI | Formula |
|---|---|
| `total_products` | `COUNT(products WHERE is_active = true)` |
| `low_stock_count` | `COUNT(products WHERE 0 < sum(stock_quants.quantity) <= reorder_min_qty)` |
| `out_of_stock_count` | `COUNT(products WHERE sum(stock_quants.quantity) = 0 or null)` |
| `transfers_scheduled` | `COUNT(INTERNAL_TRANSFER WHERE status NOT IN (DONE, CANCELED))` |

---

## 2.3 Checklist — Verify in route.tsx + dashboard.tsx

- [x] Nav items: Dashboard, Operations (dropdown: Receipts, Deliveries, Transfers, Adjustments), Products, Move History, Settings
- [x] Profile icon top-right with "My Profile" + "Logout" dropdown
- [x] Top bar layout (not sidebar)
- [x] Receipt card: late + operations + "N to receive" button → routes to READY list
- [x] Delivery card: late + waiting + operations + "N to Deliver" → routes to READY list
- [x] 4 stat KPI cards (total_products, low_stock, out_of_stock, transfers)
- [x] Stock summary strip: Total On Hand, Reserved, Free to Use
- [x] Warehouse scoping dropdown filter
- [x] Skeleton loading states while data fetches
