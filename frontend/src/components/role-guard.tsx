"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/lib/auth";
import { useCurrentUser, type UserRole } from "@/lib/user";

// Guards a role panel: redirects visitors who are not signed in,
// not registered, or registered with a different role.
export function RoleGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { status } = useAuth();
  const user = useCurrentUser();

  const actualRole = user.data?.role;
  const wrongRole = Boolean(actualRole && actualRole !== role);
  const notSignedIn = !isConnected || status === "signed-out";
  const notRegistered = user.isSuccess && user.data === null;

  useEffect(() => {
    if (notSignedIn || notRegistered) {
      router.replace("/app");
    } else if (wrongRole && actualRole) {
      router.replace(`/${actualRole}`);
    }
  }, [notSignedIn, notRegistered, wrongRole, actualRole, router]);

  if (user.isPending || notSignedIn || notRegistered || wrongRole) {
    return (
      <p className="mx-auto w-full max-w-[1320px] px-8 py-24 font-mono text-[11.5px] uppercase tracking-[0.14em] text-dim">
        Loading…
      </p>
    );
  }

  if (user.error) {
    return (
      <p role="alert" className="mx-auto w-full max-w-[1320px] px-8 py-24 font-mono text-[11.5px] text-danger-text">
        {user.error.message}
      </p>
    );
  }

  return <>{children}</>;
}
