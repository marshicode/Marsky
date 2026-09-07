import type { Item } from "./types";

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Always returns a valid UUID v4 (the DB's items.id is a uuid column, so
 *  prefixed ids like `i-…` would fail inserts). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const CODE_ALPHABET = "ABCDFGHJKMNPQRSTVWXYZ23456789"; // no 0/1/I/L/O

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function pickColor(index: number): string {
  const colors = ["#F97316", "#5488FD", "#9D5B4A", "#22C55E", "#EF4444", "#8B84C2"];
  return colors[index % colors.length];
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const hm = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** "Today 18:30" · "Tomorrow 09:00" · "Tue, Aug 28 14:00" */
export function fmtDue(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(d, now)) return `Today ${hm(d)}`;
  if (sameDay(d, tomorrow)) return `Tomorrow ${hm(d)}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${hm(d)}`;
}

/** "2h ago" · "yesterday" · "just now" */
export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export type DueState = "none" | "soon" | "late" | "firing";

export function dueState(item: Item, now = Date.now()): DueState {
  if (!item.dueAt || item.completed) return "none";
  if (item.checkin) return "firing";
  const diff = new Date(item.dueAt).getTime() - now;
  if (diff < 0) return "late";
  if (diff <= 60 * 60 * 1000) return "soon";
  return "none";
}

export function toLocalInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c];
  });
}

export function isImageUrl(url: string): boolean {
  return url.startsWith("data:image") || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}
