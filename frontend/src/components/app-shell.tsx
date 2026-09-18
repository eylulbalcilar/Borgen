"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { Onboarding } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCurrentUser } from "@/lib/user";

// Entry point: connect -> sign in -> onboarding -> role panel.
export function AppShell() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { status, error, signIn } = useAuth();
  const user = useCurrentUser();

  const role = user.data?.role;

  // Registered users go straight to their panel.
  useEffect(() => {
    if (role) router.replace(`/${role}`);
  }, [role, router]);

  if (!isConnected) {
    return <p className="text-sm text-muted-foreground">Connect a wallet to continue.</p>;
  }

  if (status !== "signed-in") {
    return (
      <div className="flex flex-col items-center gap-4">
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
    <div aria-live="polite" className="w-full max-w-md">
      {user.isPending && <p className="text-sm text-muted-foreground">Loading your account…</p>}

      {user.error && (
        <p role="alert" className="text-sm text-destructive">
          {user.error.message}
        </p>
      )}

      {user.isSuccess && user.data === null && <Onboarding />}
    </div>
  );
}
