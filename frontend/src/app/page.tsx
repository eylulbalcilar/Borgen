import { Hero } from "@/components/landing/hero";
import { PhotoBand } from "@/components/landing/photo-band";
import { PoolLive } from "@/components/landing/pool-live";
import bandFacade from "@/components/landing/band-facade.jpg";
import bandTowers from "@/components/landing/band-towers.jpg";
import { Accent, SectionHeading } from "@/components/landing/section-heading";
import { ADDRESSES } from "@/lib/contracts";
import { shortenAddress } from "@/lib/format";

const STEPS = [
  {
    num: "01",
    title: "Request",
    body: "The owner submits the asset to a credentialed appraiser on Neuro: title, serial number, supporting documents and a requested value.",
  },
  {
    num: "02",
    title: "Sign",
    body: "The appraiser sets a value and signs. The owner counter-signs the same document, so the valuation carries two verified identities.",
  },
  {
    num: "03",
    title: "Issue",
    body: "A relay writes the signed valuation on-chain as a collateral token carrying the value and the owner's wallet address.",
  },
  {
    num: "04",
    title: "Borrow",
    body: "Locking the token opens a line of up to 50% of appraised value, drawn from the shared pool in mUSD at 10% APR over a 30-day term.",
  },
  {
    num: "05",
    title: "Repay",
    body: "Principal plus interest unlocks the token. If debt passes 80% of current value or the term lapses, anyone may repay the debt and take the collateral.",
  },
];

const SEATS = [
  {
    tag: "Role 01",
    title: "Borrower",
    body: "Keep the asset, unlock the balance sheet. No custody transfer, no private negotiation, terms visible to everyone.",
    facts: [
      { k: "Max LTV", v: "50%" },
      { k: "Rate", v: "10% APR" },
      { k: "Term", v: "30 days" },
    ],
  },
  {
    tag: "Role 02",
    title: "Appraiser",
    body: "Credentialed valuation as a protocol function. Sign, keep values current, build a public record against your identity.",
    facts: [
      { k: "Signature", v: "Dual" },
      { k: "Re-value", v: "Any time" },
      { k: "Record", v: "On-chain" },
    ],
  },
  {
    tag: "Role 03",
    title: "Lender",
    body: "Supply mUSD against collateral you can inspect. Every position, value and due date is readable on-chain.",
    facts: [
      { k: "Asset", v: "mUSD" },
      { k: "Exit", v: "On liquidity" },
      { k: "Settlement", v: "Instant" },
    ],
  },
];

const EXPLORER = "https://sepolia.basescan.org/address/";

const CONTRACTS = [
  {
    name: "CollateralNFT",
    desc: "ERC-721 collateral token carrying appraised value and owner wallet",
    address: ADDRESSES.collateralNft,
  },
  {
    name: "LendingPool",
    desc: "Shared lending pool, mUSD accounting, interest accrual and liquidation",
    address: ADDRESSES.lendingPool,
  },
  { name: "mUSD", desc: "Settlement stablecoin, 6 decimals", address: ADDRESSES.stablecoin },
];

