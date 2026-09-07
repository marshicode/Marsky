"use client";

import { Check, CheckCircle2, Clock, Hourglass, PartyPopper } from "lucide-react";
import type { Item, Member, Pair } from "@/lib/types";
import { fmtDue, initials } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";

const SNOOZES: [string, number][] = [
  ["10 min", 10],
  ["30 min", 30],
  ["1 h", 60],
  ["3 h", 180],
  ["Tomorrow", 1440],
];

export function CheckinModal({
  open,
  item,
  pair,
  you,
  onAnswer,
  onSnooze,
  onClose,
}: {
  open: boolean;
  item: Item | null;
  pair: Pair;
  you: Member;
  onAnswer: (answer: "yes" | "no") => void;
  onSnooze: (minutes: number) => void;
  onClose: () => void;
}) {
  const checkin = item?.checkin ?? null;
  const answered = (m: Member) => (checkin ? checkin.responses[m.id] : undefined);
  const everyoneAnswered =
    checkin !== null && pair.members.every((m) => answered(m) !== undefined);
  const allYes = everyoneAnswered && pair.members.every((m) => answered(m) === "yes");
  // PRD §8.3.5: as soon as ANY member says Not yet, snooze is offered.
  const anyoneNo = checkin !== null && pair.members.some((m) => answered(m) === "no");
  const youAnswered = you ? answered(you) !== undefined : false;

  const line = (m: Member) => {
    const a = answered(m);
    if (a === undefined)
      return (
        <span className="text-ink-faint">
          {m.id === you.id ? "Waiting for you…" : `Waiting for ${m.name}…`}
        </span>
      );
    if (a === "yes")
      return (
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden="true" />
          {m.name} said done
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5">
        <Hourglass className="h-4 w-4 text-ink-soft" aria-hidden="true" />
        {m.name} said not yet
      </span>
    );
  };

  return (
    <Modal open={open && !!item} onClose={onClose}>
      {item && (
        <>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <h2 className="text-[20px] font-black">“{item.text}” — done?</h2>
          </div>
          <p className="mb-4 mt-1 text-[13px] text-ink-soft">
            {item.dueAt ? `Reminded you both · ${fmtDue(item.dueAt)}` : "Reminded you both"}
          </p>

          <div className="flex flex-col gap-2">
            {pair.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-[14px]">
                <Avatar initials={initials(m.name)} size="sm" color={m.color} />
                {line(m)}
              </div>
            ))}
          </div>

          {allYes ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-center text-[16px] font-bold text-ok">
              <PartyPopper className="h-5 w-5" aria-hidden="true" />
              You both did it — “{item.text}” is done!
            </div>
          ) : anyoneNo ? (
            <div className="mt-4 text-center">
              <p className="text-[14px] font-semibold text-ink-soft">
                One of you isn’t done yet.
              </p>
              <p className="mt-1 text-[12px] font-bold text-ink-faint">
                Remind us both again in…
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {SNOOZES.map(([label, minutes]) => (
                  <button
                    key={minutes}
                    className="rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-bold transition-colors hover:border-brand"
                    onClick={() => onSnooze(minutes)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2.5">
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-[18px] py-[10px] text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(249,115,22,.35)] transition-all hover:bg-brand-dark active:scale-[.97]"
                onClick={() => onAnswer("yes")}
                disabled={youAnswered}
              >
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                Done
              </button>
              <button
                className="flex-1 rounded-full border-[1.5px] border-line bg-card px-[18px] py-[10px] text-[15px] font-bold text-ink hover:border-brand hover:text-brand-dark dark:hover:text-brand-light"
                onClick={() => onAnswer("no")}
                disabled={youAnswered}
              >
                Not yet
              </button>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              className="text-[13px] font-bold text-ink-faint hover:text-ink"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
