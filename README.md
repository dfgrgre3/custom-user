# custom-user
=======
# Customer User Synchronization Service

A backend service that synchronizes users from an external customer API into our own PostgreSQL database and exposes them through a versioned REST API, with a Next.js UI for browsing, filtering, and triggering synchronization.

Two independent projects: this directory is the **backend** (NestJS); [`frontend/`](frontend/) is a separate **Next.js** app that talks to it over HTTP.

Built for the Junior FDE technical assessment. See [DESIGN.md](DESIGN.md) for architecture, trade-offs, and how ambiguous requirements were interpreted.

## Quick start

```bash
npm install               # backend deps
npm run frontend:install  # frontend deps (frontend/node_modules)

cp .env.example .env                              # backend config
cp frontend/.env.local.example frontend/.env.local  # frontend config
# Edit .env: set CUSTOMER_API_TOKEN to the admin token for the customer API.

docker compose up -d postgres   # starts PostgreSQL on localhost:55432
npx prisma migrate deploy       # applies the schema

npm run dev:all   # runs backend (:3000) and frontend (:3001) together
```

- UI: `http://localhost:3001`
- Backend API: `http://localhost:3000`
- Swagger/OpenAPI docs: `http://localhost:3000/api/docs`

Run them separately instead of `dev:all` with `npm run start:dev` (backend) and `npm run frontend:dev` (frontend) in two terminals.

Or run the backend + database in Docker (the frontend runs separately via `npm run frontend:dev`, since it is not containerized here):

```bash
docker compose up --build
```

## Configuration

All configuration is environment variables (`.env`, see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
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
curl -X POST http://localhost:3000/sync/users
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
curl "http://localhost:3000/api/v1/users?company=Acme&page=1&limit=20"
```

### `GET /api/v1/users/:id`

Returns one synchronized user by internal id. `404` if no user has that id; `400` if the id isn't a valid UUID.

### `GET /api/v1/sync/runs`

Paginated operational history of every `POST /sync/users` call, most recent first — status, duration, and record counts for each run.

```bash
curl "http://localhost:3000/api/v1/sync/runs?page=1&limit=20"
```

Full interactive documentation (request/response schemas) is at `/api/docs`.

## UI

A separate Next.js app in [`frontend/`](frontend/) (App Router, TypeScript, Tailwind CSS v4), with three pages:

| Route | Purpose |
| --- | --- |
| `/` | Users list — filter by company/search/status, toggle deleted users, paginate, trigger a sync |
| `/users/[id]` | User detail — account, company, and synchronization info for one user |
| `/sync-history` | Every synchronization run, most recent first, with status/duration/record counts |

It only talks to our own API (`GET /api/v1/users`, `GET /api/v1/users/:id`, `GET /api/v1/sync/runs`, `POST /sync/users`) — never the customer API directly. The backend URL is configured via `NEXT_PUBLIC_API_BASE_URL` (see `frontend/.env.local.example`).

## Database

PostgreSQL via Prisma. Schema and migrations live in `prisma/`.

```bash
npx prisma migrate dev      # create/apply a migration in development
npx prisma migrate deploy   # apply migrations (production/CI)
npx prisma studio           # browse data
```

Models: `Customer`, `User` (synchronized users, scoped per customer), `SyncRun` (operational history of each sync attempt).

## Testing

```bash
npm test        # unit tests (mapper, HTTP client retry/error handling, sync orchestration, users service)
npm run test:e2e   # integration tests against a real Postgres database, customer API client mocked
```

The e2e suite exercises the full idempotency/deletion/reactivation/failure-safety story end to end: sync twice with the same data (no duplicates), remove a user from the fetched set (soft-deleted), bring it back (reactivated, not duplicated), and simulate a customer API outage (previously synced data is untouched).

## Project structure

```text
src/                             Backend (NestJS)
├── common/errors/                Shared error types (SyncInProgressError, error-code union)
├── config/                       Centralized environment configuration
├── infrastructure/database/      Prisma lifecycle
├── integrations/customer-api/    Isolated external API client, types, mapper, errors
├── modules/
│   ├── customers/                Customer identity (one row per customer)
│   ├── sync/                     Sync orchestration, controllers (POST /sync/users, GET .../sync/runs), scheduler
│   └── users/                    Read API: repository, service, controller, DTOs
├── app.module.ts
└── main.ts
prisma/schema.prisma             Database schema

frontend/                        UI (Next.js, separate app — see frontend/README.md)
├── src/app/
│   ├── page.tsx                  Users list ("/")
│   ├── users/[id]/page.tsx       User detail
│   └── sync-history/page.tsx     Sync history
├── src/components/                Shared UI: nav tabs, status badges, sync button, pager
└── src/lib/                       API client and shared types
```

## Design decisions & assumptions

See [DESIGN.md](DESIGN.md) for the full write-up. In short:

- **Deletion** is detected by absence: a user previously synced but missing from the latest full fetch is soft-deleted (`deletedAt` set), not hard-deleted, and reactivated if it reappears. The customer API itself has no "deleted" flag — this is our own interpretation of "the customer may have users that have been deleted."
- **Duplicate prevention**: `(customerId, externalUserId)` is a unique constraint; sync always upserts on it.
- **Failure safety**: the entire external dataset is fetched and validated before any database write. A transaction wraps all upserts, deletions, and the sync-run outcome — a partial failure never leaves half-applied changes, and a fetch failure never touches previously synced data.
- **Schema independence**: `src/integrations/customer-api/` is the only place that knows the customer API's shape (`ExternalUser`). A mapper translates it into our own `User` model, and a separate `UserResponseDto` shapes the public API response — three independent representations, as required.
- **Multi-customer ready**: every user and sync run is scoped by `customerId`; adding a second customer is a data change (`Customer` row + its own `apiBaseUrl`/token), not a code change.

## AI usage

This project was built with Claude (Anthropic), used as a pair-programmer for the full implementation: verifying the live customer API contract (auth scheme, response shape, pagination) via direct HTTP calls, writing the NestJS/Prisma backend code, the sync/idempotency/failure-safety logic, the test suite (unit + e2e against a real database), the Next.js frontend, and this documentation. All generated code was reviewed, run, and verified against the real customer API, a real PostgreSQL database, and both servers running together before being included.
>>>>>>> d0e06c9 (push)
