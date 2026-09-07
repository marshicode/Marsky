"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  createPairAsync,
  getActivePair,
  getUser,
  getVersion,
  isDbMode,
  isSupabaseConfigured,
  joinPairAsync,
  subscribe,
} from "@/lib/pair-store";
import { PartyPopper, UserPlus } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { toast, Toasts } from "@/components/toast";

export default function Home() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const router = useRouter();
  const user = getUser();
  const pair = getActivePair();

  const [mode, setMode] = useState<null | "create" | "join">(null);
  const [name, setName] = useState(user?.name ?? "");
  const [pairName, setPairName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && pair) router.replace("/app");
  }, [user, pair, router]);

  const openCreate = () => {
    setError("");
    setName(user?.name ?? "");
    setPairName("");
    setMode("create");
  };
  const openJoin = () => {
    setError("");
    setName(user?.name ?? "");
    setCode("");
    setMode("join");
  };

  const doCreate = async () => {
    if (!name.trim()) {
      setError("Tell us your name first");
      return;
    }
    await createPairAsync(name, pairName);
    toast(
      <span className="inline-flex items-center gap-2">
        <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
        Pair created — share the code to invite your partner
      </span>
    );
    router.push("/app");
  };

  const doJoin = async () => {
    if (!name.trim()) {
      setError("Enter your name");
      return;
    }
    const res = await joinPairAsync(code, name);
    if ("error" in res) {
      if (isSupabaseConfigured() && !isDbMode()) {
        setError(
          "The shared backend isn’t connected yet — this browser is running offline-only, so codes only work on the device that created them. Enable “Allow anonymous sign-ins” in Supabase (Authentication → Providers), then reload."
        );
      } else {
        setError(
          res.error === "not-found"
            ? "That code doesn’t exist — double-check it."
            : "This pair already has two people. (Marsky is for two!)"
        );
      }
      return;
    }
    toast(
      <span className="inline-flex items-center gap-2">
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
        You joined the pair
      </span>
    );
    router.push("/app");
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-[7vh] text-center sm:px-6">
      <main className="flex w-full max-w-[620px] flex-col items-center rounded-[26px] bg-canvas px-6 py-10 shadow-[var(--shadow-canvas)] sm:px-12">
        <Logo size={64} />
        <h1 className="mt-[18px] text-[40px] font-black leading-[36px] tracking-[-1.5px] text-brand-dark sm:text-[52px] dark:text-brand-light">
          Marsky
        </h1>
        <p className="mt-0.5 text-[20px] font-bold">One list, two people, zero nagging.</p>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-ink-soft">
          A shared reminder list for two — students, roommates, friends, parents. Pair
          in seconds. Add a note, set a time, and it reminds{" "}
          <em className="font-bold not-italic text-brand-dark dark:text-brand-light">
            both
          </em>{" "}
          of you. When it fires, you check in: “done?”
        </p>

        <div className="mt-[30px] flex flex-wrap justify-center gap-3.5">
          <Button onClick={openCreate}>Create a pair</Button>
          <Button variant="ghost" onClick={openJoin}>
            Join with a code
          </Button>
        </div>

        <p className="mt-[34px] text-[13px] leading-[1.5] text-ink-faint">
          No accounts, no setup. Tip: open a second tab/window to the same URL and join
          with the same code — the two tabs act as your two partners, syncing live.
        </p>
      </main>

      {/* Create modal (PRD §8.1) */}
      <Modal open={mode === "create"} onClose={() => setMode(null)}>
        <h2 className="text-[20px] font-black">Create a pair</h2>
        <p className="mb-2 text-[14px] leading-[1.5] text-ink-soft">
          You’ll get a 6-character code to share with your partner.
        </p>
        <label className="mb-1.5 mt-3 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
          Your name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doCreate()}
          placeholder="e.g. Maya"
          maxLength={30}
          className="w-full rounded-[10px] border-[1.5px] border-transparent bg-canvas-2 px-3.5 py-[11px] text-[15px] outline-none focus:border-brand"
        />
        <label className="mb-1.5 mt-3 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
          Pair name <span className="font-normal normal-case text-ink-faint">(optional)</span>
        </label>
        <input
          type="text"
          value={pairName}
          onChange={(e) => setPairName(e.target.value)}
          placeholder="e.g. Our apartment"
          maxLength={40}
          className="w-full rounded-[10px] border-[1.5px] border-transparent bg-canvas-2 px-3.5 py-[11px] text-[15px] outline-none focus:border-brand"
        />
        {error && <p className="mt-2 text-[13px] font-bold text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button onClick={doCreate}>Create</Button>
        </div>
      </Modal>

      {/* Join modal (PRD §8.1) */}
      <Modal open={mode === "join"} onClose={() => setMode(null)}>
        <h2 className="text-[20px] font-black">Join a pair</h2>
        <p className="mb-2 text-[14px] leading-[1.5] text-ink-soft">
          Enter the 6-character code your partner shared with you.
        </p>
        <label className="mb-1.5 mt-3 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
          Pair code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. M3R5KY"
          maxLength={6}
          className="w-full rounded-[10px] border-[1.5px] border-transparent bg-canvas-2 px-3.5 py-[11px] font-mono text-[18px] font-extrabold tracking-[3px] uppercase outline-none focus:border-brand"
        />
        <label className="mb-1.5 mt-3 block text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
          Your name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doJoin()}
          placeholder="e.g. Alex"
          maxLength={30}
          className="w-full rounded-[10px] border-[1.5px] border-transparent bg-canvas-2 px-3.5 py-[11px] text-[15px] outline-none focus:border-brand"
        />
        {error && <p className="mt-2 text-[13px] font-bold text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button onClick={doJoin}>Join</Button>
        </div>
      </Modal>

      <Toasts />
    </div>
  );
}
