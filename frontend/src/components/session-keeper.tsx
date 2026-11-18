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
  const { address, chain, isConnected } = useAccount();
  const { status, signIn } = useAuth();
  const attempted = useRef<string>(undefined);

  useEffect(() => {
    // chain is undefined on a network the app is not configured for. The
    // backend rejects a message signed there, so asking for one would burn the
    // single attempt on a signature that cannot succeed.
    if (!isConnected || !address || !chain) {
      // Clearing here also means fixing the network starts a fresh attempt.
      attempted.current = undefined;
      return;
    }
    if (status !== "signed-out") return;

    const key = `${address}:${chain.id}`;
    if (attempted.current === key) return;
    if (hasStoredSession(address)) return;

    attempted.current = key;
    void signIn();
  }, [isConnected, address, chain, status, signIn]);

  return null;
}
