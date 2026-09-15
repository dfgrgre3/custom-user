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

The frontend also holds its own direct Supabase client (`frontend/src/lib/supabase.ts`), separate from the backend's. It's initialized with the publishable/anon key only (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), safe to ship to the browser since Supabase's Row Level Security — not secrecy of the key — is what gates access. It exists for any future feature that talks to Supabase directly from the browser (e.g. Supabase Auth); today's user/sync-run data still flows exclusively through the backend API, which is the only place holding the service role key.

## What was verified vs. assumed

Everything in "Key design decisions" above reflects the **actual, verified** contract once an admin token was obtained (see README/AI-usage note) — the OpenAPI document was fetched and used directly, and every field mapping was checked against real API responses (130 real synchronized users, confirmed via `GET /api/users?limit=2` and later a full sync). Nothing in the shipped mapper or schema is a guess.

The one genuine design choice (not a contract fact) is **soft vs. hard deletion**, discussed in decision #1 — the assessment doesn't mandate either, and soft deletion was chosen for the reasons given there.

## Hardening fixes from review

A code review surfaced several real correctness/robustness gaps, fixed as follows:

- **`includeDeleted=false` was being parsed as `true`.** `class-transformer`'s `@Type(() => Boolean)` uses JS's `Boolean(...)`, which coerces any non-empty string — including the literal `"false"` — to `true`. `ListUsersQueryDto` now uses an explicit `@Transform` that only accepts the strings `"true"`/`"false"` (case-insensitive) and rejects anything else via `@IsBoolean()`, instead of silently miscoercing it. Covered by a dedicated unit test (`list-users-query.dto.spec.ts`) that runs the exact `plainToInstance` + `validate` pipeline Nest's `ValidationPipe` uses.
- **Docker build was broken.** The `Dockerfile`'s production stage tried to `COPY --from=build /app/public ./public`, but no `public/` directory exists in this project — every `docker compose up --build` would fail. The line is removed; a full build/run smoke test now passes.
- **Runtime validation of the customer API response.** `ExternalUser` was a compile-time-only type; a cast (`status as ExternalUserStatus`) meant an unexpected value from the API (e.g. `status: "deleted"`) would sail through the mapper and only fail later as an opaque Postgres enum error. `customer-api.schema.ts` now validates every page response with Zod before it reaches the mapper; a mismatch raises `CustomerApiContractError` — classified as its own `EXTERNAL_API_CONTRACT_VIOLATION` `SyncRun` error code, and explicitly never retried (retrying an identical malformed response cannot succeed).
- **`customers.name` had no unique constraint**, so `getOrCreateDefaultCustomer`'s "select, then insert if missing" had a race window where two concurrent calls could both insert a duplicate `Customer` row. Added `unique (name)` to the schema and switched to a single `upsert(..., { onConflict: 'name' })`, which is race-free.
- **Unescaped search input in the PostgREST `.or()` filter.** `UsersRepository`'s `search` query param was interpolated directly into a comma/`.`-delimited filter string; a value containing `,`, `.`, `(`, or `)` could change which columns/operators were being filtered rather than just what was searched for. Added `escapePostgrestFilterValue`, which backslash-escapes those structural characters per PostgREST's own escaping rule.
- **No environment validation, no fail-fast startup.** Malformed or missing config (e.g. a non-numeric `PORT`, a missing `SUPABASE_SERVICE_ROLE_KEY`) previously let the app "start successfully" and fail later on first use. `config/configuration.schema.ts` validates the full environment with Zod through `ConfigModule.forRoot({ validate })`; a problem now fails startup immediately with every issue listed at once. Verified: running with no env vars set fails startup with a full list of missing/invalid variables; `SupabaseService` no longer has a "credentials might be missing" code path, since startup guarantees they're present by the time it runs.
- **Structured logging was just formatted text**, not real structured (JSON) logs — see the "Structured logging" bonus-feature entry below for the fix.
- **The frontend's "System" indicator was a hardcoded "Ready" label** with no real signal behind it — it would say "Ready" even with Supabase or the customer API down. Added a real `GET /health` endpoint (`src/modules/health/`) that makes a cheap real call to both — a `head`-only count query to Supabase, a 1-record request to the customer API — and returns HTTP 200/`status: "ok"` only when both succeed, HTTP 503 with per-component error detail otherwise. The frontend's `SystemStatus` component (`frontend/src/components/system-status.tsx`) polls it every 30s and reflects the real result. Verified against a live process: reports `database: error` with a fake Supabase URL while correctly reporting `customerApi: ok` against the real customer API with a valid token, and vice versa.
- **Unused Supabase browser client and dependencies removed.** `frontend/src/lib/supabase.ts` (a direct Supabase client added speculatively for a possible future feature like Supabase Auth) was never referenced by any page — removed, along with `@supabase/supabase-js` from the frontend's dependencies and its `NEXT_PUBLIC_SUPABASE_*` env vars. `@supabase/ssr` was similarly unused in the backend and removed. Confirmed via `depcheck` on both packages; the remaining flagged items in each (`pino-pretty`, `ts-node`, `tailwindcss`, etc.) are false positives — real dependencies referenced dynamically or by build tooling depcheck can't statically trace, checked individually rather than removed blindly.

Left as documented, deliberate scope boundaries (not bugs) for this assessment's single-instance, single-customer-in-practice scope: the process-local concurrency lock (decision #7), non-distributed scheduled sync, and a single shared customer-API token rather than per-customer credentials (decision #6) — all called out explicitly rather than silently assumed.

## Bonus features implemented

- **Pagination** — both directions: the customer API client fetches all pages before syncing; `GET /api/v1/users` paginates its own results.
- **Retry logic** — exponential backoff on transient failures, no retry on client errors (see decision #4).
- **Scheduled sync** — optional, via `SYNC_CRON`; disabled by default.
- **Tests** — unit tests (mapper, HTTP client retry/classification, sync orchestration with a mocked Supabase client, users service) and e2e tests (real Supabase project, mocked customer API client) covering idempotency, deletion, reactivation, and failure-safety.
- **Docker** — `docker-compose.yml` runs the production-stage image only (no bind mount, no local database) pointed at Supabase entirely through environment variables; a multi-stage `Dockerfile` also supports a `development` target for local (non-Docker) work.
- **API documentation** — Swagger/OpenAPI at `/api/docs`.
- **Structured logging** — real JSON logs via `nestjs-pino`/`pino`, not just formatted text: every log line is a JSON object (`level`, `time`, `context`, `msg`, plus request fields from `pino-http`'s auto-logging), so it's directly indexable by a log aggregator. Pretty-printed instead in development (`pino-pretty`) since raw JSON is unpleasant to read locally. `Authorization`/`x-admin-token`/`Cookie` headers are redacted at the logger level, and `sync.completed` / `sync.failed` lines still carry customer id, record counts, and error codes (no payloads or secrets).
- **Additional UI pages** — a user-detail page and a sync-history page (see "UI" above), beyond the minimum "view, filter, sync" requirement.

## AI usage

Built with Claude (Anthropic) as the primary implementation tool: discovering and verifying the live customer API contract, writing the backend and frontend application code, tests, and this documentation, and iteratively running the real test suite (unit, e2e against a real database, and manual smoke tests against the live customer API and both dev servers running together) to verify behavior rather than assuming it.
