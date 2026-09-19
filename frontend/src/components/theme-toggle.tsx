"use client";

import { useSyncExternalStore } from "react";

export const THEME_STORAGE_KEY = "borgen.theme";

type Theme = "dark" | "light";

// Inlined in <head> so the attribute is set before the first paint.
export const themeScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`;

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function useTheme(): Theme {
  // Dark is the default, so it is also the server snapshot.
  return useSyncExternalStore(subscribe, readTheme, () => "dark" as const);
}

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this page.
  }
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M9.53 1.72a.75.75 0 0 1 .16.82A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.46-.69.75.75 0 0 1 .98.98A10.5 10.5 0 0 1 12.75 21.75C6.95 21.75 2.25 17.05 2.25 11.25c0-4.37 2.67-8.11 6.46-9.69a.75.75 0 0 1 .82.16Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.19 5.81a.75.75 0 0 0-1.06-1.06l-1.06 1.06a.75.75 0 1 0 1.06 1.06l1.06-1.06ZM21.75 12a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.13 19.25a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM12 18.75a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM6.87 19.25a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06l-1.06 1.06ZM5.25 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM5.81 4.75a.75.75 0 0 0-1.06 1.06l1.06 1.06a.75.75 0 0 0 1.06-1.06L5.81 4.75Z" />
    </svg>
  );
}

// Two-state toggle: both the moon and the sun stay visible, the active one lit.
export function ThemeToggle() {
  const theme = useTheme();

  const segment = (active: boolean) =>
    `grid size-7 cursor-pointer place-items-center rounded-pill transition-colors ${
      active ? "bg-pill-active text-text" : "text-dim hover:text-text"
    }`;

  return (
    <div className="glass flex items-center gap-0.5 rounded-pill p-1" role="group" aria-label="Theme">
      <button
        type="button"
        onClick={() => applyTheme("dark")}
        aria-pressed={theme === "dark"}
        aria-label="Dark theme"
        className={segment(theme === "dark")}
      >
        <MoonIcon />
      </button>
      <button
        type="button"
        onClick={() => applyTheme("light")}
        aria-pressed={theme === "light"}
        aria-label="Light theme"
        className={segment(theme === "light")}
      >
        <SunIcon />
      </button>
    </div>
  );
}
