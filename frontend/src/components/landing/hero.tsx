import Link from "next/link";
import { HeroMedia } from "@/components/landing/hero-media";

const TERMS = ["50% max LTV", "10% APR", "30-day term", "80% liquidation"];


const SCRIM =
  "radial-gradient(ellipse at 50% 44%, rgba(8,9,12,0.50) 0%, rgba(8,9,12,0.50) 26%, rgba(8,9,12,0.72) 62%, rgba(8,9,12,0.92) 100%)";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      
      className="relative z-1 -mt-[78px] flex min-h-screen flex-col items-center justify-center overflow-hidden pt-[78px] text-center"
    >
      <HeroMedia />
      {/* Marks where the photograph ends, so the header knows when it sits on it. */}
      <div id="hero-end" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b from-transparent to-bg"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] aspect-square w-[min(1500px,150vw)] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "radial-gradient(circle, var(--glow) 0%, var(--glow-2) 34%, transparent 63%)",
        }}
      />

      <div data-reveal className="relative grid w-full max-w-[1120px] justify-items-center px-8 pb-10 pt-20">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.22em] text-bone/80">
          Real-world collateral
        </p>
        <h1
          id="hero-heading"
          className="mt-7 font-display text-[clamp(42px,6.6vw,96px)] font-semibold leading-none tracking-[-0.032em] text-bone"
        >
          Unlock the value
          <br />
          <em className="font-serif font-normal italic tracking-[-0.02em]">of your assets</em>
        </h1>
        <p className="mt-[30px] max-w-[56ch] text-[18px] leading-[1.65] text-bone/86">
          A verified appraiser and the owner sign the same valuation. That signature becomes a
          collateral token on-chain, and the token opens a line of credit from a shared pool.
        </p>

        <div className="mt-[38px] flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-3.5 rounded-pill bg-bone py-[7px] pl-[26px] pr-[7px] text-base font-medium text-ink transition-colors hover:bg-white"
          >
            Get started
            <span
              aria-hidden="true"
              className="flex size-[38px] items-center justify-center rounded-pill bg-ink text-[15px] text-bone"
            >
              →
            </span>
          </Link>
          <Link
            href="/liquidations"
            className="rounded-pill border border-bone/30 bg-white/8 px-[26px] py-[15px] text-[15px] font-medium text-bone backdrop-blur-[16px] transition-colors hover:border-bone"
          >
            Open positions
          </Link>
        </div>
      </div>

      <div
        data-reveal
        className="relative flex w-full max-w-[1120px] flex-wrap justify-center gap-x-[clamp(18px,3vw,44px)] gap-y-3 px-8 pb-14 font-mono text-[11px] uppercase tracking-[0.14em] text-bone/78"
      >
        {TERMS.map((term) => (
          <span key={term}>{term}</span>
        ))}
      </div>
    </section>
  );
}
