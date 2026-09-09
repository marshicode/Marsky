"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { isDbMode, isSupabaseConfigured, joinPairAsync } from "@/lib/pair-store";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";
import { toast, Toasts } from "@/components/toast";

export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const code = initialCode.toUpperCase();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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
            ? "That code doesn’t exist — it may have been mistyped."
            : "This list is full (8 members max)."
        );
      }
      return;
    }
    toast(
      <span className="inline-flex items-center gap-2">
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
        You joined the list
      </span>
    );
    router.push("/app");
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-[9vh] text-center">
      <main className="flex w-full max-w-[440px] flex-col items-center">
        <Logo size={48} />
        <h1 className="mt-4 text-[24px] font-black">Join this list</h1>
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
          Enter your name to join the shared list with code:
        </p>

        <div className="mt-4 w-full cursor-pointer select-all rounded-[12px] border-[1.5px] border-dashed border-transparent bg-brand-soft px-4 py-[14px] font-mono text-[20px] font-extrabold tracking-[3px] text-brand-dark hover:border-brand dark:text-brand-light">
          {code}
        </div>

        <label className="mb-1.5 mt-5 block w-full text-left text-[11.5px] font-bold uppercase tracking-[.6px] text-ink-soft">
          Your name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doJoin()}
          placeholder="e.g. Maya"
          maxLength={30}
          className="w-full rounded-[10px] border-[1.5px] border-transparent bg-canvas-2 px-3.5 py-[11px] text-[15px] outline-none focus:border-brand"
        />
        {error && <p className="mt-2 text-[13px] font-bold text-danger">{error}</p>}

        <div className="mt-5 flex w-full flex-col gap-2.5">
          <Button className="w-full" onClick={doJoin}>
            Join the list
          </Button>
          <Button href="/" variant="ghost" size="sm">
            Back
          </Button>
        </div>
      </main>
      <Toasts />
    </div>
  );
}
