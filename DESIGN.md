# Marsky — Design System ("Warm Mars")

**Product:** Marsky — *one list, two people, zero nagging.*
**Direction:** A — Warm Mars (cozy, friendly, human).
**Platform:** Responsive web (mobile-first), PWA.
**Status:** v1

---

## 1. Design principles

1. **For two, not for one.** Every screen should feel like it belongs to both people
   equally — no owner, no guest. Both members' avatars are always visible. Never show
   "your list," always "our list."
2. **Zero friction, visually.** The UI must look effortless: one obvious action per
   screen, no settings screens, no tours, no dead weight. A new user goes from landing
   page to a shared list with a due reminder in under 60 seconds.
3. **Warm, never childish.** Rounded and friendly, but adult — the warmth of a cozy
   kitchen, not a kids' app. Playful moments are reserved for *shared wins*
   (both check in "done" → a tiny celebration), which is the product's magic.
4. **Calm accountability.** Orange is the voice of the reminder — warm attention, not
   alarm. Red exists only for genuinely overdue items. Green exists only for done.
5. **One accent color.** Mars orange is the *only* hue that carries meaning beyond
   labels/semantics. If it's not orange, it's a warm neutral, a label color, or a
   semantic color.

---

## 2. The brand color (the star of the system)

One color, three working variants:

| Token | Hex | Use |
|---|---|---|
| **`--brand`** | `#F97316` | The color of Marsky: logo, focus rings, active/firing states, large display accents, dark-mode primary actions |
| **`--brand-light`** | `#FFB37A` | Lighter tint: hover fills on tinted surfaces, illustration gradients, glows behind the firing badge, pressed state on dark |
| **`--brand-soft`** | `#FFEDD5` | Tinted surface: chip backgrounds, banner backgrounds, selected states, avatar ring on light mode |
| **`--brand-dark`** | `#C2410C` | Deeper shade: pressed buttons on light, small text on tinted backgrounds, hover on white |

**Working rules:**