export default function Home() {
  return (
    <>
      <Hero />

      <section aria-labelledby="problem-heading" className="section-y relative z-1 overflow-hidden px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(1100px,120vw)] -translate-x-1/2 -translate-y-1/2"
          style={{ background: "radial-gradient(circle, var(--glow-2) 0%, transparent 62%)" }}
        />
        <div data-reveal className="relative mx-auto max-w-[900px] text-center">
          <SectionHeading id="problem-heading" eyebrow="The problem">
            Balance sheet that
            <br />
            <Accent>cannot move</Accent>
          </SectionHeading>
          <p className="mx-auto mt-7 max-w-[62ch] text-[17.5px] leading-[1.7] text-dim">
            A watch in a safe, a canvas on a wall, a press on a factory floor. Selling means losing
            the asset. Borrowing against it means a private lender, an opaque discount and weeks of
            paperwork nobody else can verify.
          </p>
          <p className="mx-auto mt-5 max-w-[62ch] text-[17.5px] leading-[1.7] text-dim">
            Borgen keeps the asset where it is and moves only the proof: one counter-signed
            valuation, relayed on-chain, auditable by anyone.
          </p>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="relative z-1 px-8 pb-[clamp(88px,13vh,150px)]">
        <div data-reveal className="mx-auto mb-14 max-w-[900px] text-center">
          <SectionHeading id="how-heading" eyebrow="How it works">
            Five steps, <Accent>two signatures</Accent>
          </SectionHeading>
        </div>
        <ol className="mx-auto grid max-w-[1320px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px]">
          {STEPS.map((step) => (
            <li
              key={step.num}
              data-reveal
              className="glass grid content-start gap-3.5 rounded-card px-[26px] pb-[30px] pt-7"
            >
              <span className="font-mono text-[11px] tracking-[0.14em] text-seal-text">{step.num}</span>
              <h3 className="font-serif text-[27px] font-normal italic leading-[1.1] text-text">
                {step.title}
              </h3>
              <p className="text-[14.5px] leading-[1.65] text-dim">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <PhotoBand image={bandTowers} />

      <section aria-labelledby="seats-heading" className="relative z-1 px-8 pb-[clamp(88px,13vh,150px)] pt-[clamp(72px,10vh,120px)]">
        <div data-reveal className="mx-auto mb-14 max-w-[900px] text-center">
          <SectionHeading id="seats-heading" eyebrow="Three seats">
            One pool,
            <br />
            <Accent>three roles</Accent>
          </SectionHeading>
        </div>
        <ul className="mx-auto grid max-w-[1320px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
          {SEATS.map((seat) => (
            <li
              key={seat.title}
              data-reveal
              className="glass grid min-h-[330px] content-start gap-4 rounded-feature px-[30px] pb-7 pt-8"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-seal-text">
                {seat.tag}
              </span>
              <h3 className="font-serif text-[34px] font-normal italic leading-[1.05] text-text">
                {seat.title}
              </h3>
              <p className="text-[15px] leading-[1.7] text-dim">{seat.body}</p>
              <dl className="mt-auto grid gap-2.5 border-t border-glass-border pt-4 font-mono text-[11.5px] text-dim">
                {seat.facts.map((fact) => (
                  <div key={fact.k} className="flex justify-between gap-4">
                    <dt>{fact.k}</dt>
                    <dd className="text-text">{fact.v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pool-heading" className="relative z-1 px-8 pb-[clamp(88px,13vh,150px)]">
        <div data-reveal className="mx-auto mb-12 max-w-[900px] text-center">
          <SectionHeading id="pool-heading" eyebrow="Pool liquidity">
            Read straight <Accent>from the contract</Accent>
          </SectionHeading>
        </div>
        <PoolLive />
      </section>

      <PhotoBand image={bandFacade} />

      <section aria-labelledby="built-heading" className="relative z-1 px-8 pb-[clamp(88px,13vh,150px)] pt-[clamp(72px,10vh,120px)]">
        <div data-reveal className="mx-auto mb-11 max-w-[900px] text-center">
          <SectionHeading id="built-heading" eyebrow="Built on">
            Three contracts, <Accent>nothing hidden</Accent>
          </SectionHeading>
        </div>
        <ul className="mx-auto grid max-w-[1060px] gap-3">
          {CONTRACTS.map((contract) => (
            <li
              key={contract.name}
              data-reveal
              className="glass grid items-center gap-7 rounded-[20px] px-[26px] py-[22px] sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)_auto]"
            >
              <span className="text-[15.5px] font-semibold text-text">{contract.name}</span>
              <span className="text-sm leading-[1.6] text-dim">{contract.desc}</span>
              <a
                href={EXPLORER + contract.address}
                target="_blank"
                rel="noreferrer"
                className="link-seal w-fit whitespace-nowrap font-mono text-[13px]"
              >
                <span aria-hidden="true">{shortenAddress(contract.address)} ↗</span>
                <span className="sr-only">{contract.address}, view on the block explorer</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
