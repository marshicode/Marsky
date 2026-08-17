"use client";

import { useEffect, useState, type ReactNode } from "react";

let push: ((node: ReactNode) => void) | null = null;
let seq = 0;

export function toast(node: ReactNode) {
  push?.(node);
}

export function Toasts() {
  const [items, setItems] = useState<{ id: number; node: ReactNode }[]>([]);

  useEffect(() => {
    push = (node) => {
      const id = ++seq;
      setItems((s) => [...s, { id, node }]);
      setTimeout(() => {
        setItems((s) => s.filter((i) => i.id !== id));
      }, 6000);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col items-center gap-2.5"
      role="status"
      aria-live="polite"
    >
      {items.map(({ id, node }) => (
        <div
          key={id}
          className="pointer-events-auto flex w-full items-center gap-2.5 rounded-[12px] bg-ink px-4 py-3 text-[14px] text-bg shadow-[var(--shadow-toast)]"
          style={{ animation: "marskySlideUp .2s ease" }}
        >
          <div className="flex-1 leading-[1.4]">{node}</div>
        </div>
      ))}
      <style>{`@keyframes marskySlideUp { from { transform: translateY(14px); opacity: 0; } }`}</style>
    </div>
  );
}
