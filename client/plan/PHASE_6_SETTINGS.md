# Phase 6 — Settings

> **TDD Reference:** `Technical_docs_design.md §6.4 (Warehouse/Location forms), §4.2 (all master data tables), §7 (Categories/UoM/Warehouses/Locations APIs), §3 (role permissions), §8 rule 7`  
> **Status:** 🔴 NOT BUILT (settings.tsx exists but is a skeleton)  
> **Expand:** `src/routes/settings.tsx`  
> **Create helper components:** `src/components/settings/`

---

## 6.1 Settings Page Structure

Settings is a **tabbed page** with these sub-sections:

| Tab | Content |
|---|---|
| Warehouses | CRUD for `warehouses` |
| Locations | CRUD for `locations` |
| Categories | CRUD for `product_categories` |
| Units of Measure | CRUD for `units_of_measure` |
| Partners | CRUD for `partners` (Suppliers + Customers) |
| Users | View/manage users, assign roles + warehouses (Manager only) |
| Theme | Theme picker (light/dark/system + accent color) |

> **Access control (§3):** Only `INVENTORY_MANAGER` can perform write actions (create/edit/delete) in Settings. `WAREHOUSE_STAFF` gets read-only view.

---

## 6.2 Warehouses CRUD (§6.4, §4.2)

### Form Fields (maps to `warehouses` table)
| Field | Column | Notes |
|---|---|---|
| Name | `warehouses.name` VARCHAR(120) | required |
| Short Code | `warehouses.code` VARCHAR(20) UNIQUE | required; used in reference numbers |
| Address | `warehouses.address` TEXT | optional |

### Behavior
- [ ] List table: Name, Short Code, Address, Actions (Edit, Deactivate)
- [ ] Soft delete only (`is_active=false`) — §2 and §8 rule 7
- [ ] Block soft-delete if warehouse is referenced by a non-canceled operation (show error)

### API
```
GET  /warehouses
POST /warehouses → { name, code, address? }
PUT  /warehouses/{id}
DELETE /warehouses/{id} → soft delete
```

---

## 6.3 Locations CRUD (§6.4, §4.2)

### Form Fields (maps to `locations` table)
| Field | Column | Notes |
|---|---|---|
| Name | `locations.name` VARCHAR(120) | required |
| Short Code | `locations.code` VARCHAR(30) | required |
| Warehouse | `warehouse_id` dropdown → `warehouses` | required for INTERNAL type |
| Parent Location | `parent_location_id` dropdown → `locations` | optional (§4.2 note — add even if not in mockup screenshot) |
| Location Type | `location_type` | INTERNAL only for user creation; VENDOR/CUSTOMER/ADJUSTMENT_VIRTUAL are system-seeded, not user-creatable |

### Behavior
- [ ] Filter locations list by warehouse
- [ ] Do NOT show VENDOR/CUSTOMER/ADJUSTMENT_VIRTUAL system locations in the create form
- [ ] Soft delete only

### API
```
GET  /locations?warehouse_id=
POST /locations → { warehouse_id?, parent_location_id?, name, code, location_type }
PUT  /locations/{id}
DELETE /locations/{id}
```

---

## 6.4 Categories CRUD (§4.2)

### Fields
| Field | Column | Notes |
|---|---|---|
| Name | `product_categories.name` VARCHAR(100) | required |
| Parent Category | `parent_category_id` FK → self | optional (for hierarchy) |

### API
```
GET  /categories
POST /categories → { name, parent_category_id? }
PUT  /categories/{id}
DELETE /categories/{id}
```

---

## 6.5 Units of Measure CRUD (§4.2)

### Fields
| Field | Column | Notes |
|---|---|---|
| Name | `units_of_measure.name` VARCHAR(40) | e.g. "Pieces" |
| Code | `units_of_measure.code` VARCHAR(10) | e.g. "pcs", "kg" |

### API
```
GET  /uom
POST /uom → { name, code }
PUT  /uom/{id}
DELETE /uom/{id}
```

---

## 6.6 Partners CRUD (§4.2)

### Fields
| Field | Column | Notes |
|---|---|---|
| Name | `partners.name` VARCHAR(150) | required |
| Type | `partners.type` | `SUPPLIER` or `CUSTOMER` |
| Email | `partners.email` | optional |
| Phone | `partners.phone` | optional |
| Address | `partners.address` TEXT | optional (used as Delivery Address in deliveries) |

### Behavior
- [ ] Filter by type: All / Suppliers / Customers
- [ ] Suppliers appear in Receipt "Receive From" dropdown
- [ ] Customers appear in Delivery "Deliver To" dropdown

### API
```
GET  /partners?type=SUPPLIER|CUSTOMER
POST /partners → { name, type, email?, phone?, address? }
PUT  /partners/{id}
DELETE /partners/{id}
```

---

## 6.7 User Management (§3, §4.2, §9)

> **Manager only** — Warehouse Staff cannot access this tab.

### Fields to manage
| Field | Notes |
|---|---|
| `login_id` | read-only |
| `email` | read-only |
| `full_name` | display only |
| `role` | dropdown: INVENTORY_MANAGER / WAREHOUSE_STAFF — reassignable by Manager |
| `warehouse_id` | dropdown → warehouses — assign after signup |
| `is_active` | toggle to deactivate |
| `is_verified` | display only |

> **Why this matters (§9):** Every new signup defaults to `WAREHOUSE_STAFF`. The Manager must be able to promote a user here. This is also the only way to assign `warehouse_id` to staff.

### API
```
GET  /users  (Manager only)
PUT  /users/{id} → { role?, warehouse_id?, is_active? }
```

---

## 6.8 Theme Picker

- [ ] Toggle: Light / Dark / System
- [ ] Works with `theme-provider.tsx` already in place
- [ ] Persisted in `localStorage` (already done by theme provider)
- [ ] Optional: accent color picker

---

## 6.9 Checklist

- [ ] Settings page has 7 tabs: Warehouses, Locations, Categories, UoM, Partners, Users, Theme
- [ ] Warehouses: list + create + edit + soft-delete with reference block
- [ ] Locations: list + create + edit + warehouse filter + parent location dropdown
- [ ] Categories: list + create + edit + parent category dropdown
- [ ] UoM: list + create + edit
- [ ] Partners: list (with type filter) + create + edit
- [ ] Users: list + role/warehouse assignment (Manager only tab)
- [ ] Theme: toggle that actually works
- [ ] Role guard: Warehouse Staff sees read-only views of all tabs except Users (hidden entirely)
