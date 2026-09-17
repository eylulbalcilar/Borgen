import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

// NEXT_PUBLIC_ values are inlined at build time, so they must be read
// with the full literal name (no dynamic lookup).
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set");
}

// Borgen runs on Base Sepolia only.
export const wagmiConfig = getDefaultConfig({
  appName: "Borgen",
  projectId,
  chains: [baseSepolia],
  // Server-side rendering support: avoids hydration mismatches
  // when wallet state is restored in the browser.
  ssr: true,
});
