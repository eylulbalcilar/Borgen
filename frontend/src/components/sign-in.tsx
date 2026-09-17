"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// Wallet connection first, then SIWE sign-in with the backend.
export function SignIn() {
  const { isConnected } = useAccount();
  const { status, session, error, signIn, signOut } = useAuth();

  return (
    <div className="flex flex-col items-center gap-4">
      <ConnectButton />

      {isConnected && status !== "signed-in" && (
        <Button onPress={signIn} isPending={status === "signing-in"}>
          {status === "signing-in" ? "Check your wallet…" : "Sign in"}
        </Button>
      )}

      {status === "signed-in" && session && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm">Signed in</p>
          <Button variant="outline" onPress={signOut}>
            Sign out
          </Button>
        </div>
      )}

      {/* role="alert" makes screen readers announce the message when it appears. */}
      {error && (
        <p role="alert" className="max-w-sm text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
