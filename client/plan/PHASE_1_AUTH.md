# Phase 1 — Authentication Flow

> **TDD Reference:** `Technical_docs_design.md §6.1, §4.2 (users + otp_verifications), §7 (Auth API), §8 rule 8`  
> **Status:** ✅ COMPLETE — `src/routes/auth.tsx` + `src/routes/reset-password.tsx`  
> **Review these files and tick off each micro-feature below.**

---

## 1.1 Login Screen

### Fields (§6.1)
| Field | DB Column | Notes |
|---|---|---|
| Login Id | `users.login_id` | NOT email — separate field (§4.2 critical note) |
| Password | `users.password_hash` | masked input with eye toggle |

### Behavior
- [x] On success → redirect to `/dashboard`
- [x] If `is_verified = false` → show specific "verify your account" error (§8 rule 8), NOT a generic auth failure
- [x] "Forgot Password?" link → triggers OTP Reset flow (§6.1)
- [x] "Sign Up" link → switches to Sign Up tab/page

### API Calls
```
POST /auth/login → { login_id, password }
Response: { user, token }
```

---

## 1.2 Sign Up Screen

### Fields (§6.1, §4.2)
| Field | Notes |
|---|---|
| Login Id | Unique — reject duplicates with clear "Login ID already taken" message |
| Email Id | Unique — reject duplicates with clear "Email already registered" message |
| Password | required |
| Re-Enter Password | client-side inline validation: must match Password before submit |

> ⚠️ **No Name field, No Role field** on this screen. `full_name` = null at creation. `role` defaults to `WAREHOUSE_STAFF` server-side.

### Behavior
- [x] Password ≠ Confirm → inline error, do NOT submit
- [x] On success → `is_verified=false`, OTP sent to `email` (`purpose='SIGNUP_VERIFICATION'`)
- [x] After signup → redirect to **Login** / OTP verification page (mockup note: "on Sign Up should redirect to login page")

### API Calls
```
POST /auth/signup → { login_id, email, password }
Response: { user, message: "OTP sent to email" }
```

---

## 1.3 Forgot Password Flow (§6.1)

### Steps
1. User enters `login_id` or `email` → `POST /auth/forgot-password`
2. OTP sent to account's `email` → `otp_verifications` row with `purpose='PASSWORD_RESET'`
3. User enters 6-digit OTP → `POST /auth/verify-reset-otp` → returns `reset_token`
4. User enters new password → `POST /auth/reset-password` with `{ reset_token, new_password }`

### API Calls
```
POST /auth/forgot-password → { login_id | email }
POST /auth/verify-reset-otp → { login_id, otp_code } → { reset_token }
POST /auth/reset-password → { reset_token, new_password }
```

---

## 1.4 OTP Verification (Signup)

### Flow (§4.2 otp_verifications table)
- OTP = 6-digit code
- `expires_at` = now() + 10 min
- `is_used` = false until consumed
- After OTP verified → `users.is_verified = true`
- User can now log in

---

## 1.5 Checklist — Verify in auth.tsx

- [x] Login Id field (not `email` as login credential)
- [x] Signup has `Login Id` + `Email Id` as **two separate fields**
- [x] Password confirm inline validation
- [x] "Verify your account" error path for unverified users
- [x] Forgot password 3-step OTP flow
- [x] Redirect to Login after Signup (not Dashboard)
- [x] Theme Toggle button available on screen (all 5 themes supported)
