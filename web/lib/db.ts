"use client";

/** Supabase integration per ARCHITECTURE.md §4.
 *  Client-side (publishable key — RLS is the security boundary), anonymous
 *  auth for zero-friction pairing (PRD F1), and realtime via Postgres
 *  changes. Helpers return { ok, error } so the store can fall back to
 *  local mode when the DB or schema is unavailable. */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { HistoryEntry, Member, Pair } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isConfigured(): boolean {
  return Boolean(URL && KEY);
}

let client: SupabaseClient | null = null;
export function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export function isSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  const msg = String((err as { message?: string })?.message ?? err);
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation "public\./.test(msg) ||
    /does not exist/i.test(msg) ||
    /permission denied for (table|relation)/i.test(msg)
  );
}

/** Anonymous sign-in + ensure the user row exists. Returns the auth user id
 *  (null when Supabase is unavailable or the schema isn't applied yet). */
export async function ensureAnon(localName?: string | null): Promise<string | null> {
  const supabase = getClient();
  const { data } = await supabase.auth.getSession();
  let authUser: User | null = data.session?.user ?? null;
  if (!authUser) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    authUser = anon.user ?? null;
  }
  if (!authUser) return null;
  // Ensure our users row exists (fails with a schema error if not migrated).
  const { error } = await supabase.from("users").upsert(
    {
      id: authUser.id,
      display_name: (localName ?? "Me").slice(0, 30),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  return authUser.id;
}

/** ---------- pair reads ---------- */

export interface DbPairRow {
  code: string;
  name: string;
  created_at: string;
  rev: number;
}

const toIso = (v: string | null) => (v ? new Date(v).toISOString() : null);

export async function dbFetchPair(code: string): Promise<{ ok: true; pair: Pair } | { ok: false; error: unknown }> {
  const supabase = getClient();
  const [pairRes, membersRes, itemsRes, historyRes] = await Promise.all([
    supabase.from("pairs").select("code, name, created_at, rev").eq("code", code).maybeSingle(),
    supabase
      .from("pair_members")
      .select("user_id, joined_at, users(display_name, color)")
      .eq("pair_code", code)
      .order("joined_at", { ascending: true }),
    supabase
      .from("items")
      .select("*")
      .eq("pair_code", code)
      .order("created_at", { ascending: false }),
    supabase
      .from("history")
      .select("id, actor_id, actor_name, verb, detail, at")
      .eq("pair_code", code)
      .order("at", { ascending: false })
      .limit(200),
  ]);
  const err = pairRes.error ?? membersRes.error ?? itemsRes.error ?? historyRes.error;
  if (err) return { ok: false, error: err };
  const pairRow = pairRes.data as DbPairRow | null;
  if (!pairRow) return { ok: false, error: new Error("pair not found") };

  const members: Member[] = ((membersRes.data ?? []) as unknown as {
    user_id: string;
    users: { display_name: string; color: string } | null;
  }[]).map((m) => ({
    id: m.user_id,
    name: m.users?.display_name ?? "Me",
    color: m.users?.color ?? "#F97316",
  }));

  const items = ((itemsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    text: String(r.text),
    note: (r.note as string | null) ?? undefined,
    createdBy: String(r.created_by),
    createdByName: String(r.created_by_name),
    createdAt: toIso(r.created_at as string) ?? new Date().toISOString(),
    dueAt: toIso(r.due_at as string | null),
    recurring: (r.recurring as Pair["items"][number]["recurring"]) ?? null,
    completed: Boolean(r.completed),
    completedBy: r.completed_by ? String(r.completed_by) : null,
    completedAt: r.completed_at ? toIso(r.completed_at as string) : null,
    labels: Array.isArray(r.labels) ? (r.labels as number[]) : [],
    pinned: Boolean(r.pinned),
    attachments: (r.attachments as Pair["items"][number]["attachments"]) ?? [],
    comments: (r.comments as Pair["items"][number]["comments"]) ?? [],
    checkin: (r.checkin as Pair["items"][number]["checkin"]) ?? null,
    reminded: Boolean(r.reminded),
  }));

  const history: HistoryEntry[] = ((historyRes.data ?? []) as Record<string, unknown>[]).map(
    (r) => ({
      id: String(r.id),
      at: toIso(r.at as string) ?? new Date().toISOString(),
      actorId: r.actor_id ? String(r.actor_id) : "sys",
      actorName: String(r.actor_name),
      verb: String(r.verb),
      detail: String(r.detail),
    })
  );

  return {
    ok: true,
    pair: {
      code: pairRow.code,
      name: pairRow.name,
      createdAt: toIso(pairRow.created_at) ?? new Date().toISOString(),
      members,
      items,
      history,
      rev: pairRow.rev,
    },
  };
}

/** ---------- pair writes ---------- */

