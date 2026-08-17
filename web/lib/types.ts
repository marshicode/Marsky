/** Data model per PRD §9. Mirrors the ARCHITECTURE.md §4 SQL schema
 *  (pairs / pair_members / items / item_meta / history) so the local
 *  adapter can be swapped for Supabase without reshaping the app. */

export type Recurring = null | "daily" | "weekly";
export type CheckinAnswer = "yes" | "no";

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
}

export interface Checkin {
  firedAt: string;
  responses: Record<string, CheckinAnswer>;
}

export interface Item {
  id: string;
  text: string;
  note?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  dueAt: string | null;
  recurring: Recurring;
  completed: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
  labels: number[];
  pinned: boolean;
  attachments: Attachment[];
  comments: Comment[];
  /** Set when the mutual reminder has fired; cleared on snooze/recurring rollover. */
  checkin: Checkin | null;
  reminded: boolean;
}

export interface HistoryEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  verb: string;
  detail: string;
}

export interface Pair {
  code: string;
  name: string;
  createdAt: string;
  members: Member[];
  items: Item[];
  history: HistoryEntry[];
  /** Monotonic revision: broadcast/write sync only accepts newer copies. */
  rev: number;
}

export type User = Member;

export interface PersistedState {
  user: User | null;
  pairs: Record<string, Pair>;
  activeCode: string | null;
}

export const LABELS: { id: number; name: string; color: string }[] = [
  { id: 0, name: "Chores", color: "#EF4444" },
  { id: 1, name: "Plans", color: "#F97316" },
  { id: 2, name: "Meals", color: "#F59E0B" },
  { id: 3, name: "Health", color: "#22C55E" },
  { id: 4, name: "Study", color: "#3B82F6" },
  { id: 5, name: "Family", color: "#A855F7" },
];

export const MEMBER_COLORS = ["#F97316", "#3B82F6", "#A855F7", "#22C55E", "#EF4444", "#0EA5E9"];
