# Customer User Sync — Frontend

Next.js (App Router, TypeScript, Tailwind CSS v4) UI for the [backend](../README.md) in the parent directory. Talks to it only over HTTP — no shared code, no server-side coupling.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_BASE_URL if the backend isn't on its default dev port
npm run dev                        # starts the dev server (see the printed URL)
```

The backend must be running separately (`npm run start:dev` in the parent directory), or use `npm run dev:all` from the parent directory to start both at once.

## Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Users list: filter by company/search/status, toggle deleted users, paginate, trigger a sync |
| `/users/[id]` | `src/app/users/[id]/page.tsx` | One user's account, company, and synchronization details |
| `/sync-history` | `src/app/sync-history/page.tsx` | Every sync run, most recent first, with status/duration/record counts |

## Structure

```text
src/
├── app/                  Pages (see table above) + layout.tsx (shared header/nav) + globals.css (design tokens)
├── components/           Shared UI: NavTabs, UserStatusBadge/SyncStatusBadge, SyncButton, Pager, SystemStatus
└── lib/
    ├── api.ts             The only file that knows the backend's routes/shapes
    └── types.ts           Shared TypeScript types mirroring the backend's response DTOs
```

## Data flow

Everything — synchronized-user data, sync runs, triggering a sync, and system health — goes through the NestJS backend over HTTP. This app holds no database credentials of its own and never talks to Supabase directly; `NEXT_PUBLIC_API_BASE_URL` is its only required configuration. The header's `SystemStatus` component polls the backend's `GET /health` every 30s, which itself makes real checks against Supabase and the customer API — the indicator reflects genuine dependency health, not a hardcoded label.

## Design

White background with an indigo accent (`--accent: #4f46e5`), Inter for UI text and JetBrains Mono for ids/monospace data. Tokens are defined in `src/app/globals.css`.

## Commands

```bash
npm run dev     # dev server (see package.json for the configured port)
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```
