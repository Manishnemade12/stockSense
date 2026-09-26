# Phase 01 — Project Foundation & Infrastructure

**Estimated Time**: 30 minutes  
**Priority**: P0

---

## Objective

Bootstrap the complete Express.js + TypeScript + Prisma project scaffold so every subsequent phase can build directly on a working, runnable base.

---

## Components Created

### Project files
- `package.json` — all dependencies listed
- `tsconfig.json` — TypeScript config
- `.env` — environment variables
- `.env.example`
- `.gitignore`
- `vitest.config.ts`

### Source files
- `src/server.ts` — HTTP server entry point
- `src/app.ts` — Express app factory (middleware registration, router mounting)
- `src/config/env.ts` — Zod-validated env vars
- `src/prisma/client.ts` — Prisma client singleton
- `src/utils/response.ts` — `sendSuccess`, `sendList`, `sendError`
- `src/utils/errors.ts` — `AppError` class + `Errors` factory
- `src/middleware/error.middleware.ts` — global error handler
- `src/middleware/auth.middleware.ts` — JWT verify + `requireRole` (scaffold, implemented in Phase 02)
- `src/middleware/validate.middleware.ts` — Zod validation wrapper

### Prisma
- `prisma/schema.prisma` — **complete final schema** (all models, enums, relations from DATABASE.md)
- `prisma/seed.ts` — virtual locations, admin user, default UoM, default category
- First migration: `prisma migrate dev --name init`

---

## Dependencies

### npm dependencies
```json
{
  "dependencies": {
    "@prisma/client": "^5",
    "bcryptjs": "^2",
    "cors": "^2",
    "express": "^4",
    "jsonwebtoken": "^9",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/bcryptjs": "*",
    "@types/cors": "*",
    "@types/express": "*",
    "@types/jsonwebtoken": "*",
    "@types/node": "*",
    "prisma": "^5",
    "tsx": "*",
    "typescript": "^5",
    "vitest": "^1"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "test": "vitest run"
  }
}
```

### Environment variables (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/stocksense
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
JWT_RESET_EXPIRES_IN=15m
PORT=3000
NODE_ENV=development
```

---

## Database

The **complete** Prisma schema is written in this phase — not incrementally. This ensures:
- All relations are defined upfront
- Single migration instead of 15 incremental ones
- No schema changes break later phases

All models from DATABASE.md are included: users, otp_verifications, warehouses, locations, product_categories, units_of_measure, products, partners, stock_operations, stock_operation_lines, stock_adjustment_lines, stock_quants, stock_ledger_entries.

---

## APIs

`GET /health` — returns `{ success: true, data: { status: 'ok', timestamp } }`. No auth. Used to verify the server is running.

---

## Auth/Authorization

None yet. Auth middleware is scaffolded but not functional (implemented in Phase 02).

---

## Depends On

- Nothing (this is the foundation)

## Creates

- Runnable Express server
- Complete Prisma schema + migration
- Seeded DB (virtual locations, admin, default data)
- All shared utilities

## Required By

- **Every subsequent phase**

---

## Testing / Completion Criteria

- [ ] `npm run dev` starts without errors
- [ ] `GET /health` returns 200
- [ ] `npx prisma studio` shows all tables with correct columns
- [ ] Seed data present: 3 virtual locations, admin user, 4 UoMs, 1 category
- [ ] TypeScript compiles without errors
