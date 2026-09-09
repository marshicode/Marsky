# Marsky — Technical Architecture

**Product:** Marsky — *one list, two people, zero nagging.*
**Docs:** [PRD.md](prd.md) (what we build) · [DESIGN.md](DESIGN.md) (how it looks)
**Status:** v1 recommendation · researched August 2026

---

## 1. Stack at a glance

| Layer | Choice | Why (short) |
|---|---|---|
| Frontend | **Next.js (App Router, TypeScript)** | PWA-first, installable, official web-push path, SSR for shareable pair links |
| Realtime sync | **Supabase Realtime** | Postgres changes + RLS-authorized broadcast/presence; <1s sync target |
| Backend logic | **Next.js Route Handlers** (thin) | Only custom logic lives here: web push send, pair join, scheduling |
| Database | **PostgreSQL (Supabase)** | Relational, RLS, history queries; flat $25/mo pricing scales |
| Auth | **Supabase Auth — anonymous sign-ins** | Zero-friction pairing with no accounts (PRD F1) |
| Files (attachments F10) | **Supabase Storage** | Pair-scoped buckets with RLS |
| Push notifications | **VAPID + `web-push` lib** | Standard W3C Web Push; FCM not required |
| Hosting | **Vercel** (app) + **Supabase Cloud** (data) | Zero-config deploy, previews per PR, managed Postgres |
| Mobile (Phase 2) | React Native/Expo reusing the Supabase backend | One backend serves web + native; TS types shared |

---

## 2. Frontend: Next.js — justification

**Decision:** Next.js with App Router, TypeScript, Tailwind v4 (mapped to DESIGN.md tokens), on Vercel.

Why Next.js over the alternatives:

- **PWA is a first-class, officially documented path.** Next.js publishes a dedicated
  PWA guide: `app/manifest.ts` for installability, first-party service-worker +
  `PushManager` + VAPID pattern, and it works on iOS 16.4+ for home-screen-installed
  apps. That's exactly PRD Phase 1 (responsive web → installable PWA → push).
- **Shareable URLs with instant context.** The core growth mechanic (F1) is a magic
  link: `marsky.app/join/M3R5KY`. With Next.js, the landing/onboarding and join page
  are server-rendered — the link opens fast even on first visit (cold cache), which a
  Vite SPA cannot offer without adding an SSR layer anyway.
- **One codebase, one deploy.** Route Handlers (API routes) mean the small amount of
  custom backend (web push, join validation) lives in the same repo/deploy as the
  frontend. No separate Node service to operate in Phase 1.
- **Ecosystem and hiring:** React is the dominant web ecosystem; the DESIGN.md
  component library maps 1:1 to React components.

Rejected alternatives:

- **React SPA + Vite:** lighter, but no SSR for join links, and we'd still need a
  server for push sending — Next.js collapses both into one deployable.
- **Flutter Web:** excellent for a shared UI with future native apps, but web is
  Flutter's weaker surface (SEO, link-sharing, text selection, PWA quirks), and it
  would abandon the HTML/CSS design system in DESIGN.md. If the team were Flutter-only
  and native-first, it would be the call — but PRD Phase 1 is web-first.
- **SvelteKit:** viable and lighter, but smaller ecosystem for PWA/push patterns and
  Supabase SSR helpers; no meaningful advantage here.

---

## 3. Backend: "Supabase-first, thin server layer"

Marsky's backend is deliberately minimal. The rule:

> **Anything the client can do safely with RLS, the client does directly. Only
> non-database, non-RLS-able work goes through Next.js Route Handlers.**

| Concern | Owner |
|---|---|
| CRUD on items, comments, labels, completion, history | Client → Supabase (RLS-enforced) |
| Realtime updates (list sync, check-ins, presence) | Supabase Realtime (RLS-authorized) |
| Pair creation / join by code | Route Handler (enforce 2-member cap atomically, rate-limit) |
| Sending web push (VAPID) | Route Handler (`web-push` lib) — keys never reach the client |
| Reminder scheduling at scale | `pg_cron` in Postgres (DB-side, survives clients being offline) |
| Attachment files | Supabase Storage (RLS-scoped bucket) |

Why a thin layer and not a full custom backend:

- **Supabase Realtime (2026)** streams Postgres changes to subscribed clients via
  logical replication, and — since 2024 — supports **RLS-authorized Broadcast and
  Presence channels**. A pair-scoped channel (`pair:{code}`) can be created/joined only
  by the pair's members, giving us private, low-latency channels for check-in
  responses and "partner online" presence with zero custom sockets.
