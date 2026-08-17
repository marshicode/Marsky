# Marsky — Product Requirements Document

**Name:** Marsky
**Tagline:** *One list, two people, zero nagging.*
**Status:** Draft v1
**Platform:** Web app (responsive), mobile app as a later phase

---

## 1. Concept

Marsky is a zero-friction reminder app for two people that turns "one of us needs to
remember this" into "both of us will." You pair with a partner in seconds via a magic
link or 6-character code — no accounts, no setup — and land on a single shared list
where either of you can add, edit, or delete notes. Set a time on any item and it pings
*both* phones/browsers, not one. When the reminder fires, each of you taps "done?",
and you can see what the other answered — turning a nag into a gentle mutual check-in.
Every item tracks who added it and who completed it, so at a glance you both see where
the household, project, or plan actually stands. No folders, no projects, no settings:
one list, two people, shared responsibility.

---

## 2. Problem

Today, coordination between two people relies on one of these broken tools:

- **Personal reminder apps** (Apple Reminders, Google Keep, Todoist) technically allow
  sharing, but they are built around an *individual's* list that happens to be shared.
  One person is the owner; the other is a guest. There is no sense of mutual
  responsibility — "our" list — and reminders still fire at one person's device.
- **Messaging apps** are where most pairs actually coordinate, but "remember to pay
  rent" scrolls away and dies in the chat. There is no structure, no completion, no
  shared state.
- **Power tools** (Trello, Asana, Notion) solve this but require accounts, projects,
  and configuration — absurd overhead for two people who just need to not forget the
  trash.

The emotional core: **you care more about not letting a partner down than about not
letting yourself down.** Existing tools ignore this. Marsky is designed around it.

---

## 3. Target users

Marsky's audience is deliberately broad — *any two people who share life logistics* —
with a clear set of primary segments:

| Segment | Example usage |
|---|---|
| **Students** | Shared deadlines, assignment check-ins, coordinating study sessions |
| **Roommates** | Splitting chores, rent/bills reminders, shared supplies ("we're out of detergent") |
| **Friends** | Planning trips/events, "text me when you land", shared to-dos for a group project of two |
| **Parents / household partners** | Tag-teaming kid logistics, school forms, groceries, appointments |

**Design principle:** Marsky is built for the *pair*, not the individual. Both members
are first-class equals — there is no owner and no guest. The product should feel like
it belongs to both people equally.

**Wedge and growth:** although the audience is broad, the zero-friction pairing means
viral growth by construction — one user creates a pair, shares the link, and the
partner is in within seconds. Every new pair is two new users acquired for the price
of one.

---

## 4. Platform

**Phase 1 (this PRD): responsive web app.**

- Works great on mobile browsers (primary usage will be on phones).
- Share link opens directly in the partner's browser — no install required, which is
  exactly the "zero friction" promise.
- Installable as a PWA (manifest + service worker + home-screen icon) so the pair can
  pin Marsky like an app, enabling background reminders on mobile.
- Web Notifications API for reminder pings.

**Phase 2 (future):** native mobile apps (or a beefed-up PWA) for more reliable
notification delivery, widgets, and offline-first sync.

---

## 5. Differentiation

Marsky's hook, versus every shared list that already exists:

1. **Zero-friction pairing.** A magic link / 6-character code. No account creation, no
   email verification, no invites-and-acceptance dance. Partner is in the list in
   under 10 seconds.
2. **Reminders that fire at two people, not one.** The core mechanic no personal
   reminder app has: set one time, both get pinged.
3. **Mutual "done?" check-ins.** When the reminder fires, both partners answer. Seeing
   "Maya already said done ✅" or "Alex said not yet 😅" is the product's magic moment —
   accountability without nagging.
4. **Who-did-what visibility.** Every item shows who added it and who completed it,
   backed by a simple activity history. The list answers "is this handled?" at a
   glance.

**Positioning sentence:** "Marsky is the reminder app for two — pair in seconds, set
one time, and neither of you can pretend you forgot."

---

## 6. Key features

### 6.1 Core (must-have for MVP)

| # | Feature | Description |
|---|---|---|
| F1 | **Magic-link pairing** | Create a pair → get a 6-character code + shareable link. Partner opens link, enters their name, and both are in the same list. Max 2 members per pair. |
| F2 | **One shared list** | A single flat list of notes shared by the pair. Both members can add, edit, and delete any item. Changes sync live to both. |
| F3 | **Notes with text** | Quick-add note with a 200-char title (plus optional longer note field). |
| F4 | **Mutual reminders** | Optional due date/time per item. At the due moment, **both** members get a notification ("⏰ 'Pay rent' — done?"). |
| F5 | **"Done?" check-ins** | When a reminder fires, each member responds Done / Not yet. Both members see each other's responses live. If both answer Done, the item auto-completes. |
| F6 | **Complete / who-did-what** | Any member can tick an item complete. Completed items show who completed them and when. Items show who created them. |
| F7 | **Activity history** | A chronological log of the pair's actions: added, completed, commented, rescheduled, etc. |

### 6.2 Extended (nice-to-have, included in this vision)

| # | Feature | Description |
|---|---|---|
| F8 | **Recurring tasks** | Daily or weekly repetition (e.g., "trash every Tuesday"). Completing one instance auto-schedules the next at the same time. |
| F9 | **Comments on items** | A lightweight inline thread per item ("got it — doing it tonight"). |
| F10 | **Attachments & links** | Attach a URL or a small file (photo of receipt/form) to an item. |
| F11 | **Labels & colors** | Lightweight categorization: Chores, Plans, Meals, Health, Study, Family — rendered as colored chips. |
| F12 | **Pinned quick access** | Star important items; they appear in a persistent strip above the list so the pair sees them without scrolling. |
| F13 | **Snooze** | From a check-in or reminder, snooze an item (e.g., +30 min) instead of leaving it hanging. |
| F14 | **Browser notifications** | Opt-in web notifications on top of in-app toasts. |

