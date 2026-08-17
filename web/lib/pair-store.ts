"use client";

/** Local-first adapter for the ARCHITECTURE.md §4 schema. Persists to
 *  localStorage and syncs between browser tabs (the two partners) over a
 *  BroadcastChannel. When Supabase is configured AND the schema is applied,
 *  the same mutations also write through to the DB (RLS-enforced) and the
 *  pair stays live across devices via Postgres realtime. If the DB or schema
 *  is unavailable, every call degrades gracefully to the pure local mode. */

import type {
  Attachment,
  CheckinAnswer,
  Item,
  Member,
  Pair,
  PersistedState,
  User,
} from "./types";
import { generateCode, pickColor, uid, uuid } from "./format";
import {
  dbCreatePair,
  dbDeleteItem,
  dbFetchPair,
  dbFireReminders,
  dbInsertItem,
  dbJoinPair,
  dbPushHistory,
  dbUpdateItem,
  dbUpsertUser,
  ensureAnon,
  isConfigured,
  isSchemaError,
  subscribeRealtime,
  type ItemPatch,
} from "./db";

const LS_KEY = "marsky.local.v1";
const CHANNEL = "marsky";

const state: PersistedState = load();
let version = 0;
const listeners = new Set<() => void>();

const bc =
  typeof window !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

bc?.addEventListener("message", (e) => {
  const msg = e.data;
  if (msg?.t === "sync" && msg.pair) {
    const known = state.pairs[msg.code];
    const incomingRev = msg.pair.rev ?? 0;
    // Accept pairs we know about (or our active one) only when the incoming
    // copy is NEWER — never let a stale context regress our state.
    if ((known || msg.code === state.activeCode) && incomingRev > (known?.rev ?? 0)) {
      state.pairs[msg.code] = msg.pair;
      save();
      emit();
    }
  }
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY) return;
    const incoming = load();
    for (const code of Object.keys(incoming.pairs)) {
      const theirs = incoming.pairs[code];
      const ours = state.pairs[code];
      if (!ours || (theirs.rev ?? 0) > (ours.rev ?? 0)) {
        state.pairs[code] = theirs;
      }
    }
    emit();
  });
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      // Migrate legacy emoji history verbs (pre-icon build) to semantic ones.
      for (const pair of Object.values(parsed.pairs ?? {})) {
        for (const h of pair.history ?? []) {
          h.verb =
            h.verb?.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, "").trim() ||
            "updated";
        }
      }
      return parsed;
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return { user: null, pairs: {}, activeCode: null };
}

