"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import * as store from "@/lib/pair-store";
import { getActiveCode, getActivePair, getUser, getVersion, subscribe } from "@/lib/pair-store";
import type { Item, Member } from "@/lib/types";
import { initials, timeAgo } from "@/lib/format";
import { initSoundUnlock, isSoundMuted, playSound, setSoundMuted } from "@/lib/sounds";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Heart,
  History,
  LayoutGrid,
  MessageCircle,
  PartyPopper,
  Pencil,
  Pin,
  Plus,
  QrCode,
  Repeat,
  RotateCcw,
  Sprout,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Volume2,
  VolumeX,
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
  | { kind: "delete-section"; name: string }
  | { kind: "delete-pair"; code: string; name: string }
  | { kind: "qr" }
  | null;

export default function PairListPage() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const router = useRouter();
  const user = getUser();
  const pair = getActivePair();
  const code = getActiveCode();
  const unread = store.getUnreadCount();

  const [modal, setModal] = useState<ModalState>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  // Which card's comment section is expanded — one at a time, so opening one
  // card never leaves another card's comments hanging open.
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  // Active sub-list ("section") inside this code; null = everything.
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  // QR of the join link — generated lazily when the modal opens.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // Confetti burst for the "everything done" celebration; key forces a fresh
  // burst per celebration.
  const [confettiKey, setConfettiKey] = useState(0);
  // Render-time clock snapshot (kept out of render for React purity; the
  // store re-renders the header often enough that staleness is invisible).
  const [nowMs] = useState(() => Date.now());
  // Hydration gate: the server prerenders this page empty (no localStorage),
  // so the client must agree on that first render — otherwise React logs a
  // hydration mismatch every time a returning user loads /app. After the
  // client has hydrated, a deferred notify flips this to true.
  const mounted = useHydrated();
  const autoOpened = useRef<string | null>(null);
  const prevMemberIds = useRef<string[] | null>(null);
  const prevOpenCount = useRef<number | null>(null);

  useEffect(() => {
    if (mounted && (!user || !pair)) router.replace("/");
  }, [user, pair, router, mounted]);

  /* Sound unlock + persisted mute state (see lib/sounds.ts). */
  useEffect(() => {
    const t = setTimeout(() => setSoundOn(!isSoundMuted()), 0);
    const unlock = initSoundUnlock();
    return () => {
      clearTimeout(t);
      unlock();
    };
  }, []);

  /* F4 — reminder loop: fire due items every 10s (in-app + browser). */
  useEffect(() => {
    const tick = () => {
      const fired = store.checkDue();
      for (const item of fired) {
        playSound("due");
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

  /* Celebrate the moment the list hits zero open notes — the "we did it"
     beat. Fires only on the 1→0 transition (never on load of an already
     clear list, and not for empty lists). Keyed on the COUNT, not the pair
     object: mutate() edits the pair in place, so its identity never changes
     and an object-keyed effect would never re-run for local mutations. */
  const openCount = pair ? pair.items.filter((i) => !i.completed).length : 0;
  const listSize = pair?.items.length ?? 0;
  useEffect(() => {
    const prev = prevOpenCount.current;
    prevOpenCount.current = openCount;
    if (listSize > 0 && prev !== null && prev > 0 && openCount === 0) {
      playSound("party");
      setConfettiKey((k) => k + 1);
      toast(
        <span className="inline-flex items-center gap-2">
          <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Everything done!</strong> The whole list is clear 🎉
          </span>
        </span>
      );
    }
  }, [openCount, listSize]);

  /* Render the join-link QR when (and only while) the modal is open. */
  useEffect(() => {
    if (modal?.kind !== "qr") return;
    const url = `${window.location.origin}/join/${code}`;
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: "#1c1917", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [modal?.kind, code]);

  /* Celebrate any new member joining (pair 2nd member, or group additions). */
  useEffect(() => {
    if (!pair) return;
    const prev = prevMemberIds.current;
    if (prev && pair.members.length > prev.length) {
      const joined = pair.members.find((m) => !prev.includes(m.id));
      if (joined)
        toast(
          <span className="inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {joined.name} joined the list.
          </span>
        );
    }
    prevMemberIds.current = pair.members.map((m) => m.id);
  }, [pair]);

  /* Partner activity: when the other device adds, comments on, completes,
     edits, or deletes something, toast it and (if allowed) notify the OS.
     Joins are covered by the member-count effect above. */
  useEffect(() => {
    return store.subscribePartnerEvents((events) => {
      for (const ev of events) {
        if (ev.kind === "joined") continue;
        if (ev.kind === "comment") playSound("comment");
        else if (ev.kind === "added") playSound("added");
        const { icon, text } = partnerEventCopy(ev);
        toast(
          <span className="inline-flex items-center gap-2">
            <span className="shrink-0 text-brand" aria-hidden="true">
              {icon}
            </span>
            {text}
          </span>
        );
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Marsky", { body: text, icon: "/icon.svg" });
        }
      }
    });
  }, []);

  if (!mounted || !user || !pair || !code) return null; // redirecting (or pre-hydration)

  const you: Member =
    pair.members.find((m) => m.id === user.id) ?? {
      id: user.id,
      name: user.name,
      color: user.color,
    };
  const allLists = store.getPairs();
  const switcherLists = Object.values(allLists)
    .filter((p) => p.members.some((m) => m.id === user.id))
    .sort((a, b) => (a.code === code ? -1 : b.code === code ? 1 : 0));

  const items = [...pair.items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const doneThisWeek = items.filter(
    (i) => i.completedAt && nowMs - new Date(i.completedAt).getTime() < 7 * 86_400_000
  ).length;
  const pinned = items.filter((i) => i.pinned && !i.completed).slice(0, 6);
  const sections = pair.sections ?? [];
  // A section picked on one list must not filter another list — clamp to the
  // active pair's own sections.
  const effectiveSection =
    activeSection && sections.includes(activeSection) ? activeSection : null;
  const visibleItems = effectiveSection
    ? items.filter((i) => i.section === effectiveSection)
    : items;

  const commitSection = () => {
    const name = newSectionName.trim();
    setAddingSection(false);
    setNewSectionName("");
    if (!name) return;
    const res = store.addSection(code, you, name);
    if (!res.ok) {
      toast(
        res.error === "duplicate"
          ? "You already have a list with that name"
          : res.error === "limit"
            ? "List limit reached (8 per code)"
            : "Enter a name for the list"
      );
      return;
    }
    setActiveSection(name);
    toast(
      <span className="inline-flex items-center gap-2">
        <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
        “{name}” created — everyone with this code sees it
      </span>
    );
  };

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
        assignee: input.assignee ?? null,
      });
      toast(
        <span className="inline-flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          Saved
        </span>
      );
      setEditing(null);
    } else {
      const item = store.addItem(code, you, {
        ...input,
        section: effectiveSection ?? undefined,
      });
      if (item)
        toast(
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Added — live for everyone on the list
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
          Everyone did it!
        </span>
      );
      setModal(null);
    }
  };

  const onSnooze = (minutes: number) => {
    if (!modalItem) return;
    store.snooze(code, modalItem.id, you, minutes);
    const when =
      minutes >= 1440
        ? "tomorrow"
        : minutes >= 60
          ? `in ${minutes / 60} h`
          : `in ${minutes} min`;
    const at = new Date(Date.now() + minutes * 60_000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    toast(
      <span className="inline-flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Snoozed — reminds everyone again {when} ({at})
      </span>
    );
    setModal(null);
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    toast(
      <span className="inline-flex items-center gap-2">
        <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
        List code <strong>{code}</strong> copied
      </span>
    );
  };

  const openNotifications = () => {
    store.clearUnread(); // viewing marks everything as read
    setNotifsOpen((o) => !o);
    // Ask once for OS-level notifications only while the choice is open;
    // granted/denied states skip the prompt and just open the panel.
    if (typeof Notification === "undefined") {
      toast("This browser doesn’t support OS notifications — they’ll show here instead");
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        toast(
          <span className="inline-flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
            {p === "granted"
              ? "Notifications on — reminders and list updates reach you even in another tab"
              : p === "denied"
                ? "Notifications blocked in this browser — updates still show here"
                : "Notifications stay off — updates still show here"}
          </span>
        );
      });
    }
  };

  const recent = store.getRecentEvents();

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
        Deleted for everyone on the list
      </span>
    );
    setModal(null);
  };

  const confirmDeleteSection = () => {
    if (modal?.kind !== "delete-section") return;
    const name = modal.name;
    store.removeSection(code, you, name);
    if (activeSection === name) setActiveSection(null);
    setModal(null);
    toast(
      <span className="inline-flex items-center gap-2">
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        “{name}” removed — its notes moved back to Everything
      </span>
    );
  };

  const confirmDeletePair = () => {
    if (modal?.kind !== "delete-pair") return;
    const targetCode = modal.code;
    store.deletePair(targetCode);
    setModal(null);
    toast(
      <span className="inline-flex items-center gap-2">
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        List deleted for everyone
      </span>
    );
    // The store switched the active list; if no list is left, leave /app.
    if (!getActiveCode()) router.push("/");
  };

  /* ---------- render ---------- */

  return (
    <div className="flex flex-1">
      {/* Amber brand rail — the reference layout's signature (Dribbble 14770965) */}
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col bg-panel lg:flex">
        <div className="flex items-center gap-3 px-7 pt-7">
          <Logo size={38} />
          <div>
            <p className="text-[19px] font-black leading-none tracking-[-0.3px] text-[var(--on-panel)]">
              Marsky
            </p>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--on-panel-soft)]">
              {pair.members.length === 1
                ? "One list · just you"
                : pair.members.length === 2
                  ? "One list · two people"
                  : `One list · ${pair.members.length} people`}
            </p>
          </div>
        </div>

        <nav className="mt-9 px-4" aria-label="List views">
          <div className="flex items-center justify-between rounded-[12px] bg-[var(--on-panel-field)] px-4 py-3 text-[var(--on-panel)]">
            <span className="flex items-center gap-2.5 text-[14.5px] font-extrabold">
              <LayoutGrid className="h-[18px] w-[18px]" aria-hidden="true" />
              All notes
            </span>
            <span className="rounded-full bg-[var(--rail-chip)] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[var(--on-panel)]">
              {items.length}
            </span>
          </div>
          {pinned.length > 0 && (
            <button
              className="mt-1 flex w-full items-center gap-2.5 rounded-[12px] px-4 py-3 text-[14.5px] font-extrabold text-[var(--on-panel-soft)] transition-colors hover:bg-[var(--on-panel-field)] hover:text-[var(--on-panel)]"
              onClick={() =>
                pinned[0] &&
                document
                  .getElementById(pinned[0].id)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              <Pin className="h-[18px] w-[18px]" aria-hidden="true" />
              Pinned
              <span className="ml-auto rounded-full bg-[var(--on-panel-field)] px-2 py-0.5 text-[11px] font-extrabold tabular-nums">
                {pinned.length}
              </span>
            </button>
          )}
        </nav>

        <div className="mt-auto">
          {/* Your lists — switch across every pair/group you belong to */}
          {switcherLists.length > 0 && (
            <div className="px-4 pb-4">
              <p className="px-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--on-panel-soft)]">
                Your lists
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {switcherLists.map((p) => (
                  <span key={p.code} className="group relative block">
                    <button
                      onClick={() => {
                        if (p.code !== code && store.setActiveCode(p.code)) {
                          toast(
                            <span className="inline-flex items-center gap-2">
                              <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                              Switched to <strong>{p.name || "untitled list"}</strong>
                            </span>
                          );
                        }
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-extrabold transition-colors ${
                        p.code === code
                          ? "bg-[var(--on-panel-field)] text-[var(--on-panel)]"
                          : "text-[var(--on-panel-soft)] hover:bg-[var(--on-panel-field)] hover:text-[var(--on-panel)]"
                      }`}
                      aria-current={p.code === code ? "true" : undefined}
                    >
                      {p.kind === "group" ? (
                        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Heart className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {p.name || (p.kind === "group" ? "Untitled group" : "Untitled pair")}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--rail-chip)] px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-[var(--on-panel)] opacity-100 transition-opacity group-hover:opacity-0">
                        {p.members.length}
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        setModal({
                          kind: "delete-pair",
                          code: p.code,
                          name: p.name || (p.kind === "group" ? "Untitled group" : "Untitled pair"),
                        })
                      }
                      aria-label={`Delete list ${p.name || p.code}`}
                      title="Delete this list for everyone"
                      className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-transparent text-[var(--on-panel-soft)] opacity-0 transition-all hover:bg-[var(--rail-chip-hover)] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => router.push("/?new=1")}
                  className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-extrabold text-brand-light transition-colors hover:bg-[var(--on-panel-field)]"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  New list…
                </button>
              </div>
            </div>
          )}

          <div className="px-6 pb-7">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--on-panel-soft)]">
              This list
            </p>
            <div className="mt-2.5 rounded-[16px] bg-[var(--on-panel-field)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[19px] font-extrabold tracking-[3px] text-[var(--on-panel)]">
                  {code}
                </span>
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--rail-chip)] text-[var(--on-panel)] transition-colors hover:bg-[var(--rail-chip-hover)]"
                  onClick={() => setModal({ kind: "qr" })}
                  title="Show QR code to join"
                  aria-label="Show QR code to join"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--rail-chip)] text-[var(--on-panel)] transition-colors hover:bg-[var(--rail-chip-hover)]"
                  onClick={copyCode}
                  title="Copy list code"
                  aria-label="Copy list code"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex items-center">
                {pair.members.slice(0, 5).map((m, i) => (
                  <Avatar
                    key={m.id}
                    initials={initials(m.name)}
                    color={m.color}
                    you={m.id === user.id}
                    className={i > 0 ? "-ml-2.5" : ""}
                  />
                ))}
                {pair.members.length > 5 && (
                  <span className="-ml-2.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--on-panel-line)] bg-[var(--on-panel-field)] text-[11px] font-extrabold text-[var(--on-panel)]">
                    +{pair.members.length - 5}
                  </span>
                )}
                {pair.members.length === 1 && (
                  <span className="-ml-2.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--on-panel-line)] bg-[var(--on-panel-field)] text-[13px] font-extrabold text-[var(--on-panel)]">
                    ?
                  </span>
                )}
              </div>
              <p className="text-[12px] font-bold leading-[1.35] text-[var(--on-panel-soft)]">
                {pair.members.length > 1
                  ? `${pair.members.length} members — reminders reach everyone`
                  : "Share the code so people can join"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column: the floating white canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col bg-canvas lg:my-5 lg:rounded-[26px] lg:shadow-[var(--shadow-canvas)]">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-canvas/92 px-4 py-3 backdrop-blur-md sm:px-6 lg:rounded-t-[26px]">
            <div className="flex items-center gap-2 font-black text-brand-dark dark:text-brand-light lg:hidden">
              <Logo size={26} />
              Marsky
            </div>
        <button
          onClick={copyCode}
          className="rounded-lg bg-brand-soft px-2.5 py-1 font-mono text-[12px] font-extrabold tracking-[1.5px] text-brand-dark transition-colors hover:bg-brand-soft/70 dark:text-brand-light lg:hidden"
          title="Copy list code"
        >
          {code}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[1.5px] border-line bg-card text-ink-soft hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundMuted(!next);
              if (next) playSound("added"); // confirm with a chime
            }}
            title={soundOn ? "Mute notification sounds" : "Unmute notification sounds"}
            aria-label={soundOn ? "Mute notification sounds" : "Unmute notification sounds"}
            aria-pressed={soundOn}
          >
            {soundOn ? (
              <Volume2 className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
          <div className="relative">
            <button
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[1.5px] border-line bg-card text-ink-soft hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
              onClick={openNotifications}
              title={
                unread > 0
                  ? `${unread} unread update${unread === 1 ? "" : "s"} from your list`
                  : "Notifications & list activity"
              }
              aria-label="Notifications"
              aria-expanded={notifsOpen}
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
              {unread > 0 && (
                <span
                  className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold leading-none text-white"
                  aria-label={`${unread} unread updates`}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {notifsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifsOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[300px] overflow-hidden rounded-[14px] border-[1.5px] border-line bg-card shadow-toast">
                  <div className="border-b border-line px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[.6px] text-ink-soft">
                    List activity
                  </div>
                  <div className="max-h-[280px] overflow-y-auto py-1">
                    {recent.length === 0 ? (
                      <p className="px-4 py-4 text-[13px] leading-[1.5] text-ink-soft">
                        Nothing yet — when someone adds, comments, or edits a note, it
                        shows up here.
                      </p>
                    ) : (
                      recent.map((r, i) => {
                        const { icon, text } = partnerEventCopy(r.event);
                        return (
                          <div key={i} className="flex items-start gap-2.5 px-4 py-2">
                            <span className="mt-0.5 shrink-0 text-brand" aria-hidden="true">
                              {icon}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] leading-[1.45]">{text}</p>
                              <p className="mt-0.5 text-[11px] text-ink-faint">{timeAgo(r.at)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[1.5px] border-line bg-card text-ink-soft hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
            onClick={() => setModal({ kind: "history" })}
            title="Activity history"
            aria-label="Activity history"
          >
            <History className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <div className="flex items-center">
            {pair.members.slice(0, 4).map((m, i) => (
              <Avatar
                key={m.id}
                initials={initials(m.name)}
                color={m.color}
                you={m.id === user.id}
                className={i > 0 ? "-ml-2.5" : ""}
              />
            ))}
            {pair.members.length > 4 && (
              <span className="avatar -ml-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-card bg-[#d6d3d1] text-[11px] font-extrabold text-[#78716C] dark:bg-[var(--card-2)] dark:text-[var(--ink-faint)]">
                +{pair.members.length - 4}
              </span>
            )}
            {pair.members.length === 1 && (
              <span className="avatar -ml-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-card bg-[#d6d3d1] text-[13px] font-extrabold text-[#78716C] dark:bg-[var(--card-2)] dark:text-[var(--ink-faint)]">
                ?
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        {/* Desktop canvas heading (mobile keeps the compact header) */}
        <div className="mb-4 hidden items-end justify-between lg:flex">
          <div>
            <h1 className="text-[24px] font-black leading-tight tracking-[-0.5px]">
              {pair.members.length > 1 ? pair.name || "Our list" : "Your list"}
            </h1>
            <p className="mt-0.5 text-[13.5px] font-semibold text-ink-soft">
              {items.filter((i) => !i.completed).length} open ·{" "}
              {items.filter((i) => i.completed).length} done
              {doneThisWeek > 0 ? ` · ${doneThisWeek} this week 🎉` : ""}
            </p>
          </div>
          <p className="text-[13px] font-semibold text-ink-faint">
            One list, together, zero nagging.
          </p>
        </div>
        {/* Invite banner (PRD §8.1) */}
        {pair.members.length === 1 && (
          <div className="mb-[18px] flex flex-wrap items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-brand bg-brand-soft px-4 py-3 text-[14px]">
            <span>
              Your list code is{" "}
              <strong className="font-mono text-brand-dark dark:text-brand-light">
                {code}
              </strong>{" "}
              — share it so people can join.
            </span>
            <button
              className="ml-auto rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-white hover:bg-brand-dark"
              onClick={copyCode}
            >
              Copy
            </button>
            <button
              className="rounded-full border-[1.5px] border-brand px-3 py-1.5 text-[13px] font-bold text-brand-dark hover:bg-brand-soft dark:text-brand-light"
              onClick={() => setModal({ kind: "qr" })}
            >
              Show QR
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

        {/* Sub-lists ("sections") — all share this one code, so partners see
            every list here without entering another code. */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSection(null)}
            className={`flex h-8 items-center rounded-full border-[1.5px] px-3.5 text-[12.5px] font-extrabold transition-colors ${
              activeSection === null
                ? "border-brand bg-brand text-white"
                : "border-line bg-card text-ink-soft hover:border-brand"
            }`}
          >
            Everything
          </button>
          {sections.map((s) => {
            const count = items.filter((i) => i.section === s && !i.completed).length;
            const active = activeSection === s;
            return (
              <span key={s} className="inline-flex items-stretch">
                <button
                  onClick={() => setActiveSection(active ? null : s)}
                  className={`flex h-8 items-center gap-1.5 rounded-l-full border-[1.5px] border-r-0 pl-3.5 pr-2.5 text-[12.5px] font-extrabold transition-colors ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-card text-ink-soft hover:border-brand"
                  }`}
                >
                  <span className="max-w-[140px] truncate">{s}</span>
                  <span
                    className={`rounded-full px-1.5 text-[10.5px] tabular-nums ${
                      active ? "bg-white/25" : "bg-canvas-2"
                    }`}
                  >
                    {count}
                  </span>
                </button>
                <button
                  onClick={() => setModal({ kind: "delete-section", name: s })}
                  title={`Delete “${s}” — its notes move back to Everything`}
                  aria-label={`Delete list ${s}`}
                  className={`flex h-8 w-6 items-center justify-center rounded-r-full border-[1.5px] text-[14px] font-black leading-none transition-colors ${
                    active
                      ? "border-brand bg-brand text-white hover:bg-danger"
                      : "border-line bg-card text-ink-faint hover:border-danger hover:text-danger"
                  }`}
                >
                  ×
                </button>
              </span>
            );
          })}
          {addingSection ? (
            <input
              autoFocus
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onBlur={commitSection}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSection();
                if (e.key === "Escape") {
                  setAddingSection(false);
                  setNewSectionName("");
                }
              }}
              maxLength={24}
              placeholder="List name…"
              className="h-8 w-40 rounded-full border-[1.5px] border-brand bg-card px-3.5 text-[12.5px] font-bold outline-none"
            />
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              className="flex h-8 items-center gap-1 rounded-full border-[1.5px] border-dashed border-line px-3.5 text-[12.5px] font-extrabold text-ink-soft transition-colors hover:border-brand hover:text-brand"
              title="New sub-list — same code, everyone sees it"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New list
            </button>
          )}
        </div>

        <ComposeBar
          key={editing ? editing.id : "compose-new"}
          editing={editing}
          members={pair.members}
          onSubmit={onSubmit}
          onCancel={() => setEditing(null)}
        />

        {visibleItems.length === 0 ? (
          <div className="px-5 py-14 text-center text-ink-soft">
            <Sprout className="mx-auto h-11 w-11 text-ink-faint" aria-hidden="true" />
            <p className="mt-3 leading-[1.6]">
              {activeSection
                ? `Nothing in “${activeSection}” yet. Add your first note above —`
                : "No notes yet. Add your first shared note above —"}
              <br />
              it’ll appear for everyone instantly.
            </p>
          </div>
        ) : (
          /* Masonry via CSS columns: cards pack into columns with no row
             alignment, so a card growing (comments open) never leaves gaps
             next to its neighbors. */
          <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
            {visibleItems.map((item) => (
              <div key={item.id} id={item.id} className="mb-3 min-w-0 break-inside-avoid">
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
                  commentsOpen={openCommentsId === item.id}
                  onToggleComments={() =>
                    setOpenCommentsId(openCommentsId === item.id ? null : item.id)
                  }
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
          This removes “{deleteItem?.text}” from your shared list — for everyone.
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

      <Modal open={modal?.kind === "delete-section"} onClose={() => setModal(null)}>
        <h2 className="text-[20px] font-black">Delete list?</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
          This removes “{modal?.kind === "delete-section" ? modal.name : ""}” for everyone on the
          code. Its notes are not deleted — they move back to Everything.
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
            onClick={confirmDeleteSection}
          >
            Delete list
          </button>
        </div>
      </Modal>

      <Modal open={modal?.kind === "delete-pair"} onClose={() => setModal(null)}>
        <h2 className="text-[20px] font-black">Delete list?</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
          “{modal?.kind === "delete-pair" ? modal.name : ""}” and all its notes are permanently
          removed for everyone on the code. This cannot be undone.
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
            onClick={confirmDeletePair}
          >
            Delete list
          </button>
        </div>
      </Modal>

      <Modal open={modal?.kind === "qr"} onClose={() => setModal(null)}>
        <h2 className="text-[20px] font-black">Scan to join</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
          Point a phone camera at the code — it opens <strong>{code}</strong> with
          the name prompt ready.
        </p>
        <div className="mt-4 flex justify-center rounded-[16px] bg-white p-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR code to join list ${code}`} width={240} height={240} />
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center text-[14px] text-ink-faint">
              Generating…
            </div>
          )}
        </div>
        <button
          className="mt-4 w-full truncate rounded-full border-[1.5px] border-line bg-card px-4 py-2.5 text-[13px] font-bold text-ink-soft hover:border-brand"
          onClick={() => {
            navigator.clipboard
              ?.writeText(`${window.location.origin}/join/${code}`)
              .catch(() => {});
            toast("Join link copied");
          }}
          title="Copy the join link"
        >
          {typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : ""}
        </button>
      </Modal>

      <div id="compose-top" className="sr-only" aria-hidden="true" />
      <ConfettiBurst key={confettiKey} active={confettiKey > 0} />
      <Toasts />
        </div>
      </div>
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

/** One-shot celebration overlay: colored pieces rain down for ~3s, then the
 *  overlay unmounts itself. The parent remounts it per celebration (key=),
 *  which regenerates the random layout and restarts the animation. */
const CONFETTI_COLORS = ["#F97316", "#F59E0B", "#22C55E", "#3B82F6", "#A855F7", "#EF4444"];

function ConfettiBurst({ active }: { active: boolean }) {
  const [pieces] = useState(() =>
    Array.from({ length: 44 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.9,
      duration: 2.1 + Math.random() * 1.2,
      size: 7 + Math.random() * 7,
      drift: (Math.random() - 0.5) * 160,
      round: Math.random() < 0.4,
    }))
  );
  // Visible from mount when active (the parent remounts per burst); the
  // effect only schedules the hide.
  const [visible, setVisible] = useState(active);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setVisible(false), 3600);
    return () => clearTimeout(t);
  }, [active]);
  if (!active || !visible) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      <style>{`@keyframes marskyConfetti {
        0% { transform: translate(0, -6vh) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--drift), 106vh) rotate(680deg); opacity: .85; }
      }`}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            backgroundColor: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animation: `marskyConfetti ${p.duration}s ${p.delay}s cubic-bezier(.25,.4,.6,1) forwards`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Icon + copy for a partner-activity event. */
function partnerEventCopy(ev: {
  kind: string;
  actorName: string;
  detail: string;
}): { icon: ReactNode; text: string } {
  const iconSize = "h-4 w-4";
  switch (ev.kind) {
    case "added":
      return {
        icon: <Plus className={iconSize} />,
        text: `${ev.actorName} added ${ev.detail}`,
      };
    case "assigned":
      return {
        icon: <UserRound className={iconSize} />,
        text: `${ev.actorName} assigned ${ev.detail}`,
      };
    case "comment":
      return {
        icon: <MessageCircle className={iconSize} />,
        text: `${ev.actorName} commented ${ev.detail}`,
      };
    case "joined":
      return {
        icon: <UserPlus className={iconSize} />,
        text: `${ev.actorName} joined the list`,
      };
    case "completed":
      return {
        icon: <Check className={iconSize} />,
        text: `${ev.actorName} completed ${ev.detail}`,
      };
    case "deleted":
      return {
        icon: <Trash2 className={iconSize} />,
        text: `${ev.actorName} deleted ${ev.detail}`,
      };
    case "edited":
      return {
        icon: <Pencil className={iconSize} />,
        text: `${ev.actorName} edited ${ev.detail}`,
      };
    case "reopened":
      return {
        icon: <RotateCcw className={iconSize} />,
        text: `${ev.actorName} reopened ${ev.detail}`,
      };
    case "snoozed":
      return {
        icon: <Clock className={iconSize} />,
        text: `${ev.actorName} snoozed ${ev.detail}`,
      };
    case "rescheduled":
      return {
        icon: <Repeat className={iconSize} />,
        text: `${ev.actorName} rescheduled ${ev.detail}`,
      };
    case "checkin":
      return {
        icon: <CheckCheck className={iconSize} />,
        text: `${ev.actorName} checked in ${ev.detail}`,
      };
    default:
      return {
        icon: <Bell className={iconSize} />,
        text: `${ev.actorName} updated ${ev.detail}`,
      };
  }
}
