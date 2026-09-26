# StockSense Frontend — Development Plan

> **Source of Truth:** All features, fields, behaviors, and API contracts are derived strictly from [`Technical_docs_design.md`](../Technical_docs_design.md).  
> **Do NOT deviate** from the field names, enum values, reference formats, or status flows defined there.

---

## Project Structure

```
plan/
├── README.md                    ← This file — master index
├── PHASE_1_AUTH.md              ← Login, Signup, Forgot/Reset Password, OTP flow
├── PHASE_2_LAYOUT_DASHBOARD.md  ← Authenticated layout, nav, profile menu, Dashboard KPIs
├── PHASE_3_PRODUCTS.md          ← Products list, add/edit, Stock sub-tab (inline edit)
├── PHASE_4_OPERATIONS.md        ← Receipts, Deliveries, Internal Transfers, Adjustments
├── PHASE_5_MOVE_HISTORY.md      ← Move History screen, green/red rows, filters
├── PHASE_6_SETTINGS.md          ← Settings: warehouses, locations, categories, UoM, partners, users, theme
├── PHASE_7_PROFILE.md           ← My Profile (view/edit full_name, phone, change password)
└── PHASE_8_POLISH_AND_TESTING.md← E2E testing, error states, responsive, print slips
```

---

## What Is Already Built ✅

| Feature | File | Status |
|---|---|---|
| Auth page (Login + Signup + Forgot) | `src/routes/auth.tsx` | ✅ Done |
| Reset password page | `src/routes/reset-password.tsx` | ✅ Done |
| Authenticated layout (nav + profile) | `src/routes/_authenticated/route.tsx` | ✅ Done |
| Dashboard (Receipt & Delivery cards + KPIs) | `src/routes/_authenticated/dashboard.tsx` | ✅ Done |
| Products page (list + stock tab + add/edit) | `src/routes/_authenticated/products.tsx` | ✅ Done |
| Settings page skeleton | `src/routes/settings.tsx` | ✅ Done |
| Base UI components | `src/components/ui/` | ✅ Done |
| Theme provider | `src/components/theme-provider.tsx` | ✅ Done |
| Supabase client | `src/integrations/supabase/` | ✅ Done |
| Auth helpers | `src/lib/auth.ts` | ✅ Done |
| StockSense helpers | `src/lib/stocksense.ts` | ✅ Done |

---

## What Needs To Be Built 🔴

| Phase | Feature | Priority |
|---|---|---|
| Phase 4 | Operations: Receipts list + detail form | 🔴 Critical |
| Phase 4 | Operations: Deliveries list + detail form | 🔴 Critical |
| Phase 4 | Operations: Internal Transfers list + detail | 🔴 Critical |
| Phase 4 | Operations: Adjustments list + detail | 🔴 Critical |
| Phase 4 | List/Kanban toggle on all operation screens | 🔴 Critical |
| Phase 4 | Red-line flag when stock is short (Delivery) | 🔴 Critical |
| Phase 4 | Print slip when status=DONE | 🟠 High |
| Phase 5 | Move History page (green in / red out) | 🔴 Critical |
| Phase 6 | Settings: warehouses CRUD | 🟠 High |
| Phase 6 | Settings: locations CRUD | 🟠 High |
| Phase 6 | Settings: categories CRUD | 🟠 High |
| Phase 6 | Settings: UoM CRUD | 🟠 High |
| Phase 6 | Settings: partners CRUD | 🟠 High |
| Phase 6 | Settings: user management | 🟠 High |
| Phase 6 | Settings: theme picker | 🟡 Medium |
| Phase 7 | My Profile page | 🟡 Medium |
| Phase 8 | E2E flow testing | 🟡 Medium |

---

## Key Conventions (from Technical_docs_design.md §2)

- **Field naming:** `snake_case` in DB and JSON API
- **Reference numbers:** `WH1/IN/0001` format (warehouse_code/op_code/sequence)
- **Op codes:** `IN` = Receipt, `OUT` = Delivery, `INT` = Internal Transfer, `ADJ` = Adjustment
- **Quantities:** `NUMERIC(14,3)`, never float
- **Enums (uppercase strings):** `DRAFT | WAITING | READY | DONE | CANCELED`
- **Soft delete:** `is_active = false`, never hard delete if referenced
- **View modes:** `?view=list` (default) or `?view=kanban` on every operations screen
- **Search:** `?search=` matches `reference_no` OR partner name — same contract everywhere
- **Status logic:** `DONE` = immutable. `CANCELED` = terminal. All stock writes only on Validate.