function save() {
  try {
    const prev = load();
    for (const code of Object.keys(state.pairs)) {
      const ours = state.pairs[code];
      const theirs = prev?.pairs?.[code];
      if (theirs && (theirs.rev ?? 0) > (ours.rev ?? 0)) {
        state.pairs[code] = theirs; // adopt the newer copy, don't regress
      }
    }
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded (large attachments) — ignore for prototype */
  }
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function bump(pair: Pair) {
  pair.rev = (pair.rev ?? 0) + 1;
}

function saveBroadcastEmit(code: string) {
  const pair = state.pairs[code];
  if (pair) bump(pair);
  save();
  bc?.postMessage({ t: "sync", code, pair: state.pairs[code] });
  emit();
}

/** ---------- reactivity (useSyncExternalStore) ---------- */

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

export function getUser(): User | null {
  return state.user;
}

export function getActivePair(): Pair | null {
  if (!state.activeCode) return null;
  return state.pairs[state.activeCode] ?? null;
}

export function getPairs(): Record<string, Pair> {
  return state.pairs;
}

export function getActiveCode(): string | null {
  return state.activeCode;
}

export function isDbMode(): boolean {
  return dbAvailable;
}

/** True when Supabase env vars are present (regardless of whether the DB is
 *  actually usable right now). Lets the UI distinguish "backend not ready"
 *  from "code not found". */
export function isSupabaseConfigured(): boolean {
  return isConfigured();
}

/** ---------- history ---------- */

const HISTORY_CAP = 500;

function pushHistory(pair: Pair, actor: Member, verb: string, detail: string) {
  pair.history.unshift({
    id: uid(),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    verb,
    detail,
  });
  if (pair.history.length > HISTORY_CAP) pair.history.length = HISTORY_CAP;
}

/** ---------- Supabase layer (background sync, never blocks the UI) ---------- */

let dbAvailable = typeof window !== "undefined" && isConfigured();
/** The anonymous Supabase auth id (uuid). When set, it becomes the local
 *  member id so RLS (auth.uid()) and local state stay aligned. */
let anonId: string | null = null;
let initPromise: Promise<void> | null = null;

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function handleDbErr(err: unknown) {
  // A schema/permission error means the migration isn't applied — fall back
  // to local-only for the rest of the session. Other failures (network,
  // invalid-uuid from the dev demo partner) are per-write and ignored.
  if (dbAvailable && isSchemaError(err)) {
    dbAvailable = false;
    console.warn("[marsky] Supabase schema unavailable — staying local-only.", err);
  }
}

function handleWriteErr(res: { ok: boolean; error?: unknown }) {
  if (!res.ok) handleDbErr(res.error);
}

async function resolveAnonId(name?: string | null): Promise<string | null> {
  if (!dbAvailable) return null;
  try {
    const id = await ensureAnon(name ?? state.user?.name ?? null);
    anonId = id;
    return id;
  } catch (err) {
    // Without an authenticated identity the DB is unusable (RLS blocks
    // everything), so fall back to local-only for the session. The usual
    // cause is anonymous sign-ins not being enabled in the project.
    dbAvailable = false;
    const msg = String((err as { message?: string })?.message ?? err);
    if (/anonymous|sign.?up|disabled/i.test(msg)) {
      console.warn(
        "[marsky] Supabase anonymous sign-ins are not enabled on this project — " +
          "running local-only. Enable them under Authentication > Providers.\n" +
          "(Apply supabase/migrations/0001_initial.sql first.)"
      );
    } else {
      console.warn("[marsky] Supabase unavailable — running local-only.", err);
    }
    return null;
  }
}

/** Boot: sign in anonymously (zero friction, PRD F1), refresh the active
 *  pair from the DB, and subscribe to realtime. Safe to call once. */
export function initDb(): Promise<void> {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
  if (!isConfigured()) return;
  const id = await resolveAnonId();
  if (!id) return; // schema missing → local-only mode
  const code = state.activeCode;
  const local = code ? state.pairs[code] : null;
  if (!code || !local) return;
  const fetched = await dbFetchPair(code);
  if (fetched.ok) {
    adoptDbPair(fetched.pair);
    watchPair(code);
  } else if (fetched.error instanceof Error && fetched.error.message === "pair not found") {
    // Local pair predates the Supabase wiring — migrate it up (re-keying
    // local member ids to the anon uuid).
    await uploadPair(code, id);
  } else {
    handleDbErr(fetched.error);
  }
}

/** Pure migration: re-key local-only member ids (`u-…`) to the anonymous
 *  auth uuid so RLS and the users FK align. Demo partners (`demo-…`) stay
 *  local-only. Returns true if anything changed. Exported for tests. */
export function rekeyLocalPair(pair: Pair, anon: string): boolean {
  let changed = false;
  for (const m of pair.members) {
    if (m.id.startsWith("demo-") || isUuid(m.id)) continue;
    m.id = anon;
    changed = true;
  }
  for (const it of pair.items) {
    // Local item ids were `i-…` (not valid uuids) — re-key to real uuids so
    // the insert into the uuid PK succeeds. Nothing references item ids
    // outside the item itself.
    if (!isUuid(it.id)) { it.id = uuid(); changed = true; }
    if (!isUuid(it.createdBy)) { it.createdBy = anon; changed = true; }
    if (it.completedBy && !isUuid(it.completedBy)) { it.completedBy = anon; changed = true; }
    for (const c of it.comments) if (!isUuid(c.authorId)) { c.authorId = anon; changed = true; }
  }
  for (const h of pair.history) if (!isUuid(h.actorId)) { h.actorId = anon; changed = true; }
  return changed;
}

async function uploadPair(code: string, anon: string) {
  const pair = state.pairs[code];
  if (!pair || !dbAvailable) return;
  rekeyLocalPair(pair, anon);
  if (state.user && !isUuid(state.user.id)) {
    state.user = { ...state.user, id: anon };
  }
  save();
  emit();
  const creator = pair.members.find((m) => isUuid(m.id));
  if (!creator || !state.user) return;
  await dbUpsertUser(state.user).then(handleWriteErr);
  const created = await dbCreatePair(code, pair.name, creator);
  if (!created.ok) {
    handleDbErr(created.error);
    return;
  }
  for (const item of pair.items) {
    if (isUuid(item.createdBy)) await dbInsertItem(code, item).then(handleWriteErr);
  }
  // dbCreatePair already wrote the "created" history row (oldest entry).
  for (const h of pair.history.slice(0, -1)) {
    await dbPushHistory(code, h).then(handleWriteErr);
  }
  watchPair(code);
}

/** Realtime watcher for the active pair (debounced refresh). */
let unwatch: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function watchPair(code: string) {
  if (!dbAvailable) return;
  unwatch?.();
  unwatch = subscribeRealtime(code, () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshFromDb(code), 400);
  });
}

