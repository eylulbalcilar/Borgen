import Link from "next/link";
import { BorgenMark } from "@/components/borgen-mark";
import { ADDRESSES } from "@/lib/contracts";

const EXPLORER = "https://sepolia.basescan.org";

const COLUMNS = [
  {
    title: "Protocol",
    links: [
      { label: "Liquidations", href: "/liquidations" },
      { label: "Contracts ↗", href: `${EXPLORER}/address/${ADDRESSES.lendingPool}`, external: true },
    ],
  },
  {
    title: "Participate",
    links: [
      { label: "Borrow", href: "/borrower" },
      { label: "Lend", href: "/lender" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Appraisers", href: "/appraiser" },
      { label: "Documentation", href: "https://github.com/eylulbalcilar/Borgen", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative z-1 border-t border-glass-border bg-bg">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-start justify-between gap-10 px-8 py-11">
        <div className="grid gap-3.5">
          <div className="flex items-center gap-2.5 text-text">
            <BorgenMark size={18} aria-hidden="true" />
            <span className="font-serif text-[17px] font-semibold tracking-[-0.012em]">Borgen</span>
          </div>
          <p className="font-mono text-[11px] tracking-[0.08em] text-dim">
            Real-world collateral, on-chain credit
          </p>
        </div>

        <nav className="flex flex-wrap gap-14 font-mono text-[11.5px]" aria-label="Footer">
          {COLUMNS.map((column) => (
            <div key={column.title} className="grid gap-2.5">
              <h2 className="text-[10px] uppercase tracking-[0.14em] text-dim">{column.title}</h2>
              {column.links.map((link) =>
                link.external ? (
                  <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="link-seal w-fit">
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.label} href={link.href} className="link-seal w-fit">
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1320px] flex-wrap justify-between gap-6 px-8 py-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-dim">
          <span>© 2026 Borgen</span>
          <span>Not an offer of credit in any jurisdiction</span>
        </div>
      </div>
    </footer>
  );
}
