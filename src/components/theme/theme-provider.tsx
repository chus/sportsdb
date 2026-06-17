"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * Dark-by-default theme. The actual `.dark` class on <html> is set by an
 * inline no-flash script in the layout (runs before paint); this provider
 * keeps React state in sync and exposes the toggle. Choice persists in
 * localStorage under "theme".
 */
type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} | null>(null);

function apply(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the default during the phased dark rollout (see layout's
  // no-flash script). Flip both to "dark" when every surface is converted.
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync state from whatever the no-flash script already applied.
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    setThemeState(stored ?? "light");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    apply(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {
        // ignore
      }
      apply(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
