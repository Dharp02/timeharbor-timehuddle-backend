# Unit & Integration Testing Plan

## Stack Recommendation

**Test runner: [Vitest](https://vitest.dev/)**

Vitest is the right choice here because:
- Native ESM support (this project uses `"type": "module"`)
- TypeScript out of the box via tsx/esbuild — no extra config
- Compatible with the existing `tsconfig.json`
- Fast, with watch mode that mirrors `tsx watch`
- Jest-compatible API, so patterns are familiar

No Playwright, no browser — all tests run in Node for unit tests.

---

## Test Categories

### 1. Unit Tests
Pure logic, no I/O. Mock all dependencies.

**Targets:**
- `UserService` — mock the MongoDB collection, test `findById`, `findByEmail`, `list`
- `UserController` — mock `req.user`, assert reply shape
- `requireAuth` middleware — mock `auth.api.getSession`, test authorized vs. unauthorized paths
- `HealthController` — assert `status: "ok"` and valid ISO timestamp

**Pattern:**
```ts
// services/user.service.test.ts
vi.mock("../models/index.js", () => ({
  usersCollection: () => ({ findOne: vi.fn().mockResolvedValue(mockUser) }),
}));
```

---

### 2. Integration Tests (HTTP layer)
Spin up the real Fastify app in-process using `app.inject()`. No live server needed. Mock only the database and auth session — not the route or middleware wiring.

**Targets:**
- `GET /api/health` → 200, correct shape
- `GET /api/timeharbor/me` → 401 with no session cookie
- `GET /api/timeharbor/me` → 200 with a mocked valid session
- `GET /api/timeharbor/me/profile` → 200 with mocked DB user
- `GET /api/timeharbor/me/profile` → 404 when DB returns null
- Same route matrix for `/api/timehuddle/...`

**Pattern:**
```ts
// Fake out connectDB so there's no real Mongo connection needed
vi.mock("../lib/db.js", () => ({
  connectDB: vi.fn(),
  getDB: vi.fn(),
  client: { db: () => ({}) },
}));

// Fake session for authenticated routes
vi.mock("../lib/auth.js", () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue({ user: mockUser, session: mockSession }) },
    $Infer: { Session: {} },
    handler: vi.fn(),
  },
}));
```

---

### 3. Auth Flow Tests (better-auth)
`better-auth` exposes an in-memory test client via `createAuthClient`. No browser needed.

The strategy is to:
1. Instantiate `betterAuth` with an **in-memory adapter** (or `mongodb-memory-server`) instead of the real MongoDB
2. Use the `@better-auth/testing` helpers (or raw `fetch` against `app.inject()`) to drive sign-up → sign-in → get session → sign-out

**Targets:**
- Sign up with email + password → user created
- Sign in with correct credentials → session cookie returned
- Sign in with wrong password → 401
- `requireAuth` passes a valid session through
- `requireAuth` rejects an expired/missing session

This keeps auth tests fully in-process without needing a real DB or browser.

---

## File Structure

```
src/
  controllers/
    health.controller.test.ts
    user.controller.test.ts
  services/
    user.service.test.ts
  middleware/
    require-auth.test.ts
  routes/
    health.test.ts          ← integration
    timeharbor/
      index.test.ts         ← integration
    timehuddle/
      index.test.ts         ← integration
  lib/
    auth.test.ts            ← auth flow tests
```

---

## Packages to Install

```bash
npm install -D vitest @vitest/coverage-v8 mongodb-memory-server
```

- `vitest` — test runner
- `@vitest/coverage-v8` — coverage reports
- `mongodb-memory-server` — real MongoDB wire protocol in-memory, used optionally for auth flow tests to avoid mocking the adapter entirely

---

## `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts"],
    },
  },
});
```

---

## npm scripts to add

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## What We Are NOT Doing

- No Playwright / browser tests
- No supertest (Fastify's `app.inject()` replaces it natively)
- No separate test database container — `mongodb-memory-server` handles that in-process
- No snapshot tests — this is an API, not a UI
