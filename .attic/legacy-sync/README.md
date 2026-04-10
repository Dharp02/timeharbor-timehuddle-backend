# Legacy Sync — Archived Backend Code

**Archived on:** 2026-04-02
**Reason:** Phase 5 cleanup — server no longer stores unencrypted user data.

## What was removed

### Controllers (sync-only)
- `time.controller.ts` — syncSessions, pullSessions
- `note.controller.ts` — pushNotes, pullNotes
- `project.controller.ts` — pushProjects, pullProjects
- `activity.controller.ts` — pushActivities, pullActivities

### Controllers (CRUD + sync, both removed)
- `ticket.controller.ts` — createTicket, listTickets, updateTicket, deleteTicket, pushTickets, pullTickets
- `operation-log.controller.ts` — pushOperationLogs, pullOperationLogs, clearOperationLogs

### Models (unencrypted data)
- `ticket.model.ts`, `work-session.model.ts`, `note.model.ts`
- `project.model.ts`, `operation-log.model.ts`, `user-daily-stat.model.ts`

## What is kept
- `User` + `Session` (Better Auth)
- `Profile` (user settings/avatar)
- `EncryptedOpLogBatch` (opaque E2E encrypted blobs)

## Rationale
With E2E encrypted sync, the server only relays encrypted blobs.
It cannot read, create, update, or delete user work data.
All CRUD happens client-side in Dexie (IndexedDB).
