# Phase 7 — My Profile

> **TDD Reference:** `Technical_docs_design.md §6.9, §4.2 (users table), §7 (GET/PUT /profile)`  
> **Status:** 🔴 NOT BUILT  
> **Create:** `src/routes/_authenticated/profile.tsx`

---

## 7.1 Access Point

- [ ] Top-right profile icon → dropdown → "My Profile" link → navigates to `/profile`
- [ ] Available to ALL users (both roles)

---

## 7.2 View / Edit Fields (§6.9, §4.2)

| Field | Column | Editable | Notes |
|---|---|---|---|
| Login Id | `users.login_id` | ❌ Read-only | Shown for reference |
| Email | `users.email` | ❌ Read-only | Shown for reference |
| Full Name | `users.full_name` | ✅ | Was null at signup — collected here |
| Phone | `users.phone` | ✅ | Optional |
| Role | `users.role` | ❌ Read-only | User cannot change own role |
| Warehouse | `users.warehouse_id → warehouses.name` | ❌ Read-only | Assigned by Manager |

### Change Password Section
| Field | Notes |
|---|---|
| Current Password | required for verification |
| New Password | required |
| Confirm New Password | must match New Password |

---

## 7.3 API

```
GET /profile
→ { id, login_id, email, full_name, phone, role, warehouse_id, is_verified, created_at }

PUT /profile → { full_name?, phone?, password? (with current_password for verification) }
→ { updated user object }
```

---

## 7.4 Checklist

- [ ] Route `/profile` registered and accessible from nav profile dropdown
- [ ] Display: login_id, email, role, warehouse (read-only)
- [ ] Edit: full_name + phone fields with Save button
- [ ] Separate "Change Password" section with current + new + confirm fields
- [ ] Inline validation: new password ≠ confirm → show error, don't submit
- [ ] Success toast: "Profile updated" / "Password changed"
- [ ] Error handling if current password is wrong