export async function dbCreatePair(
  code: string,
  name: string,
  actor: Member
): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  // Plain inserts: only ever called for a fresh pair, and PostgREST's upsert
  // path hits RLS (no UPDATE policies on these tables) even with
  // ignoreDuplicates — so insert it is.
  const { error: e1 } = await supabase.from("pairs").insert({
    code,
    name: name.slice(0, 40),
    rev: 1,
  });
  if (e1) return { ok: false, error: e1 };
  const { error: e2 } = await supabase.from("pair_members").insert({
    pair_code: code,
    user_id: actor.id,
  });
  if (e2) return { ok: false, error: e2 };
  const { error: e3 } = await supabase.from("history").insert({
    pair_code: code,
    actor_id: actor.id,
    actor_name: actor.name,
    verb: "created",
    detail: "this pair",
  });
  return { ok: !e3, error: e3 };
}

export async function dbJoinPair(
  code: string,
  actor: Member
): Promise<{ ok: true } | { ok: false; error?: unknown; reason?: "not_found" | "full" }> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc("join_pair", { pair_code: code });
  if (error) return { ok: false, error };
  if (data !== "ok") return { ok: false, reason: data as "not_found" | "full" };
  const { error: e2 } = await supabase.from("history").insert({
    pair_code: code,
    actor_id: actor.id,
    actor_name: actor.name,
    verb: "joined",
    detail: "the pair",
  });
  return { ok: !e2, error: e2 };
}

/** Ensure the given member row exists for the pair (idempotent). Repairs the
 *  broken-seed state where the pair row landed but the creator's membership
 *  insert failed (e.g. an RLS hiccup at create time). */
export async function dbEnsureMember(
  code: string,
  member: Member
): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const { error } = await supabase.from("pair_members").insert({
    pair_code: code,
    user_id: member.id,
  });
  // A duplicate-key race (two devices healing at once) is fine — it means
  // the membership already exists.
  const isDup = (error as { code?: string } | null)?.code === "23505";
  return { ok: !error || isDup, error: isDup ? undefined : error };
}

export async function dbUpsertUser(actor: Member): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const { error } = await supabase.from("users").upsert(
    { id: actor.id, display_name: actor.name, color: actor.color },
    { onConflict: "id" }
  );
  return { ok: !error, error };
}

export async function dbPushHistory(
  code: string,
  entry: HistoryEntry
): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const { error } = await supabase.from("history").insert({
    pair_code: code,
    actor_id: entry.actorId === "sys" ? null : entry.actorId,
    actor_name: entry.actorName,
    verb: entry.verb,
    detail: entry.detail.slice(0, 500),
    at: new Date(entry.at).toISOString(),
  });
  return { ok: !error, error };
}

/** ---------- item writes (full-row JSON for jsonb columns) ---------- */

export type ItemPatch = Partial<{
  text: string;
  note: string | null;
  due_at: string | null;
  recurring: "daily" | "weekly" | null;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  labels: number[];
  pinned: boolean;
  attachments: unknown;
  comments: unknown;
  checkin: unknown;
  reminded: boolean;
}>;

export async function dbInsertItem(
  code: string,
  item: Pair["items"][number]
): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const { error } = await supabase.from("items").insert({
    id: item.id,
    pair_code: code,
    text: item.text.slice(0, 200),
    note: item.note ?? null,
    created_by: item.createdBy,
    created_by_name: item.createdByName.slice(0, 30),
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
  });
  return { ok: !error, error };
}

export async function dbUpdateItem(
  id: string,
  patch: ItemPatch
): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const { error } = await supabase.from("items").update(patch).eq("id", id);
  return { ok: !error, error };
}

export async function dbDeleteItem(id: string): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  return { ok: !error, error };
}

/** Guarded reminder firing: only un-reminded, due, incomplete items. */
export async function dbFireReminders(
  code: string,
  now: Date
): Promise<{ ok: boolean; error?: unknown }> {
  const supabase = getClient();
  const checkin = { firedAt: now.toISOString(), responses: {} };
  const { error } = await supabase
    .from("items")
    .update({ reminded: true, checkin })
    .eq("pair_code", code)
    .eq("reminded", false)
    .eq("completed", false)
    .lte("due_at", now.toISOString());
  return { ok: !error, error };
}

/** ---------- realtime ---------- */

export function subscribeRealtime(
  code: string,
  onRefresh: () => void
): () => void {
  const supabase = getClient();
  const channel = supabase
    .channel(`pair-${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "items", filter: `pair_code=eq.${code}` },
      () => onRefresh()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "history", filter: `pair_code=eq.${code}` },
      () => onRefresh()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pair_members", filter: `pair_code=eq.${code}` },
      () => onRefresh()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel).catch(() => {});
  };
}

