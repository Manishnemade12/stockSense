# StockSense frontend roadmap

> See `plan/` folder for detailed phase-by-phase specs.

- [x] Backend: schema, rules, auth, sample data (done previously)
- [x] Auth pages: login / sign-up / forgot password / reset password (`src/routes/auth.tsx`, `reset-password.tsx`)
- [x] Protected layout: top menu + profile icon (My Profile, Logout) (`src/routes/_authenticated/route.tsx`)
- [x] Dashboard: Receipt & Delivery cards, stock totals (`src/routes/_authenticated/dashboard.tsx`)
- [x] Products page with editable Stock tab (`src/routes/_authenticated/products.tsx`)
- [ ] Operations: Receipts — list/kanban, search, detail form, To Do/Validate/Cancel/Print 🔴
- [ ] Operations: Deliveries — with red-line short-stock flag 🔴
- [ ] Operations: Internal Transfers — list + detail 🔴
- [ ] Operations: Adjustments — recorded qty read-only + counted qty input 🔴
- [ ] Move History: green in / red out, join to operations for live status 🔴
- [ ] Settings: warehouses, locations, categories, units, partners, users, theme 🟠
- [ ] Profile page (full_name, phone, change password) 🟡
- [ ] End-to-end check of every flow 🟡
