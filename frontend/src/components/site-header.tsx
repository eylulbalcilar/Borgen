"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { status, signOut } = useAuth();

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link href="/" className="text-lg font-semibold">
        Borgen
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/liquidations" className="text-sm underline-offset-4 hover:underline">
          Liquidations
        </Link>
        {status === "signed-in" && (
          <Button variant="ghost" size="sm" onPress={signOut}>
            Sign out
          </Button>
        )}
        <ConnectButton />
      </div>
    </header>
  );
}