- Postgres lets RLS *be* the authorization layer: `anon`/`authenticated` roles only
  touch rows their pair membership permits. This is the standard, battle-tested
  Supabase pattern.
- Custom Node/Python/Go backends would re-implement auth, realtime, and storage that
  Supabase already provides — cost without benefit at Marsky's scale (2 members/pair).

**Realtime design (PRD §10: <1s sync):**

- **Durable state** (items, comments, history) → subscribe to **Postgres Changes** on
  the pair's rows. Missed while offline → refetch on reconnect.
- **Ephemeral state** (check-in responses, partner typing, presence) → **Broadcast /
  Presence** on `pair:{code}` with RLS auth. Broadcast is faster than DB round-trips
  and doesn't dirty the history log.
- **Optimistic UI:** mutations apply instantly locally, reconcile on the realtime
  event. Even if push/realtime lags, the UI never feels slow (PRD §10 latency bar).

**Reminder scheduling:** the moment-of-truth feature is *"remind both at time X"*.
Clients can't be trusted to fire it (tabs closed, phones asleep). Design:
1. Items store `due_at` in Postgres (single source of truth).
2. `pg_cron` job (every minute) finds `due_at <= now()` and not-yet-fired items →
   inserts a `reminders` row / flips `fired` flag → triggers the push send via an
   internal Route Handler call (or a Supabase Edge Function).
3. Push send: VAPID-signed request to each member's stored push subscription
   (the `web-push` lib implements the W3C protocol directly; FCM/GCM not required).
4. In-app: the realtime channel + in-page timer surfaces the check-in modal instantly.

This gives the PRD's "reminds *both*" semantics even when one member's browser is
closed — the #1 quality bar (PRD §10: "a missed reminder kills the product").

---

## 4. Database & auth

### Database: PostgreSQL (Supabase)

Schema sketch (maps to PRD §9):

```sql
-- Identity is anonymous-first (PRD F1: no accounts)
users        (id uuid pk, display_name text, color text,
              created_at timestamptz)

pairs        (code text pk /* e.g. M3R5KY */, name text,
              created_at timestamptz)
pair_members (pair_code text fk, user_id uuid fk,
              joined_at timestamptz, PRIMARY KEY(pair_code, user_id))

items        (id uuid pk, pair_code text fk, text text, note text,
              created_by uuid fk, created_at timestamptz,
              due_at timestamptz null, recurring text null /* daily|weekly */,
              completed bool default false, completed_by uuid null,
              completed_at timestamptz null,
              checkin jsonb null,   -- { fired_at, responses: {user_id: yes|no} }
              reminder_fired bool default false)

item_meta    (item_id uuid fk, kind text /* label|pin|attachment|comment */,
              payload jsonb, author_id uuid fk, created_at timestamptz)

history      (id bigserial, pair_code text fk, actor_id uuid fk,
              verb text, detail jsonb, at timestamptz)
-- indexed on pair_code + at; pruned to last ~500 rows per pair via pg_cron
```

Notes:
- **RLS policies** on every table: `pair_members` defines membership; every other
  policy checks the actor is a member of the row's `pair_code`. Realtime respects RLS
  on both Postgres Changes and Broadcast/Presence.
- **History is append-only and pruned** — bounds growth regardless of pair count.
- **Recurring rollover** (F8) is a small DB function (`complete_item(...)`) so both
  members and the scheduler share identical semantics.

### Auth: Supabase Auth — anonymous sign-ins

- On first open, the client signs in **anonymously** (`signInAnonymously`) — instant
  stable user ID, no email, no password. Exactly PRD F1 ("no accounts, no setup").
- **Create pair:** anon user creates a pair, becomes member 1, gets code + link.
- **Join pair:** entering a valid code adds the anon user as member 2
  (enforced atomically: 2-member cap inside a Route Handler / RPC).
- Optional upgrade later: link an email to the anon user if we ever want cross-device
  recovery — Supabase supports converting anonymous → permanent accounts.
- Rate limiting: Supabase's built-in auth rate limits plus a join-attempt limiter on
  the join RPC (codes are ~30 bits of entropy; brute-force needs the limiter).

### Storage (F10 attachments)

Pair-scoped bucket `pair-files`; RLS policy: only members of the pair may read/write
their pair's objects. Client-side size cap (~1–2 MB) + server-side content-type
allowlist for images/PDF/text.

---