async function refreshFromDb(code: string) {
  if (!dbAvailable) return;
  const res = await dbFetchPair(code);
  if (!res.ok) {
    handleDbErr(res.error);
    return;
  }
  adoptDbPair(res.pair);
}

/** Adopt the DB copy as authoritative, preserving our monotonic rev so the
 *  broadcast/storage merge can never regress a newer local state. */
function adoptDbPair(pair: Pair) {
  const local = state.pairs[pair.code];
  pair.rev = Math.max(pair.rev ?? 0, local?.rev ?? 0, 1);
  state.pairs[pair.code] = pair;
  save();
  emit();
}

function itemToPatch(item: Item): ItemPatch {
  return {
    text: item.text,
    note: item.note ?? null,
    due_at: item.dueAt,
    recurring: item.recurring,
    completed: item.completed,
    completed_by: item.completedBy ?? null,
    completed_at: item.completedAt ?? null,
    labels: item.labels,
    pinned: item.pinned,
    attachments: item.attachments,
    comments: item.comments,
    checkin: item.checkin,
    reminded: item.reminded,
  };
}

/** Diff-based background sync: after a mutation, push the touched items and
 *  new history entries to the DB (fire-and-forget; errors fall back). */
function syncItems(code: string, pair: Pair, beforeJson: string, historyLen: number) {
  if (!dbAvailable) return;
  const before = new Map<string, string>();
  for (const it of JSON.parse(beforeJson) as Item[]) before.set(it.id, JSON.stringify(it));
  const newHistory = pair.history.slice(0, pair.history.length - historyLen);
  for (const h of newHistory) void dbPushHistory(code, h).then(handleWriteErr);
  for (const item of pair.items) {
    const json = JSON.stringify(item);
    const prev = before.get(item.id);
    if (prev === undefined) void dbInsertItem(code, item).then(handleWriteErr);
    else if (prev !== json) void dbUpdateItem(item.id, itemToPatch(item)).then(handleWriteErr);
  }
  for (const id of before.keys()) {
    if (!pair.items.some((i) => i.id === id)) void dbDeleteItem(id).then(handleWriteErr);
  }
}

/** ---------- mutations ---------- */

function mutate(code: string, fn: (pair: Pair) => void) {
  const pair = state.pairs[code];
  if (!pair) return;
  const before = JSON.stringify(pair.items);
  const historyLen = pair.history.length;
  fn(pair);
  saveBroadcastEmit(code);
  syncItems(code, pair, before, historyLen);
}

function currentMember(pair: Pair): Member | null {
  const user = state.user;
  if (!user) return null;
  return pair.members.find((m) => m.id === user.id) ?? null;
}

export function initUser(name: string): User {
  const user: User = {
    id: anonId ?? "u-" + uid(),
    name: name.trim().slice(0, 30) || "Me",
    color: pickColor(0),
  };
  state.user = user;
  save();
  emit();
  return user;
}

/** F1 — create a pair. The creator becomes member 1. */
export function createPair(
  userName: string,
  pairName?: string
): Pair {
  const user = state.user ?? initUser(userName);
  let code = generateCode();
  while (state.pairs[code]) code = generateCode();
  const pair: Pair = {
    code,
    name: (pairName?.trim() || `${user.name} & partner`).slice(0, 40),
    createdAt: new Date().toISOString(),
    members: [{ id: user.id, name: user.name, color: user.color }],
    items: [],
    history: [],
    rev: 1,
  };
  state.pairs[code] = pair;
  state.activeCode = code;
  pushHistory(pair, user, "created", `this pair`);
  saveBroadcastEmit(code);
  return pair;
}

