"use client";

import { useEffect } from "react";

/** DESIGN.md §7: dark mode follows the OS; no manual toggle in v1. */
export function ThemeBootstrap() {
  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);
  return null;
}
