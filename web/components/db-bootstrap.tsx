"use client";

import { useEffect } from "react";
import { initDb } from "@/lib/pair-store";

/** Boots the Supabase layer once per session: anonymous sign-in (zero
 *  friction, PRD F1), refresh of the active pair, realtime subscription.
 *  Degrades silently to local-only mode when the DB/schema is unavailable. */
export function DbBootstrap() {
  useEffect(() => {
    void initDb();
  }, []);
  return null;
}