### 6.3 Explicitly out of scope (this version)

- **Location triggers** ("remind when you arrive home") — deliberately excluded from
  this version; candidate for Phase 2.
- Multi-pair management (multiple lists, folders, projects) — Marsky stays a
  single-list product; more than one pair is possible later, but each pair keeps its
  own single list.
- More than 2 members per pair — the product is *for two*. Groups are a different
  product.

---

## 7. Priority summary

| Priority | Features |
|---|---|
| **P0 — launch** | F1, F2, F3, F4, F5, F6, F7 |
| **P1 — soon after** | F8, F9, F13, F14 |
| **P2 — polish** | F10, F11, F12 |
| **Phase 2** | Mobile apps, location triggers, widgets |

---

## 8. User flows

### 8.1 Onboarding & pairing (the critical moment)
1. User opens Marsky → hero screen: "Create a pair" / "Join with a code."
2. **Create:** enter your name (+ optional pair name) → pair code `M3R5KY` is generated
   and shown large, with Copy and Share-link buttons.
3. **Join:** partner opens the shared link (or types the code), enters their name →
   lands directly in the shared list as member 2.
4. Success screen in the creator's app confirms "Maya joined!" Both are now equals on
   one list.
5. **Failure states:** wrong/expired code → friendly error; pair already full → message
   explaining the pair is for two.

### 8.2 Daily use
1. Either member quick-adds a note; optionally sets a due time, repeat, label, note,
   or attachment.
2. Item appears instantly on both devices, tagged with who added it.
3. Either member can edit, delete, comment, pin, or tick it off. All changes sync live.

### 8.3 The reminder → check-in loop (the magic moment)
1. Due time arrives → both members get notified: "⏰ 'Pay rent' — done?"
2. A check-in modal opens with two buttons: **Done ✅** / **Not yet**.
3. Each member answers once; both see each other's status live
   ("Waiting for Maya…" → "Maya said done ✅").
4. **Both Done** → item completes, celebratory toast, history logged.
5. **Anyone says Not yet** → item stays open; either member can snooze (+30 min),
   which re-arms the reminder.
6. Completing a recurring item auto-schedules the next occurrence and logs it.

---

## 9. Data model (draft)

```
User      { id, name, color }
Pair      { code, name, createdAt,
            members: [ User × 2 ],
            items: [ Item ],
            history: [ HistoryEntry ] }
Item      { id, text, note,
            createdBy, createdAt,
            dueAt?, recurring? ('daily'|'weekly'),
            completed, completedBy?, completedAt?,
            labels: [id], pinned,
            attachments: [{ id, name, url }],
            comments: [{ id, authorId, text, at }],
            checkin? { firedAt, responses: { userId: 'yes'|'no' } } }
HistoryEntry { id, at, actorId, verb, detail }
```

Design notes:
- **A pair has exactly one list.** No nesting, no projects.
- **Both members are equal** in the data model — no owner field.
- **Check-in state lives on the item**, so either device can render and answer it.

---

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| **Sync** | Live two-way sync between the pair's devices; changes from either member appear on the other's device without refresh (< ~1s in Phase 1 via realtime connection; optimistic UI). |
| **Notifications** | Reminders delivered to both members. Web Notifications (opt-in) plus in-app toasts. Reliable delivery is the #1 quality bar — a missed reminder kills the product. |
| **Latency** | List load < 1s on a typical mobile connection. |
| **Simplicity** | No settings screen, no accounts, no onboarding tour. A new user should go from zero to a shared list with a due reminder in under 60 seconds. |
| **Privacy** | A pair's list is private to the pair. Codes are unguessable; access via link only. |
| **Accessibility** | Keyboard-operable, readable contrast, works with screen readers. |
| **Responsive** | Usable one-handed on phones; comfortable on desktop. |

---

## 11. Success metrics

- **Activation:** % of new users who create/join a pair and add ≥1 note within 24h
  (target: >60%).
- **Retention:** % of pairs with ≥1 item completed per week at week 4 (target: >40%).
- **The magic moment:** % of fired reminders that get both check-in responses
  (target: >50%) and % of items completed via mutual check-in.
- **Viral coefficient:** pairs created per new user (each pair = 2 users).
- **NPS / sentiment:** "Did Marsky save you from a fight?"-style qualitative check-ins.

---

## 12. Open questions / assumptions

1. **Realtime backend vs. P2P Phase 1?** The web prototype can demo two-user sync via
   browser tab sync; production needs a small realtime backend (or a managed service).
   Assumption: backend is acceptable at Phase 1 scale.
2. **Names vs. anonymous pairing?** Assumed both members enter a name (needed for
   who-did-what). Alternative: phone-contact-based identity in Phase 2.
3. **Notification reliability on the web** is weaker than native. Assumption: PWA +
   web notifications are good enough for Phase 1; native apps (or push via service
   worker) in Phase 2.
4. **Is "edit" on the partner's items ever a concern?** Per the user's direction, both
   members can edit/delete everything — equality is a feature, not a bug.
5. **Recurring semantics:** daily/weekly only for now; monthly and custom schedules are
   Phase 2 candidates.

---

## 13. Phase 2 roadmap (candidates)

- Native mobile apps for reliable push notifications + home-screen widgets.
- Location-based triggers ("remind when you're both home") — the one feature
  deliberately excluded from this version.
- Multiple pairs per user (each still a single list).
- Monthly/custom recurrence, smart snoozing, and gentle "nudge your partner" prompts.
- Onboarding polish: voice/photo note capture.

---

*Marsky — one list, two people, zero nagging.*
