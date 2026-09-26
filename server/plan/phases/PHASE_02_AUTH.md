# Phase 02 — Authentication & User Management

**Estimated Time**: 60 minutes  
**Priority**: P0

---

## Objective

Implement the complete authentication system: signup with OTP verification, login, password reset via OTP, JWT issuance, and the auth middleware used by all subsequent phases.

---

## Components Created

```
src/modules/auth/
  auth.routes.ts
  auth.controller.ts
  auth.service.ts
  auth.schema.ts
```

`src/middleware/auth.middleware.ts` — completed (was scaffolded in Phase 01)

---

## Database

Tables used (created in Phase 01 migration):
- `users`
- `otp_verifications`

No new migrations needed.

---

## APIs

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /auth/signup | Public | create user + OTP |
| POST | /auth/verify-signup-otp | Public | verify + set is_verified |
| POST | /auth/login | Public | returns JWT |
| POST | /auth/forgot-password | Public | generates PASSWORD_RESET OTP |
| POST | /auth/verify-reset-otp | Public | returns reset_token |
| POST | /auth/reset-password | Public | updates password |
| GET | /auth/me | Bearer | returns current user |
| POST | /auth/logout | Bearer | stateless, returns message |

---

## Zod Schemas

```typescript
// auth.schema.ts
const SignupSchema = z.object({
  body: z.object({
    login_id: z.string().min(3).max(60),
    email: z.string().email().max(160),
    password: z.string().min(8),
  })
})

const VerifyOtpSchema = z.object({
  body: z.object({
    login_id: z.string(),
    otp_code: z.string().length(6),
  })
})

const LoginSchema = z.object({
  body: z.object({
    login_id: z.string(),
    password: z.string(),
  })
})

const ForgotPasswordSchema = z.object({
  body: z.object({
    login_id: z.string(), // accepts login_id or email — service searches both
  })
})

const ResetPasswordSchema = z.object({
  body: z.object({
    reset_token: z.string(),
    new_password: z.string().min(8),
  })
})
```

---

## Key Business Logic

### Signup
1. Check login_id uniqueness (409 CONFLICT with message specifying which field)
2. Check email uniqueness (same)
3. Hash password with bcrypt (saltRounds=10)
4. Create user `{ is_verified: false, role: WAREHOUSE_STAFF }`
5. Generate 6-digit OTP, store with `purpose=SIGNUP_VERIFICATION, expires_at=now+10min`
6. Return `{ user, message, otp_code }` ← otp_code in response for dev

### Login
1. Find user by login_id (404 if not found → return 401 to avoid enumeration)
2. Check `is_verified = true` → else 403 NOT_VERIFIED
3. Compare password with bcrypt
4. Issue JWT: `{ sub: userId.toString(), role, warehouseId, type: 'ACCESS' }`
5. Return `{ user: {id, login_id, email, role, warehouse_id}, token }`

### OTP Validation (shared logic)
1. Find latest unused OTP for user+purpose
2. Check `expires_at > now()`
3. Check `is_used = false`
4. Mark `is_used = true`

### Reset Password
1. `verify-reset-otp`: validate OTP → issue short-lived JWT `{ sub: userId, type: 'RESET', exp: +15min }`
2. `reset-password`: verify reset JWT (type must be RESET), hash new password, update user

---

## Auth Middleware (completed here)

```typescript
// authenticate: all protected routes
export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) throw Errors.unauthorized()
  const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
  if (payload.type !== 'ACCESS') throw Errors.unauthorized()
  req.user = {
    userId: BigInt(payload.sub),
    role: payload.role,
    warehouseId: payload.warehouseId ? BigInt(payload.warehouseId) : null
  }
  next()
}

// requireRole: role-gated routes
export const requireRole = (role: UserRole) => (req, res, next) => {
  if (req.user.role !== role) throw Errors.forbidden()
  next()
}
```

---

## Depends On

- Phase 01 (server, Prisma client, utils, middleware scaffold)

## Creates

- Fully functional auth system
- `authenticate` and `requireRole` middleware used by ALL later phases
- users + otp_verifications table operations

## Required By

- **Every authenticated phase** (03 through 14)

---

## Testing / Completion Criteria

- [ ] POST /auth/signup creates user with is_verified=false
- [ ] Duplicate login_id returns 409 with clear message
- [ ] Duplicate email returns 409 with clear message
- [ ] POST /auth/login before OTP verification returns 403 NOT_VERIFIED
- [ ] POST /auth/verify-signup-otp sets is_verified=true
- [ ] POST /auth/login with correct credentials returns JWT token
- [ ] GET /auth/me with valid token returns user
- [ ] GET /auth/me without token returns 401
- [ ] Expired/invalid token returns 401
