"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { SESSION_STORAGE_KEY, useAuth } from "@/lib/auth";

// The provider restores a stored session in its own effect, which runs after
// this one. Reading the entry directly avoids prompting again on every reload.
function hasStoredSession(address: string): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { wallet?: string };
    return parsed.wallet?.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

/*
  Connecting the wallet is the whole sign-in: once an address is available the
  session message is requested on its own, so no screen asks for it separately.
  Attempted once per address, because a declined signature must not re-prompt in
  a loop. The wallet pill offers the retry in that case.
*/
export function SessionKeeper() {
  const { address, isConnected } = useAccount();
  const { status, signIn } = useAuth();
  const attempted = useRef<string>(undefined);

  useEffect(() => {
    if (!isConnected || !address) {
      // Reconnecting the same address should ask again.
      attempted.current = undefined;
      return;
    }
    if (status !== "signed-out") return;
    if (attempted.current === address) return;
    if (hasStoredSession(address)) return;

    attempted.current = address;
    void signIn();
  }, [isConnected, address, status, signIn]);

  return null;
}
