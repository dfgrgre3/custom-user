# Customer User Sync — Frontend

Next.js (App Router, TypeScript, Tailwind CSS v4) UI for the [backend](../README.md) in the parent directory. Talks to it only over HTTP — no shared code, no server-side coupling.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_BASE_URL              the backend's base URL, if not the default dev port
#   NEXT_PUBLIC_SUPABASE_URL              your Supabase project URL
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  Supabase publishable/anon key (safe for the browser)
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
├── components/           Shared UI: NavTabs, UserStatusBadge/SyncStatusBadge, SyncButton, Pager
└── lib/
    ├── api.ts             The only file that knows the backend's routes/shapes
    ├── types.ts           Shared TypeScript types mirroring the backend's response DTOs
    └── supabase.ts        Direct browser-side Supabase client (publishable/anon key only)
```

## Data flow

All synchronized-user data (users, sync runs, triggering a sync) goes through the NestJS backend over HTTP — never directly to Supabase. `src/lib/supabase.ts` exists separately for features that talk to Supabase directly from the browser (e.g. Supabase Auth); it's safe to expose `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` publicly since access is governed by Row Level Security on the Supabase project, not by keeping the key secret. The backend alone holds the service role key, which bypasses RLS and must never reach the browser.

## Design

White background with an indigo accent (`--accent: #4f46e5`), Inter for UI text and JetBrains Mono for ids/monospace data. Tokens are defined in `src/app/globals.css`.

## Commands

```bash
npm run dev     # dev server (see package.json for the configured port)
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```
