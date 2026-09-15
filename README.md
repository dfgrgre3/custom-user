# Customer User Synchronization Service

A backend service that synchronizes users from an external customer API into a Supabase (PostgreSQL) database and exposes them through a versioned REST API, with a Next.js UI for browsing, filtering, and triggering synchronization.

Two independent projects: this directory is the **backend** (NestJS); [`frontend/`](frontend/) is a separate **Next.js** app that talks to it over HTTP.

Built for the Junior FDE technical assessment. See [DESIGN.md](DESIGN.md) for architecture, trade-offs, and how ambiguous requirements were interpreted.

## Quick start

```bash
npm install               # backend deps
npm run frontend:install  # frontend deps (frontend/node_modules)

cp .env.example .env                              # backend config
cp frontend/.env.local.example frontend/.env.local  # frontend config
# Edit .env: set SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
# from your Supabase project (Project Settings > API), and CUSTOMER_API_TOKEN
# to the admin token for the customer API.
# Edit frontend/.env.local: set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# (same project, publishable/anon key only).

SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" npm run supabase:schema
# ^ applies supabase/schema.sql (tables + the sync_users function) to your project.
# Get this connection string from Project Settings > Database > Connection string.

npm run dev:all   # runs backend (:3000) and frontend (:3001) together
```

- UI: the frontend dev server's printed URL (see `frontend/package.json` for its configured port)
- Backend API: the backend dev server's printed URL (see `PORT` in `.env`)
- Swagger/OpenAPI docs: `<backend URL>/api/docs`

Run them separately instead of `dev:all` with `npm run start:dev` (backend) and `npm run frontend:dev` (frontend) in two terminals.

Or run the backend in Docker as a self-contained production build, pointed at your Supabase project via environment variables (the frontend runs separately via `npm run frontend:dev`, since it is not containerized here). The image has no bind mount and no local database — it only needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `CUSTOMER_*` variables set in your shell or a `.env` file read by Docker Compose:

```bash
docker compose up --build
```

## Configuration

