"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useAccountEffect, useSignMessage } from "wagmi";
import { api, ApiError, type ApiOptions } from "./api";

const STORAGE_KEY = "borgen.session";

// Exported so the session keeper can tell a reload from a fresh connection
// without waiting for this provider's restore effect.
export const SESSION_STORAGE_KEY = STORAGE_KEY;

type Session = { token: string; wallet: string };
type AuthStatus = "signed-out" | "signing-in" | "signed-in";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
  // Authenticated request; signs the user out when the token is rejected.
  request: <T>(path: string, options?: Omit<ApiOptions, "token">) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/*
  sessionStorage is the source of truth for the session, and it cannot be read
  while rendering on the server. Exposing it as an external store lets React
  subscribe to it instead of copying it into state after mount, so the server
  snapshot stays null and no render is spent on the copy.
*/
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;

function readStoredSession(): Session | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  // Parse only when the stored text changed, so the snapshot keeps its identity
  // between renders and React does not see an endless stream of new values.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSession = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cachedSession = null;
    }
  }
  return cachedSession;
}

function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Writes stay unguarded so a storage failure still surfaces to the caller.
function writeStoredSession(session: Session | null) {
  if (session) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  for (const listener of listeners) listener();
}

// Wallet errors carry a readable shortMessage; prefer it over the long message.
function readableError(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err && typeof err.shortMessage === "string") {
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : "Could not open the session";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, chainId, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const stored = useSyncExternalStore(subscribeToSession, readStoredSession, () => null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    writeStoredSession(null);
  }, []);

  // Wallet disconnected in RainbowKit or MetaMask: drop the session.
  useAccountEffect({ onDisconnect: signOut });

  // Account switched in MetaMask: the token belongs to the previous wallet, so
  // clear it from storage. The derived session below already ignores it, this
  // stops it coming back if the original wallet reconnects later.
  useEffect(() => {
    if (accountStatus !== "connected" || !stored || !address) return;
    if (stored.wallet.toLowerCase() !== address.toLowerCase()) signOut();
  }, [accountStatus, address, stored, signOut]);

  // A stored token only counts while the same wallet is connected.
  const session =
    stored && address && stored.wallet.toLowerCase() === address.toLowerCase() ? stored : null;

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setSigningIn(true);
    setError(null);
    try {
      const { nonce } = await api<{ nonce: string }>("/auth/nonce");

      // The backend checks this domain, so a message signed on another site is rejected.
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
        statement: "Open a Borgen session",
      });

      const signature = await signMessageAsync({ message });
      const result = await api<Session>("/auth/verify", {
        method: "POST",
        body: { message, signature },
      });

      writeStoredSession(result);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSigningIn(false);
    }
  }, [address, chainId, signMessageAsync]);

  const request = useCallback(
    async <T,>(path: string, options: Omit<ApiOptions, "token"> = {}) => {
      try {
        return await api<T>(path, { ...options, token: session?.token });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signOut();
        throw err;
      }
    },
    [session, signOut],
  );

  const status: AuthStatus = signingIn ? "signing-in" : session ? "signed-in" : "signed-out";

  const value = useMemo(
    () => ({ status, session, error, signIn, signOut, request }),
    [status, session, error, signIn, signOut, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
