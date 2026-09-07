"use client";

import { useEffect } from "react";

/** DESIGN.md §7: dark mode follows the OS; no manual toggle in v1.
 *  `?theme=light|dark` in the URL overrides — used for previews. */
export function ThemeBootstrap() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("theme");
    if (forced === "dark" || (!forced && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    if (params.get("vibrant")) {
      document.documentElement.setAttribute("data-vibrant", "");
    }
  }, []);
  return null;
}
