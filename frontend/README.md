# Customer User Sync — Frontend

Next.js (App Router, TypeScript, Tailwind CSS v4) UI for the [backend](../README.md) in the parent directory. Talks to it only over HTTP — no shared code, no server-side coupling.

## Setup

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_BASE_URL if the backend isn't on localhost:3000
npm run dev                        # http://localhost:3001
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
    └── types.ts           Shared TypeScript types mirroring the backend's response DTOs
```

## Design

White background with an indigo accent (`--accent: #4f46e5`), Inter for UI text and JetBrains Mono for ids/monospace data. Tokens are defined in `src/app/globals.css`.

## Commands

```bash
npm run dev     # dev server on :3001
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```
