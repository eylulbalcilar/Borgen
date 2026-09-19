"use client";

import { useSyncExternalStore } from "react";

/*
  A coarse clock as an external store, so a component can compare a due date to
  "now" without reading Date.now() while rendering. Ticks once a minute, which is
  as precise as a due date needs.
*/
const TICK_MS = 60_000;

const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    for (const notify of listeners) notify();
  }, TICK_MS);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

// Null during server render, so due states settle on hydration instead of
// mismatching between the two clocks.
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
