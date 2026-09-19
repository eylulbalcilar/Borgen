import type { ReactNode } from "react";
import { BorgenMark } from "@/components/borgen-mark";

// The glass card that every panel on the app screens is built from.
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass overflow-hidden rounded-card ${className}`}>{children}</section>;
}

// Panel header: mono eyebrow above an optional serif title, plus an optional aside.
export function PanelHeader({
  eyebrow,
  title,
  aside,
  className = "",
}: {
  eyebrow: string;
  title?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-4 border-b border-glass-border px-6 py-5 ${className}`}
    >
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{eyebrow}</p>
        {title && <h2 className="mt-2 font-serif text-[22px] font-semibold text-text">{title}</h2>}
      </div>
      {aside}
    </div>
  );
}

// Screen header: numbered eyebrow, serif title, and a right-hand slot for figures.
export function ScreenHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-8 border-b border-line pb-[22px]">
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">{eyebrow}</p>
        <h1 className="font-serif text-[36px] font-semibold tracking-[-0.012em] text-text">{title}</h1>
      </div>
      {aside}
    </div>
  );
}

// One figure in a screen-header strip.
export function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="mb-[7px] font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
        {label}
      </dt>
      <dd className="font-mono text-[17px] text-text">{value}</dd>
    </div>
  );
}

// Shown when a list has nothing in it: the mark, one line, no call to action.
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[24px] border border-dashed border-glass-border p-10 text-center">
      <BorgenMark size={26} aria-hidden="true" className="text-dim opacity-60" />
      <p className="font-serif text-[19px] text-text">{title}</p>
      {children && <p className="max-w-[46ch] text-sm leading-[1.65] text-dim">{children}</p>}
    </div>
  );
}
