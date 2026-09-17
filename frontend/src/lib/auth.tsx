"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useAccountEffect, useSignMessage } from "wagmi";
import { api, ApiError, type ApiOptions } from "./api";

const STORAGE_KEY = "borgen.session";

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

// sessionStorage exists only in the browser, so it is read after mount.
function readStoredSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

// Wallet errors carry a readable shortMessage; prefer it over the long message.
function readableError(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err && typeof err.shortMessage === "string") {
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : "Sign-in failed";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, chainId, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [stored, setStored] = useState<Session | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStored(null);
  }, []);

  useEffect(() => {
    setStored(readStoredSession());
  }, []);

  // Wallet disconnected in RainbowKit or MetaMask: drop the session.
  useAccountEffect({ onDisconnect: signOut });

  // Account switched in MetaMask: the token belongs to the previous wallet.
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
        statement: "Sign in to Borgen",
      });

      const signature = await signMessageAsync({ message });
      const result = await api<Session>("/auth/verify", {
        method: "POST",
        body: { message, signature },
      });

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      setStored(result);
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