/** F1 — async create: ensures anonymous auth first so the member id is the
 *  Supabase uuid (RLS alignment), then creates locally + seeds the DB. Falls
 *  back to pure local when the DB/schema is unavailable. */
export async function createPairAsync(
  userName: string,
  pairName?: string
): Promise<Pair> {
  const id = await resolveAnonId(userName);
  if (id) {
    // DB mode: the local user's id IS the auth uuid.
    state.user = {
      id,
      name: state.user?.name ?? (userName.trim().slice(0, 30) || "Me"),
      color: state.user?.color ?? pickColor(0),
    };
    save();
    emit();
  }
  const pair = createPair(userName, pairName);
  if (dbAvailable && state.user && isUuid(state.user.id)) {
    const me = state.user;
    await dbUpsertUser(me).then(handleWriteErr);
    const created = await dbCreatePair(pair.code, pair.name, pair.members[0]);
    if (!created.ok) {
      handleDbErr(created.error);
    } else {
      watchPair(pair.code);
      // Items (none) + history beyond the "created" entry dbCreatePair wrote.
      syncItems(pair.code, pair, "[]", 1);
    }
  }
  return pair;
}

export type JoinError = "not-found" | "full";

/** F1 — join a pair by code (local mode). The joiner becomes member 2. */
export function joinPair(
  code: string,
  userName: string
): { pair: Pair } | { error: JoinError } {
  const normalized = code.trim().toUpperCase();
  const pair = state.pairs[normalized];
  if (!pair) return { error: "not-found" };
  if (pair.members.length >= 2) return { error: "full" };
  const user = state.user ?? initUser(userName);
  const existing = pair.members.find((m) => m.id === user.id);
  if (!existing) {
    const member: Member = {
      id: user.id,
      name: user.name,
      color: pickColor(pair.members.length),
    };
    pair.members.push(member);
    pushHistory(pair, member, "joined", `the pair`);
  }
  state.user = user;
  state.activeCode = normalized;
  saveBroadcastEmit(normalized);
  return { pair };
}

/** F1 — async join: works even when the pair isn't in local storage (fresh
 *  browser / another device). Joins via the atomic join_pair RPC, adopts the
 *  DB copy, and subscribes to realtime. Falls back to local when unavailable. */
export async function joinPairAsync(
  code: string,
  userName: string
): Promise<{ pair: Pair } | { error: JoinError }> {
  const normalized = code.trim().toUpperCase();
  const cleanName = userName.trim().slice(0, 30) || "Me";
  const id = await resolveAnonId(cleanName);
  if (!id) return joinPair(normalized, cleanName); // local mode
  try {
    const rpc = await dbJoinPair(normalized, {
      id,
      name: cleanName,
      color: pickColor(0),
    });
    if (!rpc.ok) {
      if (rpc.reason === "not_found") return { error: "not-found" };
      if (rpc.reason === "full") return { error: "full" };
      handleDbErr(rpc.error);
      return { error: "not-found" };
    }
    const fetched = await dbFetchPair(normalized);
    if (!fetched.ok) {
      handleDbErr(fetched.error);
      return { error: "not-found" };
    }
    // Adopt the DB copy as our active pair, with this device's user aligned
    // to the auth identity.
    state.user = {
      id,
      name: state.user?.name ?? cleanName,
      color: state.user?.color ?? pickColor(0),
    };
    state.activeCode = normalized;
    adoptDbPair(fetched.pair);
    watchPair(normalized);
    save();
    emit();
    return { pair: fetched.pair };
  } catch (err) {
    handleDbErr(err);
    return { error: "not-found" };
  }
}

/** F2/F3 — add an item. `actor` is normally the current member; the demo
 *  partner passes its own member so both sides exercise the same code path. */
