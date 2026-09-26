# StockSense Backend — Testing Strategy

> Framework: **Vitest**  
> Scope: Critical business logic only (hackathon constraint)

---

## Priority Test Areas

Given the 7–8 hour hackathon constraint, tests focus on high-risk, high-impact paths.

| Priority | Area | Why Critical |
|---|---|---|
| P0 | Authentication flows | Login/signup bugs block all frontend usage |
| P0 | Receipt validate → stock increase | Core inventory operation |
| P0 | Delivery validate → stock decrease | Core inventory operation |
| P0 | Insufficient stock rejection | Safety rule must not break |
| P0 | Internal transfer → source − / dest + | Both sides must change atomically |
| P0 | Adjustment validate → stock corrected | Adjustment is a critical correction tool |
| P0 | Ledger entries created on validate | Audit trail integrity |
| P1 | OTP verification flow | Blocks login |
| P1 | Reserved quantity lifecycle | Reservation bugs cause phantom stock |
| P1 | Duplicate SKU / reference rejection | Data integrity |
| P1 | Invalid state transitions | e.g. validate a DRAFT, cancel a DONE |
| P2 | Dashboard KPI accuracy | Nice to have |
| P2 | Soft delete reference blocking | Data integrity |

---

## Test Structure

```
server/
└── tests/
    ├── auth.test.ts
    ├── products.test.ts
    ├── receipts.test.ts
    ├── deliveries.test.ts
    ├── transfers.test.ts
    ├── adjustments.test.ts
    ├── stock.service.test.ts
    └── helpers/
        ├── setup.ts        # test DB setup / teardown
        └── factories.ts    # test data factories
```

---

## Test Approach

### Unit Tests (Service layer)

- Mock Prisma client
- Test business logic in isolation
- Fast, no DB connection required

### Integration Tests (HTTP layer)

- Use a test database (separate `DATABASE_URL_TEST` env)
- Use `supertest` to call Express app endpoints
- Reset DB state between test suites

### For the hackathon: prefer integration tests

Integration tests give higher confidence with less mocking overhead. They test the full stack (routing → controller → service → DB) in one test.

---

## Critical Test Cases

### Auth
```
✓ Signup with valid data creates user (is_verified=false)
✓ Duplicate login_id returns 409
✓ Duplicate email returns 409
✓ Login before OTP verification returns 403 NOT_VERIFIED
✓ Login after verification with correct password returns token
✓ Login with wrong password returns 401
```

### Receipt
```
✓ Create receipt in DRAFT
✓ Confirm receipt moves to READY
✓ Validate receipt increments stock_quants at destination
✓ Validate receipt writes stock_ledger_entries
✓ Validate DRAFT receipt fails (invalid transition)
✓ Validate with all lines quantity_done=0 fails
```

### Delivery
```
✓ Confirm delivery with sufficient stock → READY + reserves stock
✓ Confirm delivery with insufficient stock → WAITING + still reserves
✓ Validate delivery decrements stock_quants
✓ Validate delivery with quantity_done > available returns 422 INSUFFICIENT_STOCK
✓ Cancel READY delivery releases reservation
```

### Transfer
```
✓ Validate transfer decrements source location
✓ Validate transfer increments destination location
✓ Both changes are atomic (if one fails, neither applies)
```

### Adjustment
```
✓ Create adjustment fills recorded_quantity from current stock
✓ Validate adjustment with positive difference increases stock
✓ Validate adjustment with negative difference decreases stock
✓ Validate adjustment writes ledger entry
```

### StockService
```
✓ increment() adds to quantity
✓ decrement() with sufficient stock reduces quantity
✓ decrement() with insufficient stock throws INSUFFICIENT_STOCK
✓ reserve() adds to reserved_quantity
✓ releaseReservation() reduces reserved_quantity
✓ getAvailable() returns quantity - reserved_quantity
```

---

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    testTimeout: 10000,
  },
})
```

---

## Implementation Timing

Tests are written **after** the relevant phase is implemented (not before, given hackathon time pressure). The sequence is:

```
Implement Phase X
    ↓
Manually verify via REST client (e.g. Bruno/Postman)
    ↓
Write critical tests for Phase X
    ↓
Move to Phase X+1
```
