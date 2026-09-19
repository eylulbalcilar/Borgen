"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BorgenMark } from "@/components/borgen-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Borrower", href: "/borrower" },
  { label: "Appraiser", href: "/appraiser" },
  { label: "Lender", href: "/lender" },
  { label: "Liquidations", href: "/liquidations" },
];

const pillClass =
  "flex items-center gap-[9px] whitespace-nowrap rounded-pill border px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-88";

// Matches the hero's negative top margin: the band the header actually covers.
const HEADER_HEIGHT = 78;

/*
  True while the header sits on the hero photograph. The photograph is dark in
  both themes, so chrome without a surface behind it has to stay bone there
  rather than follow --text.
*/
function useOverHero(isLanding: boolean) {
  const [atHero, setAtHero] = useState(false);

  useEffect(() => {
    if (!isLanding) return;
    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setAtHero(entry?.isIntersecting ?? false),
      // Shrink the root by the header band; the hero ending below it means overlap.
      { rootMargin: `-${HEADER_HEIGHT}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLanding]);

  return isLanding && atHero;
}

export function SiteHeader() {
  const pathname = usePathname();
  const overHero = useOverHero(pathname === "/");


  return (
    <header className="sticky top-0 z-50 bg-transparent py-3.5">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-8">
        <Link
          href="/"
          className={`flex items-center gap-[11px] rounded-pill ${overHero ? "text-bone" : "text-text"}`}
          aria-label="Borgen, home"
        >
          <BorgenMark size={22} aria-hidden="true" className="block shrink-0" />
          <span className="font-serif text-[20px] font-semibold tracking-[-0.012em]">Borgen</span>
        </Link>

        <nav
          aria-label="Main"
          className="glass order-2 mx-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-pill p-[5px]"
        >
          {NAV.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-pill px-[clamp(11px,1.3vw,17px)] py-[9px] text-[clamp(12px,1.05vw,13.5px)] font-medium transition-colors hover:text-text ${
                  isActive ? "bg-pill-active text-text" : "text-dim"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="order-3 flex items-center gap-2.5">
          <ThemeToggle />
          <WalletPill overHero={overHero} />
        </div>
      </div>
    </header>
  );
}

/*
  RainbowKit's button, restyled as the handoff's status-dot pill. It also carries
  the session step, so connect and sign are one progressive control instead of two
  header items: grey dot to connect, gold to sign, teal once signed. The signature
  is still needed because the role, valuations and activity come from the backend,
  which rejects an unsigned session.
*/
function WalletPill({ overHero }: { overHero: boolean }) {
  const { status, signIn } = useAuth();
  // Over the dark photograph the pill stays bone, whatever --btn-bg is.
  const solid = overHero ? "border-bone bg-bone text-ink" : "border-btn-bg bg-btn-bg text-btn-fg";
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        // Nothing is known about the wallet until RainbowKit mounts.
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <div aria-hidden="true" className={`${pillClass} ${solid} opacity-0`}>
              <span className="size-1.5 rounded-pill bg-dim" />
              Connect wallet
            </div>
          );
        }

        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className={`${pillClass} ${solid} cursor-pointer`}>
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-dim" />
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button type="button" onClick={openChainModal} className={`${pillClass} cursor-pointer border-danger bg-transparent text-danger-text`}>
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-danger" />
              Wrong network
            </button>
          );
        }

        // The session signature is requested automatically on connect. This state
        // only lingers if it was declined, so pressing it asks once more.
        if (status !== "signed-in") {
          const busy = status === "signing-in";
          return (
            <button
              type="button"
              onClick={() => !busy && void signIn()}
              disabled={busy}
              className={`${pillClass} ${solid} cursor-pointer disabled:cursor-wait`}
            >
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-seal" />
              {busy ? "Check your wallet" : "Confirm wallet"}
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className={`${pillClass} cursor-pointer backdrop-blur-[16px] ${
              overHero ? "border-bone/30 bg-white/10 text-bone" : "border-glass-border bg-glass text-text"
            }`}
          >
            <span aria-hidden="true" className="size-1.5 rounded-pill bg-verify" />
            <span className="font-mono text-[13px]">{account.displayName}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