## 5. Push notifications (VAPID + web-push)

- **Client:** service worker (Next.js official pattern) + `PushManager.subscribe` with
  the app's VAPID public key; subscription JSON stored in `users.push_subscriptions`.
- **Server:** `web-push` npm library — the reference VAPID implementation, sends
  directly to browser push services over the W3C protocol. **No FCM dependency.**
- **VAPID keys:** generated once (`npx web-push generate-vapid-keys`); public key is
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, **private key server-side only**.
- **Fallback chain:** push → service-worker notification (tab closed) · in-app toast +
  realtime (tab open) · in-page timer as last resort. A reminder fires exactly once;
  re-firing is keyed by `reminder_fired` in the DB.
- Rejected: **FCM for web** (vendor lock, extra SDK, no benefit over raw VAPID for
  our shape), **OneSignal** (overkill, third-party dependency for a core feature),
  **Safari APNs legacy** (VAPID is the standard now).

---

## 6. Hosting & deployment

| Piece | Host | Notes |
|---|---|---|
| Next.js app | **Vercel** | Zero-config; per-PR preview URLs; edge/ISR for landing; env for VAPID/Supabase |
| Postgres, Realtime, Auth, Storage | **Supabase Cloud** | Managed; region near users (US/EU); connect via connection pooling |
| Scheduled reminders | Supabase `pg_cron` + Edge/Route function | No separate cron infra |
| Domains/HTTPS | Vercel + custom domain | Web Push requires HTTPS (localhost exempt) |

**Deploy flow:** GitHub → Vercel (production branch + PR previews). Migrations via
Supabase CLI (`supabase db push`) in CI. Env values in Vercel + Supabase secrets —
never in the repo (per the project's run-doc convention).

---

## 7. Project structure & key libraries

```
marsky/
  app/
    page.tsx            # landing / onboarding (SSR)
    join/[code]/page.tsx# magic-link join (SSR)
    app/                # the pair list (client component)
    api/
      pair/route.ts     # create pair, join by code (2-cap, rate-limited)
      push/route.ts     # VAPID send (internal)
    manifest.ts         # PWA manifest (DESIGN.md colors, icons)
    lib/service-worker.ts  # push + notification click handling
  components/           # one file per DESIGN.md component
    button.tsx avatar.tsx item-card.tsx checkin-modal.tsx ... 
  lib/
    supabase/           # client + SSR clients (server/client split)
    realtime.ts         # channel + subscription helpers
    push.ts             # VAPID helpers
    types.ts            # shared types (also imported by mobile later)
  styles/               # DESIGN.md tokens as Tailwind v4 theme / CSS vars
  tests/                # Vitest + RTL unit, Playwright E2E
supabase/
  migrations/           # schema + RLS policies (versioned)
  functions/            # pg_cron reminder job + web-push edge fn (optional)
```

Key libraries (all current and mainstream in 2026):

| Library | Use |
|---|---|
| `@supabase/supabase-js` + `@supabase/ssr` | Data, auth, realtime, SSR cookie sessions |
| `web-push` | VAPID push sending (server only) |
| Tailwind v4 | DESIGN.md tokens as theme; components per styleguide |
| `date-fns` | Relative due times ("Today 18:30", "overdue 2h") |
| `zod` | Validate API inputs + realtime payloads |
| Zustand | Small client store for the pair list (realtime-fed) |
| `pg_cron` | Reminder sweep |
| Vitest + RTL, Playwright | Unit + E2E (two-browser pairing/sync test) |

---

## 8. Performance

- **Landing & join links:** SSR/edge-rendered, static where possible — a magic link
  must open fast on first visit (conversion-critical).
- **List load:** single indexed query on `pair_code`; <1s on mobile is trivial at this
  data size. Real fetch is only the first paint — Realtime keeps it live after.
- **Optimistic UI:** every mutation renders instantly, reconciles on realtime event.
- **Bundle discipline:** no heavy chart/editor libs (the product is one list); code
  splitting per route; the app shell is the only large chunk.
- **Push is the latency hedge:** even a cold-started client gets the reminder via the
  service worker, so perceived "reminder latency" ≈ push delivery, not app startup.

---

## 9. Security

- **RLS is the security boundary** — the anon key is public by design; every query and
  every realtime channel is authorized by pair membership, never by the app guessing.
- **Pair codes:** shareable secrets (like a room code). 6 chars from a 32-char
  unambiguous alphabet ≈ 30 bits of entropy; enforce join rate-limiting + exponential
  backoff so brute-force is impractical.
- **VAPID private key** server-side only; push payloads carry no sensitive data
  beyond item text + pair context.
- **Input hygiene:** `zod` validation on all API/RPC inputs; React's default escaping
  on render; attachments restricted by type + size; metadata stripped from images.
- **Headers/CSP:** strict Content-Security-Policy (service workers + push require it
  to be coherent); `X-Frame-Options`, referrer policy on join links.
- **Supabase hardening:** enable rate limiting, CAPTCHA on auth endpoints where
  applicable, 2FA/MFA for any admin access, audit logs.

---

## 10. Scalability

- **Unit of scale is the pair, and a pair is tiny** (≤2 users, one list, ≤~500 history
  rows). Millions of pairs = millions of small rows; Postgres is comfortably in its
  wheelhouse.
- **Realtime:** Supabase Realtime scales horizontally on their managed infra; per-pair
  channels isolate load. Broadcast/presence offloads the chatty ephemeral traffic from
  the DB.
- **Cost shape:** Supabase's flat $25/mo Pro (vs Firebase's per-operation billing)
  means chatty realtime ops and frequent small writes — Marsky's exact pattern — don't
  compound into surprise bills. Community math (2026): ~10K DAU / 10M reads-day runs
  roughly **$50–100/mo on Supabase vs $500–1,500/mo on Firebase**.
