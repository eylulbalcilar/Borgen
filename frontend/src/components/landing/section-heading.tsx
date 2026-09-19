import type { ReactNode } from "react";

// Every landing section: mono eyebrow, then a headline whose accent line is
// the same size in serif italic.
export function SectionHeading({
  id,
  eyebrow,
  children,
  className = "",
}: {
  id?: string;
  eyebrow: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <p className="font-mono text-[11.5px] uppercase tracking-[0.22em] text-dim">{eyebrow}</p>
      <h2
        id={id}
        className={`mt-6 font-display text-[clamp(34px,4.6vw,64px)] font-semibold leading-[1.04] tracking-[-0.028em] text-text ${className}`}
      >
        {children}
      </h2>
    </>
  );
}

// The second line of a headline.
export function Accent({ children }: { children: ReactNode }) {
  return (
    <em className="font-serif text-[1em] font-normal italic tracking-[-0.018em]">{children}</em>
  );
}
