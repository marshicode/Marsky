"use client";

import { useRef, useState } from "react";
import { Link2, MoreHorizontal, Paperclip, X } from "lucide-react";
import type { Attachment, Item } from "@/lib/types";
import { LABELS } from "@/lib/types";
import { toLocalInput, uid } from "@/lib/format";
import { toast } from "@/components/toast";

export interface ComposeInput {
  text: string;
  note?: string;
  dueAt: string | null;
  recurring: Item["recurring"];
  labels: number[];
  attachments: Attachment[];
}

const QUICK = [
  { label: "+1 min", minutes: 1 },
  { label: "+30 min", minutes: 30 },
  { label: "+2 h", minutes: 120 },
  { label: "tomorrow", minutes: 1440 },
];

export function ComposeBar({
  editing,
  onSubmit,
  onCancel,
}: {
  editing: Item | null;
  onSubmit: (input: ComposeInput) => void;
  onCancel: () => void;
}) {
  // The parent remounts this component (key=editing?.id) when switching
  // between create/edit, so state can be derived once from `editing`.
  const [open, setOpen] = useState(!!editing);
  const [text, setText] = useState(editing?.text ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [due, setDue] = useState(
    editing?.dueAt ? toLocalInput(new Date(editing.dueAt)) : ""
  );
  const [recurring, setRecurring] = useState<Item["recurring"]>(
    editing?.recurring ?? null
  );
  const [labels, setLabels] = useState<number[]>(editing?.labels ?? []);
  const [attachments, setAttachments] = useState<Attachment[]>(
    editing?.attachments ?? []
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleLabel = (id: number) =>
    setLabels((s) => (s.includes(id) ? s.filter((l) => l !== id) : [...s, id]));

  const submit = () => {
    if (!text.trim()) return;
    onSubmit({
      text: text.trim(),
      note: note.trim() || undefined,
      dueAt: due ? new Date(due).toISOString() : null,
      recurring,
      labels,
      attachments,
    });
    setText("");
    setNote("");
    setDue("");
    setRecurring(null);
    setLabels([]);
    setAttachments([]);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 900_000) {
      toast("File too big — keep it under ~900 KB for now");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((s) => [
        ...s,
        { id: "a-" + uid(), name: file.name, url: String(reader.result) },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const name = linkName.trim() || url;
    setAttachments((s) => [...s, { id: "a-" + uid(), name, url }]);
    setLinkUrl("");
    setLinkName("");
    setLinkOpen(false);
  };

  return (
    <div className="mb-[18px] rounded-[14px] border-[1.5px] border-line bg-card p-3.5 shadow-[var(--shadow-elev)]">
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Add a shared note… e.g. “pay rent”, “buy milk”, “finish essay”"
          maxLength={200}
          className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-bg px-3.5 py-[11px] text-[15px] outline-none transition-colors focus:border-brand"
        />
        {editing && (
          <button
            className="rounded-full border-[1.5px] border-line bg-card px-3 py-[10px] text-[15px] font-bold hover:border-brand"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="rounded-full bg-brand px-[18px] py-[10px] text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(249,115,22,.35)] transition-all hover:bg-brand-dark active:scale-[.97]"
          onClick={submit}
          disabled={!text.trim()}
        >
          {editing ? "Save" : "Add"}
        </button>
        <button
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[1.5px] border-line bg-card text-ink-soft hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
          onClick={() => setOpen((s) => !s)}
          aria-label="More options"
          aria-expanded={open}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="mt-3.5 border-t border-line pt-3.5">
          <div className="flex flex-wrap gap-3.5">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
                Remind both at
              </label>
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-brand"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setDue(toLocalInput(new Date(Date.now() + q.minutes * 60_000)))}
                    className={`rounded-full border-[1.5px] px-2.5 py-1 text-[12px] font-bold transition-colors ${
                      due
                        ? "border-line bg-bg text-ink-soft hover:border-brand"
                        : "border-brand bg-brand-soft text-brand-dark dark:text-brand-light"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-[140px]">
              <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
                Repeat
              </label>
              <select
                value={recurring ?? ""}
                onChange={(e) => setRecurring((e.target.value as "daily" | "weekly") || null)}
                className="w-full rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-brand"
              >
                <option value="">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
              Labels
            </label>
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => toggleLabel(l.id)}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-bold text-white transition-opacity ${
                    labels.includes(l.id) ? "opacity-100" : "opacity-35 hover:opacity-70"
                  }`}
                  style={{ backgroundColor: l.color }}
                  aria-pressed={labels.includes(l.id)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
              Note / attachment
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Extra note (optional)"
              maxLength={500}
              className="w-full rounded-[10px] border-[1.5px] border-line bg-bg px-3.5 py-[11px] text-[15px] outline-none focus:border-brand"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-bold hover:border-brand"
                onClick={() => setLinkOpen((s) => !s)}
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                Link
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-bold hover:border-brand"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                File
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-[12px] text-ink-soft"
                >
                  <Paperclip className="h-3 w-3" aria-hidden="true" />
              {a.name}
                  <button
                    className="text-ink-faint hover:text-danger"
                    onClick={() => setAttachments((s) => s.filter((x) => x.id !== a.id))}
                    aria-label={`Remove ${a.name}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            {linkOpen && (
              <div className="mt-2 flex gap-2">
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-brand"
                />
                <input
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Name (optional)"
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-brand"
                />
                <button
                  className="rounded-full border-[1.5px] border-line bg-card px-3 text-[13px] font-bold hover:border-brand"
                  onClick={addLink}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
