import type { Metadata } from "next";
import "./globals.css";
import { display, mono, sans, serif } from "./fonts";
import { Providers } from "./providers";
import { Reveal } from "@/components/reveal";
import { SessionKeeper } from "@/components/session-keeper";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Borgen",
  description: "Unlock the value of your assets. Real-world collateral, on-chain credit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable} ${display.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Runs before the first paint, so the stored theme never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-pill focus:bg-btn-bg focus:px-5 focus:py-2.5 focus:text-btn-fg"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
          <Reveal />
          <SessionKeeper />
        </Providers>
      </body>
    </html>
  );
}