- **Headroom:** when (if) we exceed Supabase's ceiling, Postgres is portable — move to
  RDS/Neon + a realtime broker without rewriting the data layer. Firebase would lock
  us into Firestore semantics.

---

## 11. Why this stack over the alternatives

| Need (from PRD) | This stack | Alternative | Verdict |
|---|---|---|---|
| Zero-friction pairing, no accounts | Supabase **anonymous sign-ins** | Firebase anon auth (exists, weaker upgrade path) | Supabase wins on RLS + Postgres |
| <1s live two-way sync | Supabase Realtime (Postgres changes + RLS broadcast/presence) | Firebase RTDB (non-relational), PartyKit/Ably/Liveblocks (extra vendor, overkill for 2 users) | Supabase = one platform, DB + realtime together |
| History queries (F7) | PostgreSQL relational + indexes | Firestore (awkward range/join queries) | Postgres clearly better |
| Push to both, tab closed | VAPID + `web-push` (no vendor) | FCM (lock-in), OneSignal (third party) | Raw VAPID is standard and free |
| Installable PWA + deep links | Next.js official PWA + SSR | Vite SPA (no SSR), Flutter Web (weak link/SEO surface) | Next.js best web-first fit |
| Cost at scale | Supabase flat pricing | Firebase per-op compounding | Supabase wins (see §10) |
| Phase 2 native mobile | Same Supabase backend + Expo/RN; types shared | Flutter would force a second UI codebase anyway | Backend is frontend-agnostic by design |

**The one-line rationale:** Marsky is a tiny-data, realtime-heavy, link-driven product
for two — that combination is exactly what *Postgres + RLS + Realtime on Supabase, a
Next.js PWA on Vercel, and raw VAPID web push* are built for, at flat pricing that
matches the product's traffic shape.

---

## 12. Phase 2 path (mobile, per PRD §13)

- **Web stays the wedge** (zero install); PWA covers most "app-like" needs.
- **Native apps** (if we build them): React Native/Expo — same TypeScript types, same
  Supabase client + Realtime, same backend. Web push swaps to FCM/APNs via Expo
  Notifications; VAPID subscriptions remain for web users. Widgets (PRD §13) are
  native-only.
- **Location triggers** (the deliberately excluded F-#): PostGIS column on items +
  geofence logic in the reminder job; client permission gating.

---

## 13. Open questions / risks

1. **Notification reliability on iOS web** is the weakest link (push requires a
   home-screen-installed PWA, iOS 16.4+). Mitigation: prompt-to-install flow, in-app
   toasts, and a fast Phase 2 native path if retention data demands it.
2. **Anonymous identity loss** (cleared browser storage = lost membership). Mitigation:
   join-by-link re-pairing is cheap; optionally add email upgrade later.
3. **Supabase Realtime ceiling** is far above Marsky's needs, but if groups grow
   large (one realtime channel per active list is all we use), revisit channel
   topology.
4. **Code as secret** — list codes are bearer tokens; the 8-member cap (join RPC +
   RLS policy) + rate limiting must hold (covered in §9).

---

*Marsky — one list, two people, zero nagging.*