export function addItem(
  code: string,
  actor: Member,
  input: {
    text: string;
    note?: string;
    dueAt?: string | null;
    recurring?: Item["recurring"];
    labels?: number[];
    pinned?: boolean;
    attachments?: Attachment[];
  }
): Item | null {
  const text = input.text.trim().slice(0, 200);
  if (!text) return null;
  let created: Item | null = null;
  mutate(code, (pair) => {
    const item: Item = {
      id: uuid(),
      text,
      note: input.note?.trim().slice(0, 500) || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: new Date().toISOString(),
      dueAt: input.dueAt ?? null,
      recurring: input.recurring ?? null,
      completed: false,
      completedBy: null,
      completedAt: null,
      labels: input.labels ?? [],
      pinned: input.pinned ?? false,
      attachments: input.attachments ?? [],
      comments: [],
      checkin: null,
      reminded: false,
    };
    pair.items.push(item);
    pushHistory(pair, actor, "added", `“${item.text}”`);
    created = item;
  });
  return created;
}

/** F2/F3 — edit an item (either member can edit anything — equality by design). */
export function updateItem(
  code: string,
  itemId: string,
  actor: Member,
  patch: Partial<Pick<Item, "text" | "note" | "dueAt" | "recurring" | "labels">>
) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item) return;
    const oldText = item.text;
    Object.assign(item, patch);
    if (patch.text && patch.text.trim() && patch.text.trim() !== oldText) {
      pushHistory(pair, actor, "edited", `“${patch.text.trim().slice(0, 200)}”`);
    }
  });
}

export function deleteItem(code: string, itemId: string, actor: Member) {
  mutate(code, (pair) => {
    const idx = pair.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const [removed] = pair.items.splice(idx, 1);
    pushHistory(pair, actor, "deleted", `“${removed.text}”`);
  });
}

/** F6 — toggle complete, handling recurring rollover (F8). */
export function toggleComplete(code: string, itemId: string, actor: Member) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item) return;
    if (!item.completed) {
      completeItem(pair, item, actor);
    } else {
      item.completed = false;
      item.completedBy = null;
      item.completedAt = null;
      item.checkin = null;
      pushHistory(pair, actor, "reopened", `“${item.text}”`);
    }
  });
}

/** Shared by checkbox completion and mutual check-in (both answered yes). */
function completeItem(pair: Pair, item: Item, actor: Member) {
  if (item.recurring) {
    // F8 — auto-schedule the next occurrence at the same time.
    const base = new Date(item.dueAt ?? item.createdAt).getTime();
    const step = item.recurring === "daily" ? 86_400_000 : 7 * 86_400_000;
    item.dueAt = new Date(base + step).toISOString();
    item.completed = false;
    item.completedBy = null;
    item.completedAt = null;
    item.reminded = false;
    item.checkin = null;
    pushHistory(
      pair,
      actor,
      "rescheduled",
      `“${item.text}” — next: ${item.recurring === "daily" ? "tomorrow" : "next week"}`
    );
  } else {
    item.completed = true;
    item.completedBy = actor.id;
    item.completedAt = new Date().toISOString();
    item.checkin = null;
    pushHistory(pair, actor, "completed", `“${item.text}”`);
  }
}

/** F5 — answer a check-in. When both members have answered and both say
 *  yes, the item auto-completes. */
export function respondCheckin(
  code: string,
  itemId: string,
  actor: Member,
  answer: CheckinAnswer
) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item || !item.checkin) return;
    item.checkin.responses[actor.id] = answer;
    const memberIds = pair.members.map((m) => m.id);
    const answered = Object.keys(item.checkin.responses).filter((id) =>
      memberIds.includes(id)
    );
    if (answered.length >= pair.members.length) {
      const allYes = memberIds.every((id) => item.checkin!.responses[id] === "yes");
      if (allYes) {
        pushHistory(pair, actor, "checked-in", `“${item.text}” with both members`);
        completeItem(pair, item, actor);
      }
      // Mixed answers: leave open; snooze is offered from the modal.
    }
  });
}

/** F13 — snooze re-arms the reminder for later. */
export function snooze(code: string, itemId: string, actor: Member, minutes = 30) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item) return;
    item.dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
    item.reminded = false;
    item.checkin = null;
    pushHistory(pair, actor, "snoozed", `“${item.text}” +${minutes} min`);
  });
}

/** F9 — comment on an item. */
export function addComment(code: string, itemId: string, actor: Member, text: string) {
  const clean = text.trim().slice(0, 300);
  if (!clean) return;
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item) return;
    item.comments.push({
      id: "c-" + uid(),
      authorId: actor.id,
      authorName: actor.name,
      text: clean,
      at: new Date().toISOString(),
    });
    pushHistory(pair, actor, "commented", `on “${item.text}”`);
  });
}

