"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AuthProvider } from "@/lib/auth";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session. Creating it inside useState
  // keeps it stable across re-renders without sharing it between users.
  const [queryClient] = useState(() => new QueryClient());

  return (
    // Respects the operating system "reduce motion" setting for every animation.
    <MotionConfig reducedMotion="user">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <AuthProvider>{children}</AuthProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MotionConfig>
  );
}
