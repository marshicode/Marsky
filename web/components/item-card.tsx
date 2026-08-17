"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  MessageCircle,
  Pencil,
  Pin,
  Repeat,
  Trash2,
} from "lucide-react";
import type { Item, Member } from "@/lib/types";
import { LABELS } from "@/lib/types";
import { dueState, fmtDue, initials, isImageUrl, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/avatar";

export function ItemCard({
  item,
  members,
  onToggle,
  onOpenCheckin,
  onComment,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  item: Item;
  members: Member[];
  onToggle: () => void;
  onOpenCheckin: () => void;
  onComment: (text: string) => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const memberOf = (id: string) => members.find((m) => m.id === id);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const state = dueState(item, now);

  const border =
    item.completed
      ? ""
      : state === "firing"
        ? "border-brand shadow-[0_0_0_3px_rgba(249,115,22,.18)]"
        : state === "late"
          ? "border-danger bg-[var(--overdue-fill)]"
          : state === "soon"
            ? "border-[#FDBA74]"
            : "";

  const dueText = (() => {
    if (!item.dueAt) return null;
    const diff = new Date(item.dueAt).getTime() - now;
    if (item.checkin) return "now — done?";
    if (diff < 0) {
      const h = Math.floor(-diff / 3_600_000);
      return h >= 1 ? `overdue ${h}h` : `overdue ${Math.max(1, Math.ceil(-diff / 60_000))}m`;
    }
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `in ${m}m`;
    return fmtDue(item.dueAt);
  })();

  const dueBadge = item.dueAt ? (
    <span
      className={`due-badge rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
        state === "firing"
          ? "bg-brand text-white"
          : state === "late"
            ? "bg-[var(--danger-fill)] text-danger"
            : state === "soon"
              ? "bg-[var(--warn-fill)] text-brand-dark dark:text-brand-light"
              : "border-[1.5px] border-line bg-bg"
      }`}
      onClick={item.checkin ? onOpenCheckin : undefined}
      style={state === "firing" ? { animation: "marskyPulse 1.2s infinite" } : undefined}
      role={item.checkin ? "button" : undefined}
      title={item.checkin ? "Open check-in" : undefined}
    >
      <Clock
        className={`h-3 w-3 ${state === "firing" ? "" : "mr-1"}`}
        aria-hidden="true"
      />
      {dueText}
    </span>
  ) : null;

  return (
    <article
      className={`rounded-[14px] border-[1.5px] bg-card p-3.5 shadow-[var(--shadow-card)] transition-colors ${
        item.completed ? "border-line opacity-60" : border
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
      className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 transition-all ${
        item.completed
          ? "border-ok bg-ok text-white"
          : "border-[var(--check-border)] bg-card hover:border-brand"
      }`}
      onClick={onToggle}
      aria-label={item.completed ? "Mark incomplete" : "Complete"}
      aria-pressed={item.completed}
    >
      {item.completed && (
        <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" />
      )}
    </button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[17px] font-bold leading-[1.35] ${
              item.completed ? "text-ink-soft line-through" : ""
            }`}
          >
            {item.text}
          </p>
          {item.note ? (
            <p className="mt-0.5 break-words text-[13px] text-ink-soft">{item.note}</p>
          ) : null}

          {/* attachments (F10) */}
          {item.attachments.length > 0 && (
            <div className="mt-2 flex flex-col items-start gap-1.5">
              {item.attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5">
                  {isImageUrl(a.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.name}
                      className="max-h-[60px] rounded-lg border-[1.5px] border-line"
                    />
                  ) : (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-bold text-brand-dark underline-offset-2 hover:underline dark:text-brand-light"
                    >
                      🔗 {a.name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* meta row: who-did-what + badges */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Avatar initials={initials(item.createdByName)} size="mini" color={memberOf(item.createdBy)?.color ?? "#78716C"} />
              <span>{item.createdByName} added</span>
            </span>
            {item.completed && item.completedBy ? (
              <>
                <span className="text-[var(--line)]">·</span>
                <span className="inline-flex items-center gap-1 font-bold text-ok">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  done by {memberOf(item.completedBy)?.name ?? "someone"}
                </span>
              </>
            ) : null}
            {dueBadge ? (
              <>
                <span className="text-[var(--line)]">·</span>
                {dueBadge}
              </>
            ) : null}
            {item.recurring ? (
              <span className="inline-flex items-center gap-1 font-bold text-[#A855F7]">
                <Repeat className="h-3 w-3" aria-hidden="true" />
                {item.recurring === "daily" ? "daily" : "weekly"}
              </span>
            ) : null}
            {item.labels.map((id) => {
              const label = LABELS.find((l) => l.id === id);
              if (!label) return null;
              return (
                <span
                  key={id}
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              );
            })}
            {item.comments.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {item.comments.length}
              </span>
            )}
          </div>
        </div>

        {/* actions */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <button
              className="mini rounded-lg px-1.5 py-1 text-ink-soft transition-colors hover:bg-bg"
              onClick={() => setShowComments((s) => !s)}
              aria-label="Comments"
              aria-expanded={showComments}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className={`mini rounded-lg px-1.5 py-1 transition-colors hover:bg-bg ${
                item.pinned ? "text-brand" : "text-ink-soft"
              }`}
              onClick={onTogglePin}
              aria-label={item.pinned ? "Unpin" : "Pin"}
              aria-pressed={item.pinned}
            >
              <Pin className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="mini rounded-lg px-1.5 py-1 text-ink-soft transition-colors hover:bg-bg"
              onClick={onEdit}
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="mini rounded-lg px-1.5 py-1 text-ink-soft transition-colors hover:bg-bg"
              onClick={onDelete}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* comments (F9) */}
      {showComments && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          {item.comments.map((c) => (
            <div key={c.id} className="mb-2 flex gap-2 text-[13.5px]">
              <Avatar initials={initials(c.authorName)} size="sm" color={memberOf(c.authorId)?.color ?? "#78716C"} />
              <div className="rounded-[10px] bg-bg px-2.5 py-1.5">
                <span className="mr-1.5 text-[12px] font-bold">{c.authorName}</span>
                <span className="text-[11px] text-ink-faint">{timeAgo(c.at)}</span>
                <div className="break-words">{c.text}</div>
              </div>
            </div>
          ))}
          <div className="mt-1 flex gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  onComment(draft);
                  setDraft("");
                }
              }}
              placeholder="Reply…"
              maxLength={300}
              className="min-w-0 flex-1 rounded-lg border-[1.5px] border-line bg-bg px-2.5 py-1.5 text-[13px] outline-none focus:border-brand"
            />
            <button
              className="rounded-lg border-[1.5px] border-line bg-card px-2.5 py-1.5 text-[13px] font-bold text-brand-dark hover:border-brand dark:text-brand-light"
              onClick={() => {
                if (draft.trim()) {
                  onComment(draft);
                  setDraft("");
                }
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes marskyPulse { 50% { box-shadow: 0 0 0 5px rgba(249,115,22,.2); } }`}</style>
    </article>
  );
}

