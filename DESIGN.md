# Design & Assumptions

## Overview

NestJS + TypeScript + Supabase (PostgreSQL). A modular monolith: `integrations/customer-api` isolates the external contract, `modules/sync` orchestrates synchronization, `modules/users` exposes the read API, `modules/customers` owns customer identity. See [README.md](README.md) for setup and endpoints.

## The external API contract

The customer API (`https://assessment-api-gamma.vercel.app`) requires an admin token (`Authorization: Bearer <token>` or `x-admin-token`) on every endpoint, including `GET /api/users`. Its OpenAPI document (`/api/openapi`, also token-gated) was fetched and used as the authoritative contract once a token was available. Verified shape:

```json
{
  "data": [
    {
      "id": "mongo-objectid-hex",
      "name": "string",
      "email": "string (unique)",
      "phone": "string?",
      "status": "active | invited | suspended",
      "company": { "name": "string", "industry": "string", "role": "string", "website": "string?", "employees": "int?" },
      "createdAt": "ISO date-time",
      "updatedAt": "ISO date-time"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 130, "totalPages": 7, "hasNextPage": true, "hasPrevPage": false }
}
```

There is **no `deletedAt` field and no hard/soft-delete flag** — the API supports `DELETE /api/users/{id}`, which permanently removes a record. This directly shapes the deletion strategy below.

## Key design decisions

### 1. Deletion is detected by absence, not by a flag

The customer API has no way to ask "which users were deleted." The only signal available is: a user we previously synchronized is no longer present in a complete, successful fetch of the customer's current dataset.

**Decision:** every sync run fetches the *entire* dataset (all pages), then compares it against every currently-active (`deletedAt IS NULL`) user we have for that customer. Anyone previously active but absent from the new fetch gets `deletedAt` set — a soft delete. If a soft-deleted user's `externalUserId` reappears in a later fetch, the same row is reactivated (`deletedAt` cleared) rather than a new row being inserted.

**Why soft delete, not hard delete:** the assessment says "the customer may have users that have been deleted" as something our system must *handle*, not necessarily mirror destructively. Soft deletion preserves history, makes the behavior visible (`GET /api/v1/users?includeDeleted=true`), and is trivially reversible if the user reappears — hard deletion would need to distinguish "reappeared" from "brand new" by other means once the row is gone.

**Why fetch-all before comparing:** a partial page fetch (e.g., stopped after a timeout) must never be mistaken for "the rest of the users were deleted." Deletion detection only runs after the complete dataset has been fetched and validated.

### 2. Duplicate prevention

Unique constraint on `(customerId, externalUserId)`. Every sync is an upsert on this key — running the identical sync twice produces identical data (verified by an e2e test): `recordsCreated: 0`, `recordsUpdated: N` on the second run.

