"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as store from "@/lib/pair-store";
import { getActiveCode, getActivePair, getUser, getVersion, subscribe } from "@/lib/pair-store";
import type { Item, Member } from "@/lib/types";
import { initials } from "@/lib/format";
import {
  Bell,
  Check,
  Clock,
  Copy,
  History,
  PartyPopper,
  Pin,
  Plus,
  Sprout,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { ItemCard } from "@/components/item-card";
import { ComposeBar, type ComposeInput } from "@/components/compose-bar";
import { CheckinModal } from "@/components/checkin-modal";
import { HistoryModal } from "@/components/history-modal";
import { Modal } from "@/components/modal";
import { toast, Toasts } from "@/components/toast";

type ModalState =
  | { kind: "checkin"; itemId: string }
  | { kind: "history" }
  | { kind: "delete"; itemId: string }
  | null;

export default function PairListPage() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const router = useRouter();
  const user = getUser();
  const pair = getActivePair();
  const code = getActiveCode();

  const [modal, setModal] = useState<ModalState>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  // Hydration gate: the server prerenders this page empty (no localStorage),
  // so the client must agree on that first render — otherwise React logs a
  // hydration mismatch every time a returning user loads /app. After the
  // client has hydrated, a deferred notify flips this to true.
  const mounted = useHydrated();
  const autoOpened = useRef<string | null>(null);
  const prevMembers = useRef(0);

  useEffect(() => {
    if (mounted && (!user || !pair)) router.replace("/");
  }, [user, pair, router, mounted]);

  /* F4 — reminder loop: fire due items every 10s (in-app + browser). */
  useEffect(() => {
    const tick = () => {
      const fired = store.checkDue();
      for (const item of fired) {
        toast(
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>“{item.text}”</strong> — done?
            </span>
          </span>
        );
        setModal({ kind: "checkin", itemId: item.id });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Marsky", {
            body: `"${item.text}" — done?`,
            icon: "/icon.svg",
          });
        }
      }
    };
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  /* Auto-open check-ins broadcast by the partner tab (F5). */
  const pendingCheckin =
    pair && user
      ? pair.items.find(
          (i) => i.checkin && !i.completed && !i.checkin!.responses[user.id]
        ) ?? null
      : null;
  useEffect(() => {
    if (pendingCheckin && autoOpened.current !== pendingCheckin.id) {
      autoOpened.current = pendingCheckin.id;
      setModal({ kind: "checkin", itemId: pendingCheckin.id });
    }
  }, [pendingCheckin]);

  /* Celebrate a partner joining (PRD §8.1 step 4). */
  useEffect(() => {
    if (!pair) return;
    if (prevMembers.current === 1 && pair.members.length === 2) {
      const joined = pair.members.find((m) => m.id !== user?.id);
      if (joined)
        toast(
          <span className="inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {joined.name} joined — you’re now a pair.
          </span>
        );
    }
    prevMembers.current = pair.members.length;
  }, [pair, user?.id]);

  if (!mounted || !user || !pair || !code) return null; // redirecting (or pre-hydration)

  const you: Member =
    pair.members.find((m) => m.id === user.id) ?? {
      id: user.id,
      name: user.name,
      color: user.color,
    };
  const partner = pair.members.find((m) => m.id !== user.id);

  const items = [...pair.items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const pinned = items.filter((i) => i.pinned && !i.completed).slice(0, 6);

  const modalItem =
    modal?.kind === "checkin" ? pair.items.find((i) => i.id === modal.itemId) ?? null : null;
  const deleteItem =
    modal?.kind === "delete" ? pair.items.find((i) => i.id === modal.itemId) : null;

  /* ---------- handlers ---------- */

  const onSubmit = (input: ComposeInput) => {
    if (editing) {
      store.updateItem(code, editing.id, you, {
        text: input.text,
        note: input.note,
        dueAt: input.dueAt,
        recurring: input.recurring,
        labels: input.labels,
      });
      toast(
        <span className="inline-flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          Saved
        </span>
      );
      setEditing(null);
    } else {
      const item = store.addItem(code, you, input);
      if (item)
        toast(
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Added — live for both of you
          </span>
        );
    }
  };

  const onAnswer = (answer: "yes" | "no") => {
    if (!modalItem) return;
    store.respondCheckin(code, modalItem.id, you, answer);
    const after = store.getActivePair()?.items.find((i) => i.id === modalItem.id);
    if (after?.completed) {
      toast(
        <span className="inline-flex items-center gap-2">
          <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
          You both did it!
        </span>
      );
      setModal(null);
    }
  };

  const onSnooze = () => {
    if (!modalItem) return;
    store.snooze(code, modalItem.id, you, 30);
    toast(
      <span className="inline-flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        Snoozed — will remind you both again in 30 min
      </span>
    );
    setModal(null);
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    toast(
      <span className="inline-flex items-center gap-2">
        <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
        Pair code <strong>{code}</strong> copied
      </span>
    );
  };

  const enableNotifications = () => {
    if (typeof Notification === "undefined") {
      toast("This browser doesn’t support notifications");
      return;
    }
    Notification.requestPermission().then((p) => {
      toast(
        <span className="inline-flex items-center gap-2">
          <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
          {p === "granted"
            ? "Notifications on — reminders reach you even in another tab"
            : p === "denied"
              ? "Notifications blocked in this browser"
              : "Notifications stay off until you allow them"}
        </span>
      );
    });
  };

  const simulatePartner = () => {
    const api = (window as unknown as Record<string, unknown>).__marskyDemo as
      | { join?: (n?: string) => unknown }
      | undefined;
    const m = api?.join?.("Maya") as { name?: string } | null | undefined;
    if (m)
      toast(
        <span className="inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          Demo: {m.name} joined
        </span>
      );
    else toast("Demo partner needs a code first — create a pair to start");
  };

  const confirmDelete = () => {
    if (!deleteItem) return;
    store.deleteItem(code, deleteItem.id, you);
    toast(
      <span className="inline-flex items-center gap-2">
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Deleted for both of you
      </span>
    );
    setModal(null);
  };

  /* ---------- render ---------- */

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/92 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2 font-black text-brand-dark dark:text-brand-light">
          <Logo size={26} />
          Marsky
        </div>
        <button
          onClick={copyCode}
          className="rounded-lg bg-brand-soft px-2.5 py-1 font-mono text-[12px] font-extrabold tracking-[1.5px] text-brand-dark transition-colors hover:bg-brand-soft/70 dark:text-brand-light"
          title="Copy pair code"
        >
          {code}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[1.5px] border-line bg-card text-ink-soft hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
            onClick={enableNotifications}
            title="Enable browser notifications"
            aria-label="Enable notifications"
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[1.5px] border-line bg-card text-ink-soft hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
            onClick={() => setModal({ kind: "history" })}
            title="Activity history"
            aria-label="Activity history"
          >
            <History className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <div className="flex items-center">
            <Avatar initials={initials(you.name)} color={you.color} you />
            {partner ? (
              <Avatar
                initials={initials(partner.name)}
                color={partner.color}
                className="-ml-2.5"
              />
            ) : (
              <span className="avatar -ml-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-card bg-[#d6d3d1] text-[13px] font-extrabold text-[#78716C] dark:bg-[var(--card-2)] dark:text-[var(--ink-faint)]">
                ?
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-24 pt-5">
        {/* Invite banner (PRD §8.1) */}
        {!partner && (
          <div className="mb-[18px] flex flex-wrap items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-brand bg-brand-soft px-4 py-3 text-[14px]">
            <span>
              Your pair code is{" "}
              <strong className="font-mono text-brand-dark dark:text-brand-light">
                {code}
              </strong>{" "}
              — share it so your partner can join.
            </span>
            <button
              className="ml-auto rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-white hover:bg-brand-dark"
              onClick={copyCode}
            >
              Copy
            </button>
            {process.env.NODE_ENV !== "production" && (
              <button
                className="rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-bold hover:border-brand"
                onClick={simulatePartner}
              >
                Simulate partner (dev)
              </button>
            )}
          </div>
        )}

        {/* Pinned quick access (F12) */}
        {pinned.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-2.5">
            {pinned.map((i) => (
              <button
                key={i.id}
                onClick={() =>
                  document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="flex max-w-[230px] shrink-0 items-center gap-2 rounded-[12px] border-[1.5px] border-line bg-card px-3 py-2 text-[13px] hover:border-brand"
              >
                <Pin className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                <span className="truncate">{i.text}</span>
              </button>
            ))}
          </div>
        )}

        <ComposeBar
          key={editing ? editing.id : "compose-new"}
          editing={editing}
          onSubmit={onSubmit}
          onCancel={() => setEditing(null)}
        />

        {items.length === 0 ? (
          <div className="px-5 py-14 text-center text-ink-soft">
            <Sprout className="mx-auto h-11 w-11 text-ink-faint" aria-hidden="true" />
            <p className="mt-3 leading-[1.6]">
              No notes yet. Add your first shared note above —<br />
              it’ll appear for both of you instantly.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <div key={item.id} id={item.id}>
                <ItemCard
                  item={item}
                  members={pair.members}
                  onToggle={() => store.toggleComplete(code, item.id, you)}
                  onOpenCheckin={() => setModal({ kind: "checkin", itemId: item.id })}
                  onComment={(text) => store.addComment(code, item.id, you, text)}
                  onTogglePin={() => store.togglePin(code, item.id, you)}
                  onEdit={() => {
                    setEditing(item);
                    document.getElementById("compose-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onDelete={() => setModal({ kind: "delete", itemId: item.id })}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <CheckinModal
        open={modal?.kind === "checkin" && !!modalItem}
        item={modalItem}
        pair={pair}
        you={you}
        onAnswer={onAnswer}
        onSnooze={onSnooze}
        onClose={() => setModal(null)}
      />

      <HistoryModal
        open={modal?.kind === "history"}
        history={pair.history}
        members={pair.members}
        onClose={() => setModal(null)}
      />

      <Modal open={modal?.kind === "delete" && !!deleteItem} onClose={() => setModal(null)}>
        <h2 className="text-[20px] font-black">Delete note?</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
          This removes “{deleteItem?.text}” from your shared list — for both of you.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            className="rounded-full border-[1.5px] border-line bg-card px-[18px] py-[10px] text-[15px] font-bold hover:border-brand"
            onClick={() => setModal(null)}
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-danger px-[18px] py-[10px] text-[15px] font-bold text-white transition-all hover:opacity-90 active:scale-[.97]"
            onClick={confirmDelete}
          >
            Delete
          </button>
        </div>
      </Modal>

      <div id="compose-top" className="sr-only" aria-hidden="true" />
      <Toasts />
    </div>
  );
}

/** Hydration-safe mount flag: false on the server and on the client's first
 *  (hydration) render, true after one deferred re-render post-mount. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const t = setTimeout(onStoreChange, 0);
      return () => clearTimeout(t);
    },
    () => true,
    () => false
  );
}
