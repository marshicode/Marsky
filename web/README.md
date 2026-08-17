# Marsky (web)

The Marsky app — *one list, two people, zero nagging.*

A shared reminder list for two: pair in seconds via a magic link, add notes, set a
time, and it reminds **both** of you. Local-first with a Supabase backend layer per
[`../ARCHITECTURE.md`](../ARCHITECTURE.md) — when the DB is configured the pair
stays live across devices via Postgres realtime; otherwise it degrades to
localStorage + tab sync (two tabs = the two partners).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Supabase (anonymous auth, Postgres + RLS, Realtime) · lucide-react ·
design tokens from [`../DESIGN.md`](../DESIGN.md) ("Warm Mars").

## Run it

```bash
npm install        # first time
cp .env.example .env.local   # add your Supabase URL + publishable key
npm run dev        # http://localhost:3000
```

To enable Supabase mode, apply `supabase/migrations/0001_initial.sql` in the
Supabase SQL editor and enable **Authentication > Providers > "Allow anonymous
sign-ins"**. Without those, the app runs local-only (one warning in the console).

Other scripts:

```bash
npm run build      # production build (type-checks)
npm start          # serve the production build
npm run lint       # eslint
```

## What's included

| Piece | Location |
|---|---|
| Design tokens (light + dark) + Tailwind theme | `app/globals.css` |
| Root layout: Nunito font, metadata, dark/bootstrap + DB bootstraps | `app/layout.tsx` |
| PWA manifest (brand colors) | `app/manifest.ts` |
| Favicon (Marsky mark) | `app/icon.svg` |
| Landing / onboarding (create + join) | `app/page.tsx` |
| Pair list: reminders, check-ins, history, labels, comments, pin | `app/app/page.tsx` |
| Magic-link join page | `app/join/[code]/page.tsx` |
| Pair store: local adapter + Supabase sync layer (same API) | `lib/pair-store.ts` |
| Supabase client: anon auth, RLS-safe reads/writes, realtime | `lib/db.ts` |
| Data model (PRD §9) + formatting helpers | `lib/types.ts`, `lib/format.ts` |
| Components (DESIGN.md §6) | `components/*` |
| Database schema + RLS + join RPC | `supabase/migrations/0001_initial.sql` |
| Env var names (placeholders) | `.env.example` |

## Notes

- Dark mode follows the OS (`prefers-color-scheme`) — no manual toggle, per
  DESIGN.md §7.
- Colors: use the token utilities (`bg-brand`, `text-ink-soft`, `border-line`, …) —
  they flip automatically in dark mode.
- Supabase mode is optimistic: mutations apply locally + broadcast instantly,
  then sync to the DB in the background; the DB copy is authoritative and
  realtime refreshes keep both devices converged. Anonymous sign-in failures
  (schema missing / anonymous disabled) degrade to local-only for the session.
- Known prototype limits: check-in responses are written as a full jsonb row
  (a last-write-wins race between two devices answering at the same instant),
  and the dev "Simulate partner" member is local-only (it isn't a real auth
  user). Server-side reminder firing needs the pg_cron path from the migration.