`externalUserId` (the customer API's `id`, a Mongo ObjectId) is treated as an opaque string — no assumption about its format beyond "stable and unique per customer."

### 3. Failure safety

1. Fetch and fully validate the external dataset (all pages) *before* any database write.
2. If the fetch fails (network error, 401, 5xx) at any point, nothing is written — the previous synchronized dataset is completely untouched. The failure is recorded as a `SyncRun` with `status: FAILED` and a safe error code/message (no stack traces, tokens, or raw payloads).
3. If the fetch succeeds, upserts + deletion-marking happen atomically inside a single Postgres function (`sync_users`, see `supabase/schema.sql`), invoked with one `.rpc()` call — the Supabase JS client has no client-side multi-statement transaction API, so the atomicity lives in the database function itself rather than in application code. The `SyncRun` completion is then recorded as a separate write; a database error during `sync_users` rolls back that function's own work, so a sync never leaves half-applied user changes.

This was verified by pointing the client at an invalid token: the sync run failed immediately (no retries — see below) with `errorCode: EXTERNAL_API_UNAUTHORIZED`, and the previously synced 130 users were confirmed still present and unchanged.

### 4. Retry policy

Transient failures (network errors, 5xx) are retried with exponential backoff (250ms, 500ms, 1s, …) up to `CUSTOMER_API_MAX_RETRIES` (default 3). Client errors (4xx, including 401/403) are **never** retried — retrying a bad token or a malformed request cannot succeed and would only slow down failure reporting.

### 5. Schema independence (three separate shapes)

- `ExternalUser` (`src/integrations/customer-api/customer-api.types.ts`) — exactly the customer API's shape. Nothing outside `integrations/customer-api/` may import or depend on it.
- `User` (`src/domain/types.ts`) — our internal representation: flattened company fields (searchable, indexed), our own `status` enum, our own timestamps (`createdAt`/`updatedAt` = our bookkeeping, `externalCreatedAt`/`externalUpdatedAt` = the customer's).
- `UserResponseDto` (`src/modules/users/dto/user-response.dto.ts`) — the public API shape: renamed/reshaped again (`company` as a flat string, `isDeleted` boolean, `syncedAt`), independent of both of the above.

A single `mapExternalUserToSyncedUserData` function is the only bridge between the first two; `UserResponseDto.fromEntity` is the only bridge to the third. This means the customer API changing its field names, or us changing our database schema, doesn't ripple through the whole codebase.

### 6. Multi-customer readiness

Every `User` and `SyncRun` row is scoped by `customerId`. `Customer` stores its own `apiBaseUrl`, so a second customer is a new `Customer` row (with its own base URL and — in a real multi-tenant deployment — its own token, which would move from a single env var to a per-customer secret) rather than a code change. `CustomerApiClient.fetchAllUsers` already takes the base URL and token as parameters rather than reading them from global config, so this isn't a hidden assumption.

### 7. Concurrency

A process-local `Set<customerId>` in `SyncService` rejects a second concurrent sync for the same customer with `409 Conflict`. This is sufficient for a single-instance deployment (this assessment's scope); a multi-instance deployment would need a database-backed lock (e.g., a `SELECT … FOR UPDATE` on the `Customer` row, or an advisory lock) instead.

### 8. Routing

- `GET /api/v1/users` — under the global `api` prefix and URI versioning, per the assessment's example.
- `POST /sync/users` — deliberately excluded from both the `api` prefix and versioning, to match the assessment's literal `POST /sync/users` example exactly.

### 9. UI

The assessment's bonus/requirements text is inconsistent about whether a UI is required ("Build a small UI" vs. "No need to build a frontend unless you want to"). A UI is included since it makes the system easier to demo and verify.

It's a **separate Next.js application** in `frontend/` (its own `package.json`, own dependency tree, own dev server on port 3001) rather than server-rendered pages inside the NestJS app — this keeps the backend a pure API service and the two deployable/scalable independently, which matches the assessment's own framing of backend and frontend as separate concerns. It talks to the backend only over HTTP (`fetch`, CORS-enabled), never through shared code or a database connection of its own.

Three routes, one per bonus/requirement: `/` (list, filter, paginate, trigger sync — the minimum required), `/users/[id]` (user detail, added as a bonus), and `/sync-history` (operational history of every sync run, added as a bonus, backed by the new `GET /api/v1/sync/runs` endpoint). `npm run dev:all` in the backend directory runs both servers together for convenience; they remain independently runnable and independently deployable.

## What was verified vs. assumed

Everything in "Key design decisions" above reflects the **actual, verified** contract once an admin token was obtained (see README/AI-usage note) — the OpenAPI document was fetched and used directly, and every field mapping was checked against real API responses (130 real synchronized users, confirmed via `GET /api/users?limit=2` and later a full sync). Nothing in the shipped mapper or schema is a guess.

The one genuine design choice (not a contract fact) is **soft vs. hard deletion**, discussed in decision #1 — the assessment doesn't mandate either, and soft deletion was chosen for the reasons given there.

## Bonus features implemented

- **Pagination** — both directions: the customer API client fetches all pages before syncing; `GET /api/v1/users` paginates its own results.
- **Retry logic** — exponential backoff on transient failures, no retry on client errors (see decision #4).
- **Scheduled sync** — optional, via `SYNC_CRON`; disabled by default.
- **Tests** — unit tests (mapper, HTTP client retry/classification, sync orchestration with a mocked Supabase client, users service) and e2e tests (real Supabase project, mocked customer API client) covering idempotency, deletion, reactivation, and failure-safety.
- **Docker** — `docker-compose.yml` (app only, pointed at Supabase via env vars) and a multi-stage `Dockerfile`.
- **API documentation** — Swagger/OpenAPI at `/api/docs`.
- **Structured logging** — `sync.completed` / `sync.failed` log lines with customer id, record counts, and error codes (no payloads or secrets).
- **Additional UI pages** — a user-detail page and a sync-history page (see "UI" above), beyond the minimum "view, filter, sync" requirement.

## AI usage

Built with Claude (Anthropic) as the primary implementation tool: discovering and verifying the live customer API contract, writing the backend and frontend application code, tests, and this documentation, and iteratively running the real test suite (unit, e2e against a real database, and manual smoke tests against the live customer API and both dev servers running together) to verify behavior rather than assuming it.