- **On light surfaces,** `--brand-dark` (#C2410C) is the *action* orange for text and
  small UI (AA contrast ~4.6:1). `--brand` (#F97316) is reserved for large text,
  illustration, focus rings, and UI *shapes* (buttons, badges) where 3:1+ suffices.
- **White text on `--brand`** is used on primary buttons (large, bold text — acceptable
  at AA-large); when in doubt, darken the button to `--brand-dark` for small text.
- **On dark surfaces,** `--brand` (#F97316) is the primary action and `--brand-light`
  (#FFB37A) is the hover/emphasis; `--brand-soft` becomes
  `rgba(249, 115, 22, 0.14)`.

**The full Mars ramp** (implementation values):

```
50   #FFF7ED    300  #FDBA74    600  #EA580C
100  #FFEDD5    400  #FB923C    700  #C2410C
200  #FED7AA    500  #F97316 ◄── 800  #9A3412
                                  900  #7C2D12
```

**Logo mark:** a warm orange planet with a single white orbit ring and one small
satellite dot — the orbit dot is *the partner*: two dots never appear; one is always
implied by the ring. In dark mode the planet keeps `--brand`, the ring/dot stay white.

---

## 3. Color palette

### Neutrals — warm stone (never cool gray)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FFF8F2` | App background (oatmeal) |
| `--card` | `#FFFFFF` | Cards, modals, compose |
| `--line` | `#ECE5DD` | Borders, dividers |
| `--ink` | `#292524` | Primary text |
| `--ink-soft` | `#78716C` | Secondary text, meta |
| `--ink-faint` | `#A8A29E` | Placeholders, hints |

### Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ok` | `#16A34A` / fill `#DCFCE7` | `#4ADE80` / fill `rgba(74,222,128,.14)` | Done, both-checked-in |
| `--warn` | `#D97706` / fill `#FEF3C7` | `#FBBF24` / fill `rgba(251,191,36,.14)` | Soon / snoozed |
| `--danger` | `#DC2626` / fill `#FEE2E2` | `#F87171` / fill `rgba(248,113,113,.14)` | Overdue, delete |
| `--info` | `#2563EB` / fill `#DBEAFE` | `#60A5FA` / fill `rgba(96,165,250,.14)` | Links, mentions |

### Labels (feature F11 — six fixed label colors)

```
Chores  #EF4444    Meals  #F59E0B    Study  #3B82F6
Plans   #F97316    Health #22C55E    Family #A855F7
```
Label chips always render white-on-color at ≥11px bold; selected state = full opacity,
unselected = 35% opacity.

---

## 4. Typography

**Display/UI font:** Nunito (Google Fonts, weights 400/600/700/800/900) — rounded but
legible; the warmth without the cartoon.
**Fallback stack:** `-apple-system, "SF Pro Rounded", "Segoe UI Variable Display",
"Segoe UI", Roboto, sans-serif`.
**Mono accent (pair codes, timestamps):** `"SF Mono", "JetBrains Mono", ui-monospace,
monospace`.

### Scale (mobile-first, in px / line-height / weight)

| Token | Size / Lh / Wt | Use |
|---|---|---|
| `display` | 32 / 36 / 800 | Onboarding hero ("Marsky") |
| `h1` | 24 / 30 / 800 | Modal titles, section titles |
| `h2` | 20 / 26 / 800 | Card headers, check-in item text |
| `title` | 17 / 22 / 700 | Item text (the list's voice) |
| `body` | 15 / 22 / 400–600 | Descriptions, comments, buttons |
| `small` | 13 / 18 / 500 | Meta rows, attachment names |
| `caption` | 11.5 / 16 / 700, uppercase, +0.6px | Field labels, badges |
| `code` | 20 / 28 / 800, +3px letterspacing, mono | Pair code display |

**Rules:** max 2 weights per screen; line-length ≤ 65ch for prose; numbers in times use
tabular figures where available; never underline body text (links use `--brand-dark` +
weight).

---

## 5. Spacing & layout

- **Grid:** 4px base. Scale: `4 8 12 16 20 24 32 48 64`.
- **Page:** content column max-width **720px**, centered; side padding 16px (mobile) /
  24px (desktop).
- **Header:** sticky, 56–64px tall, blurred `--bg` backdrop, bottom hairline `--line`.
- **List rhythm:** 10px gap between item cards; 18px below compose.
- **Radii:** `sm 8` (inputs, chips), `md 12` (pinned cards, toasts), `lg 16` (item
  cards, compose, modals 18), `pill 999` (buttons, badges, avatars 50%).
- **Shadows:** soft and warm, never gray-harsh:
  - card: `0 2px 8px rgba(0,0,0,.04)`
  - compose/elevated: `0 10px 30px rgba(234,88,12,.10)`
  - modal: `0 24px 60px rgba(0,0,0,.22)`
  - toast: `0 14px 40px rgba(0,0,0,.30)`
- **Touch targets:** ≥44×44px on mobile (all icon buttons, checks, chips); desktop ≥36.
- **Breakpoints:** 520px (collapse header chips, single-column compose), 720px
  (two-column compose details, wider hero).

---

## 6. Component library

Each component maps to its PRD feature (F#).

### 6.1 Buttons — pairing, compose, actions (F1–F5, F13)
- **Primary:** `--brand` fill, white bold text, pill, soft glow shadow; hover
  `--brand-dark`; pressed scale(.97). Used for the *one* main action per screen.
- **Ghost:** white fill, `--line` border; hover orange border + `--brand-dark` text.
- **Small** (in-card, inline): 13px, tighter padding. **Icon-btn:** 38×38 white card,
  `--line` border, hover orange border.

### 6.2 Avatar — who-did-what (F6)
- 34px circle, initials (first letters), member color from a fixed 6-color palette,
  white text at 13px. `you` = orange ring. Partner stack: `avatar + avatar` overlap
  (−10px) — the pair is always shown together in the header.
- Mini variant 20px (meta rows) / 26px (comments, history).

### 6.3 Pair code — pairing (F1)
- Mono, 20px/800, +3px tracking, `--brand-dark` on `--brand-soft` fill, radius 12,
  `user-select: all`; copy affordance. The only "settings-like" surface in the product.

### 6.4 Item card — the shared list (F2, F3)
- White `lg` card, `--line` border, 13px padding. Anatomy (top → bottom):
  1. **Row:** checkbox · text (`title`) · actions (💬 count, 📌 pin, ✎ edit, 🗑 delete).
  2. **Note:** `small`, `--ink-soft`.
  3. **Meta row:** added-by avatar + name · due badge · recurring tag · labels ·
     attachment icon · comment count.
  4. **Comments** (expanded inline, 6.9).
- **States:** default · `completed` (opacity .62, strikethrough, green check) ·
  `soon` (`#FDBA74` border) · `overdue` (`--danger` border + `#FFF7F5` fill) ·
  `firing` (orange border + 3px soft glow ring + pulsing due badge).

### 6.5 Checkbox — complete (F6)
- 22×22, 2px `#D6D3D1` border, radius 7, white fill; hover orange border; completed →
  green fill `--ok` with white check. Tap = complete; completed item shows
  "done by Maya ✓" in green in the meta row.

### 6.6 Due badge — mutual reminders (F4)
- Pill, `caption`, states: **normal** (neutral) · **soon** (orange tint, ≤60 min) ·
  **late** (red, overdue) · **firing** (solid `--brand`, white text, pulse). Always
  relative language: "Today 18:30", "Tomorrow", "Tue 14:00", "overdue 2h".

### 6.7 Label chips — labels (F11)
- 6 fixed colors (see §3), white-on-color bold 11px, pill; unselected 35% opacity.

### 6.8 Recurring tag (F8) — purple glyph "🔁 daily/weekly", `small` weight 700.

### 6.9 Comments — per-item thread (F9)
- Inline expander under the card: `--bg` bubbles with avatar, bold name, faint time;
  input row with 44px-tall field; submit = orange icon-btn.

### 6.10 Attachments (F10)
- Chip: paperclip/link glyph + name, `--brand-dark` weight 600; image attachments
  render a small thumbnail (max-h 60px) above the meta row.

### 6.11 Pin (F12) — star mini-btn; on = `--brand`; pinned items surface in the
**pinned strip**: horizontal scroll row of compact cards above the list.

### 6.12 Compose bar — add note (F3)
- White `lg` card: input (`body`, 44px) + Add (primary) + ⋯ (toggles details: due
  picker with quick chips "+1 min / +30 min / +2 h / tomorrow", repeat select, label
  chips, note field, attach buttons). Details open = 4px top hairline, `--brand-soft`
  quick-chip selection.

### 6.13 Check-in modal — "done?" (F5, the magic moment)
- Modal with `h2` item text, due context, and the pair's two status rows (avatar +
  "Waiting for Maya…" → "Maya said done ✅" / "Maya said not yet 😅"). Actions:
  **Done ✅** (primary) / **Not yet** (ghost). Both-done verdict: centered `--ok` line
  + celebratory toast ("You both did it 🎉"). Any "not yet" reveals **Snooze +30 min**
  (F13).

### 6.14 History drawer (F7) — right-side/bottom sheet listing
avatar + "Alex added 'Trash'" + relative time; newest first; max-height with scroll.

### 6.15 Toast (F4, F14) — dark `--ink` pill, bottom-center stack, slide-up, auto-dismiss
8s for reminders (with **Done / Not yet** actions), 4s for confirmations.

### 6.16 Invite banner (F1) — `--brand-soft` fill, dashed `--brand` border, shows the
pair code + Copy. Only visible while the pair has one member.

### 6.17 Empty state (F2) — warm illustration (Marsky planet sprouting 🌱), `body`
ink-soft text, single ghost CTA "Add your first note".

### 6.18 Modal base (F1, F5, delete-confirm) — scrim `rgba(41,37,36,.45)` + blur(2px),
white sheet 440px max, radius 18, pop-in scale(.96→1) 160ms.

---

## 7. Dark mode ("Mars night")

Same warmth, deeper sky — never pure black.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FFF8F2` | `#1C1917` |
| `--card` | `#FFFFFF` | `#292524` |
| `--card-2` (elevated) | — | `#44403C` |
| `--line` | `#ECE5DD` | `#44403C` |
| `--ink` | `#292524` | `#FAFAF9` |
| `--ink-soft` | `#78716C` | `#A8A29E` |
| `--ink-faint` | `#A8A29E` | `#78716C` |
| `--brand-soft` | `#FFEDD5` | `rgba(249,115,22,.14)` |
| `--shadow` | warm orange | black, deeper spread |

Dark-mode specifics: primary buttons stay `--brand` (hover `--brand-light`); firing
glow uses `--brand-light` at 25% alpha; overdue keeps red family at lighter
`#F87171`; the logo's planet stays `#F97316` with white ring/dot; card elevation uses
one-step-lighter surfaces instead of shadows.

**Activation:** follow `prefers-color-scheme`; no manual toggle in v1 (zero-friction
principle).

---

## 8. Motion & micro-interactions

- **Default curve:** `cubic-bezier(.2,.8,.2,1)`, durations 120–200ms.
- **Swipe-free** in v1 (everything is a tap): keep interactions obvious.
- **Check-in celebration:** when both answer done — badge pulses once (scale 1→1.06),
  toast slides up, item card gently flips to completed state (opacity + strikethrough,
  200ms).
- **Reminder firing:** due badge pulses (box-shadow ring, 1.2s loop) until answered.
- **Modal:** pop-in 160ms; toasts slide-up 200ms; history drawer slides in 220ms.
- **Respect `prefers-reduced-motion`:** disable pulse/glow, keep 150ms fades.

---

## 9. Accessibility

- **Contrast:** AA for text (orange text on light → `--brand-dark`; on dark → `--brand`
  or `--brand-light` for emphasis). Never place `small`/`caption` text in `--brand`
  on white.
- **Focus:** 2px `--brand` ring + 3px soft glow; visible on all interactive elements.
- **Targets:** ≥44px on mobile; keyboard-operable (Enter/Space on checks, chips,
  buttons; Esc closes modals).
- **Motion:** reduced-motion respected (see §8).
- **Semantics:** list items are real checkboxes/buttons with labels; toasts carry
  `role="status"`; check-in modal is `role="dialog"` with focus trap; history is a
  real list.

---

## 10. Implementation tokens (CSS reference)

```css
:root {
  --brand: #F97316;        --brand-light: #FFB37A;
  --brand-soft: #FFEDD5;   --brand-dark: #C2410C;
  --bg: #FFF8F2;  --card: #FFFFFF;  --line: #ECE5DD;
  --ink: #292524; --ink-soft: #78716C; --ink-faint: #A8A29E;
  --ok: #16A34A; --warn: #D97706; --danger: #DC2626; --info: #2563EB;
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-pill: 999px;
  --shadow-card: 0 2px 8px rgba(0,0,0,.04);
  --shadow-elev: 0 10px 30px rgba(234,88,12,.10);
  --shadow-modal: 0 24px 60px rgba(0,0,0,.22);
  --font: "Nunito", -apple-system, "SF Pro Rounded", "Segoe UI", Roboto, sans-serif;
  --mono: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
}
```

---

*Marsky — one list, two people, zero nagging.*
