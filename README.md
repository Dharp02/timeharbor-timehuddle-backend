# timeharbor-timehuddle-backend

Backend monorepo for [TimeharborApp](../timeharbourapp/README.md) — a Fastify API server with a shared time calculation engine.

## Structure

```
timeharbor-timehuddle-backend/
├── src/                           # Fastify API server
│   ├── server.ts                  # Entry point
│   ├── routes/                    # Route definitions
│   ├── controllers/               # Request handlers
│   ├── models/                    # MongoDB collection accessors
│   └── middleware/                # Auth, error handling
└── packages/
    └── time-engine/               # @timeharbor/time-engine
        └── src/
            ├── types.ts           # RawSession, SessionStats, DayStats
            ├── computeSession.ts  # Single session → stats
            ├── computeDay.ts      # Sessions[] → day totals
            └── index.ts           # Barrel export
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Fastify v5 |
| Database | MongoDB (native driver, no Mongoose) |
| Auth | Better Auth with MongoDB adapter |
| Real-time | @fastify/websocket |
| API docs | @fastify/swagger (auto-generated at `/docs`) |

## Getting Started

```bash
npm install
```

Create a `.env` file:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/timeharbor
BETTER_AUTH_SECRET=your-secret
FRONTEND_URL=http://localhost:3000
```

```bash
npm run dev
```

API available at `http://localhost:3001`.

## Shared Calculation Engine

`@timeharbor/time-engine` is a zero-dependency package of pure TypeScript functions. Used by both the backend and the Next.js frontend (including Capacitor iOS/Android builds).

- Same input + same algorithm = same numbers on client and server
- All timestamps are UTC epoch milliseconds
- All functions are pure — no side effects, no `Date.now()`

## Encrypted Op-Log Sync

The server acts as a **zero-knowledge relay** for client sync:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sync/oplog` | POST | Receive encrypted op-log batches from client |
| `/sync/oplog` | GET | Return encrypted batches for other devices |
| `/sync/oplog/compact` | DELETE | Remove old consumed batches |
| `/sync/oplog/purge` | DELETE | Purge all sync data |
| `/sync/oplog/status` | GET | Check if user has sync data |

The server cannot decrypt the op-log payloads (AES-256-GCM, client-side keys).

## Build

```bash
npm run build    # Compiles to dist/
node dist/server.js
```