All configuration is environment variables (`.env`, see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — server-side only, bypasses RLS, never expose to a client |
| `SUPABASE_DB_URL` | Direct Postgres connection string, used only by `npm run supabase:schema` |
| `CUSTOMER_API_BASE_URL` | Base URL of the customer's API (default: the assessment API) |
| `CUSTOMER_API_TOKEN` | Admin token for the customer API — **required**, never committed |
| `CUSTOMER_NAME` | Display name for the `Customer` row created on first sync |
| `CUSTOMER_API_TIMEOUT_MS` / `CUSTOMER_API_MAX_RETRIES` / `CUSTOMER_API_PAGE_SIZE` | HTTP client tuning |
| `SYNC_CRON` | Optional cron expression for automatic sync (e.g. `*/15 * * * *`). Empty = disabled. |

## Endpoints

### `POST /sync/users`

Triggers a synchronization run. Safe to call repeatedly (idempotent). Optionally accepts `{ "customerId": "..." }` in the body; defaults to the configured customer.

Returns `200` even when the sync fails, with `status: "FAILED"` and an `errorCode`/`errorMessage` — a failed sync is a normal, expected outcome, not a server error. A concurrent call to a customer that's already syncing returns `409 Conflict`.

```bash
curl -X POST <backend URL>/sync/users
```

```json
{
  "syncRunId": "…",
  "status": "SUCCESS",
  "startedAt": "2026-09-15T01:00:00.000Z",
  "completedAt": "2026-09-15T01:00:02.000Z",
  "recordsFetched": 130,
  "recordsCreated": 12,
  "recordsUpdated": 3,
  "recordsDeleted": 1
}
```

### `GET /api/v1/users`

Reads from our own database only — never calls the customer API. Supports:

| Query param | Meaning |
| --- | --- |
| `company` | Case-insensitive substring match on company name |
| `search` | Case-insensitive match against name, email, external id, company, industry, role, or website |
| `status` | `active` \| `invited` \| `suspended` |
| `includeDeleted` | Include users no longer present in the customer's dataset (default: `false`) |
| `page`, `limit` | Pagination (`limit` max 100, default 20) |

```bash
curl "<backend URL>/api/v1/users?company=Acme&page=1&limit=20"
```

### `GET /api/v1/users/:id`

Returns one synchronized user by internal id. `404` if no user has that id; `400` if the id isn't a valid UUID.

### `GET /api/v1/sync/runs`

Paginated operational history of every `POST /sync/users` call, most recent first — status, duration, and record counts for each run.

```bash
curl "<backend URL>/api/v1/sync/runs?page=1&limit=20"
```

Full interactive documentation (request/response schemas) is at `/api/docs`.

## UI

A separate Next.js app in [`frontend/`](frontend/) (App Router, TypeScript, Tailwind CSS v4), with three pages:

| Route | Purpose |
| --- | --- |
| `/` | Users list — filter by company/search/status, toggle deleted users, paginate, trigger a sync |
| `/users/[id]` | User detail — account, company, and synchronization info for one user |
| `/sync-history` | Every synchronization run, most recent first, with status/duration/record counts |

It talks to our own API (`GET /api/v1/users`, `GET /api/v1/users/:id`, `GET /api/v1/sync/runs`, `POST /sync/users`) for all synchronized-user data — never the customer API directly. The backend URL is configured via `NEXT_PUBLIC_API_BASE_URL` (see `frontend/.env.local.example`).

The frontend also has a direct browser-side Supabase client (`frontend/src/lib/supabase.ts`), initialized with `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key — for features that talk to Supabase directly (e.g. Supabase Auth) rather than through the backend. It is safe to expose these values to the browser: access is governed by Row Level Security policies on the Supabase project, not by keeping the key secret.

## Database

Supabase (hosted PostgreSQL), accessed via `@supabase/supabase-js` with the service role key. Schema lives in `supabase/schema.sql` — tables (`customers`, `users`, `sync_runs`) plus a `sync_users(customer_id, users)` Postgres function that performs the upsert + soft-delete pass atomically, since the Supabase JS client has no client-side multi-statement transaction API.

```bash
npm run supabase:schema   # applies supabase/schema.sql (requires SUPABASE_DB_URL)
```

Re-run it whenever `supabase/schema.sql` changes. You can also paste the file into the Supabase SQL Editor directly.

Tables: `customers`, `users` (synchronized users, scoped per customer), `sync_runs` (operational history of each sync attempt).

## Testing

```bash
npm test        # unit tests (mapper, HTTP client retry/error handling, sync orchestration, users service)
npm run test:e2e   # integration tests against your real Supabase database, customer API client mocked
```

The e2e suite exercises the full idempotency/deletion/reactivation/failure-safety story end to end: sync twice with the same data (no duplicates), remove a user from the fetched set (soft-deleted), bring it back (reactivated, not duplicated), and simulate a customer API outage (previously synced data is untouched). It reads/writes the Supabase project configured in `.env`, so run it against a dev project, not production.

## Project structure

```text
src/                             Backend (NestJS)
├── common/errors/                Shared error types (SyncInProgressError, error-code union)
├── config/                       Centralized environment configuration
├── domain/types.ts                Domain types + row-mapping for the database layer
├── infrastructure/database/      Supabase client lifecycle
├── integrations/customer-api/    Isolated external API client, types, mapper, errors
├── modules/
│   ├── customers/                Customer identity (one row per customer)
│   ├── sync/                     Sync orchestration, controllers (POST /sync/users, GET .../sync/runs), scheduler
│   └── users/                    Read API: repository, service, controller, DTOs
├── app.module.ts
└── main.ts
supabase/schema.sql               Database schema + sync_users() function
scripts/apply-supabase-schema.js  Applies supabase/schema.sql to your Supabase project

frontend/                        UI (Next.js, separate app — see frontend/README.md)
├── src/app/
│   ├── page.tsx                  Users list ("/")
│   ├── users/[id]/page.tsx       User detail
│   └── sync-history/page.tsx     Sync history
├── src/components/                Shared UI: nav tabs, status badges, sync button, pager
└── src/lib/
    ├── api.ts                     Backend API client and shared types
    └── supabase.ts                Direct browser-side Supabase client (anon key)
```

## Design decisions & assumptions

See [DESIGN.md](DESIGN.md) for the full write-up. In short:

- **Deletion** is detected by absence: a user previously synced but missing from the latest full fetch is soft-deleted (`deletedAt` set), not hard-deleted, and reactivated if it reappears. The customer API itself has no "deleted" flag — this is our own interpretation of "the customer may have users that have been deleted."
- **Duplicate prevention**: `(customerId, externalUserId)` is a unique constraint; sync always upserts on it.
- **Failure safety**: the entire external dataset is fetched and validated before any database write. The upsert + soft-delete pass runs inside a single Postgres function (`sync_users`, see `supabase/schema.sql`) invoked via one `.rpc()` call, so it stays atomic even though the Supabase JS client has no client-side multi-statement transaction API — a partial failure never leaves half-applied changes, and a fetch failure never touches previously synced data.
- **Schema independence**: `src/integrations/customer-api/` is the only place that knows the customer API's shape (`ExternalUser`). A mapper translates it into our own `User` model, and a separate `UserResponseDto` shapes the public API response — three independent representations, as required.
- **Multi-customer ready**: every user and sync run is scoped by `customerId`; adding a second customer is a data change (`Customer` row + its own `apiBaseUrl`/token), not a code change.

## AI usage

This project was built with Claude (Anthropic), used as a pair-programmer for the full implementation: verifying the live customer API contract (auth scheme, response shape, pagination) via direct HTTP calls, writing the NestJS/Supabase backend code, the sync/idempotency/failure-safety logic, the test suite (unit + e2e against a real database), the Next.js frontend, and this documentation. All generated code was reviewed, run, and verified against the real customer API, a real Supabase database, and both servers running together before being included.