/** F10 — attach a URL or file. */
export function addAttachment(
  code: string,
  itemId: string,
  actor: Member,
  attachment: { name: string; url: string }
) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item) return;
    item.attachments.push({ id: "a-" + uid(), ...attachment });
    pushHistory(pair, actor, "attached", `${attachment.name} to “${item.text}”`);
  });
}

/** F12 — pin/unpin. */
export function togglePin(code: string, itemId: string, actor: Member) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (!item) return;
    item.pinned = !item.pinned;
    pushHistory(
      pair,
      actor,
      item.pinned ? "pinned" : "unpinned",
      `“${item.text}”`
    );
  });
}

/** F11 — set labels. */
export function setLabels(code: string, itemId: string, labels: number[]) {
  mutate(code, (pair) => {
    const item = pair.items.find((i) => i.id === itemId);
    if (item) item.labels = labels;
  });
}

/** F4 — the reminder loop. Fires due items once each; returns what fired so
 *  the UI can open the check-in and toast. Also pushes the fired state to
 *  the DB so the partner device sees it. */
export function checkDue(now = Date.now()): Item[] {
  const code = state.activeCode;
  const pair = code ? state.pairs[code] : null;
  if (!pair) return [];
  const before = JSON.stringify(pair.items);
  const historyLen = pair.history.length;
  const fired: Item[] = [];
  for (const item of pair.items) {
    if (!item.dueAt || item.completed || item.reminded) continue;
    if (new Date(item.dueAt).getTime() <= now) {
      item.reminded = true;
      item.checkin = { firedAt: new Date(now).toISOString(), responses: {} };
      pushHistory(pair, pair.members[0] ?? { id: "sys", name: "Marsky", color: "#F97316" }, "reminded", `“${item.text}” to both of you`);
      fired.push(item);
    }
  }
  if (fired.length) {
    saveBroadcastEmit(code!);
    syncItems(code!, pair, before, historyLen);
    // Belt-and-suspenders: mark the same rows in the DB (guarded, so a
    // closed tab can't double-fire) for the production pg_cron path.
    if (dbAvailable) void dbFireReminders(code!, new Date(now)).then(handleWriteErr);
  }
  return fired;
}

/** The current member as a Member (for acting on the pair), or the first
 *  member when the store has no user (e.g. reminder side-effects). */
export function getActor(pair: Pair): Member | null {
  return currentMember(pair);
}

export function isMember(pair: Pair): boolean {
  const user = state.user;
  return !!user && pair.members.some((m) => m.id === user.id);
}

/** ---------- dev-only demo partner (PRD flow: two partners) ----------
 *  Lets a second "person" act on the pair from this same tab via the same
 *  mutation + broadcast path a real partner tab would use. Guarded to dev.
 *  In DB mode the demo member is local-only (it isn't a real auth user). */
function demoPartner(name = "Maya"): Member | null {
  const code = state.activeCode;
  if (!code) return null;
  const pair = state.pairs[code];
  if (!pair) return null;
  let member = pair.members.find((m) => m.id.startsWith("demo-"));
  if (member) return member; // already joined — acts as the partner
  if (pair.members.length >= 2) return null; // only block a THIRD member
  member = { id: "demo-" + uid(), name: name.slice(0, 30), color: pickColor(1) };
  pair.members.push(member);
  pushHistory(pair, member, "joined", `the pair (demo)`);
  saveBroadcastEmit(code);
  return member;
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__marskyDemo = {
    get: () => state.pairs[state.activeCode ?? ""],
    join: (n?: string) => demoPartner(n),
    add: (text: string, opts?: Partial<Parameters<typeof addItem>[2]>) => {
      const code = state.activeCode!;
      const m = demoPartner();
      if (m) addItem(code, m, { text, ...opts });
    },
    respond: (itemId: string, answer: CheckinAnswer) => {
      const m = demoPartner();
      if (m) respondCheckin(state.activeCode!, itemId, m, answer);
    },
    complete: (itemId: string) => {
      const m = demoPartner();
      if (m) toggleComplete(state.activeCode!, itemId, m);
    },
    comment: (itemId: string, text: string) => {
      const m = demoPartner();
      if (m) addComment(state.activeCode!, itemId, m, text);
    },
  };
}
