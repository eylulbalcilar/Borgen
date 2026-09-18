"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Onboarding } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCurrentUser } from "@/lib/user";

// Decides what to show: connect -> sign in -> onboarding -> dashboard.
export function AppShell() {
  const { isConnected } = useAccount();
  const { status, error, signIn, signOut } = useAuth();
  const user = useCurrentUser();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">Connect a wallet to continue.</p>
        <ConnectButton />
      </div>
    );
  }

  if (status !== "signed-in") {
    return (
      <div className="flex flex-col items-center gap-4">
        <ConnectButton />
        <Button onPress={signIn} isPending={status === "signing-in"}>
          {status === "signing-in" ? "Check your wallet…" : "Sign in"}
        </Button>
        {error && (
          <p role="alert" className="max-w-sm text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <ConnectButton />

      {/* aria-live announces loading and result changes to screen readers. */}
      <div aria-live="polite" className="w-full">
        {user.isPending && <p className="text-sm text-muted-foreground">Loading your account…</p>}

        {user.error && (
          <p role="alert" className="text-sm text-destructive">
            {user.error.message}
          </p>
        )}

        {user.isSuccess && user.data === null && <Onboarding />}

        {user.isSuccess && user.data && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm">
              Signed in as <span className="font-medium capitalize">{user.data.role}</span>
            </p>
            <Button variant="outline" onPress={signOut}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
