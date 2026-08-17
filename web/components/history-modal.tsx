"use client";

import {
  BellRing,
  Check,
  Clock,
  MessageCircle,
  Paperclip,
  PartyPopper,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Repeat,
  RotateCcw,
  Sparkles,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { HistoryEntry, Member } from "@/lib/types";
import { initials, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";

const VERB_ICONS: Record<string, LucideIcon> = {
  created: Sparkles,
  joined: UserPlus,
  added: Plus,
  edited: Pencil,
  deleted: Trash2,
  reopened: RotateCcw,
  rescheduled: Repeat,
  "checked-in": PartyPopper,
  completed: Check,
  snoozed: Clock,
  reminded: BellRing,
  commented: MessageCircle,
  attached: Paperclip,
  pinned: Pin,
  unpinned: PinOff,
};

export function HistoryModal({
  open,
  history,
  members,
  onClose,
}: {
  open: boolean;
  history: HistoryEntry[];
  members: Member[];
  onClose: () => void;
}) {
  const colorOf = (id: string) => members.find((m) => m.id === id)?.color ?? "#78716C";

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-black">Activity history</h2>
      <p className="mb-4 text-[13px] text-ink-soft">
        What’s happened on this list, newest first.
      </p>
      <div className="flex max-h-[380px] flex-col gap-2.5 overflow-y-auto">
        {history.length === 0 && (
          <p className="text-[14px] text-ink-faint">Nothing yet — add your first note!</p>
        )}
        {history.map((h) => {
          const Icon = VERB_ICONS[h.verb] ?? Sparkles;
          return (
            <div key={h.id} className="flex items-start gap-2.5 text-[13.5px]">
              <Avatar initials={initials(h.actorName)} size="sm" color={colorOf(h.actorId)} />
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
              <div className="min-w-0">
                <span className="break-words">
                  <span className="font-bold">{h.actorName}</span> {h.verb}{" "}
                  <span className="font-bold">{h.detail}</span>
                </span>
                <div className="text-[11.5px] text-ink-faint">{timeAgo(h.at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          className="rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-bold hover:border-brand"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
