"use client";

import type { ReactNode } from "react";
import type { TxStep } from "@/lib/tx";

export type Tone = "neutral" | "seal" | "verify" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong text-dim",
  seal: "border-seal-border bg-seal-bg text-seal-text",
  verify: "border-verify text-verify-text",
  danger: "border-danger text-danger-text",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-dim",
  seal: "bg-seal",
  verify: "bg-verify",
  danger: "bg-danger",
};

// Mono status pill: valuation state, loan health, credential.
export function Badge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-pill border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${TONES[tone]}`}
    >
      {dot && <span aria-hidden="true" className={`block size-1.5 rounded-pill ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}

// Section label with a leading square, used above the liquidation tables.
export function SectionFlag({ tone, children }: { tone: Tone; children: ReactNode }) {
  const text = tone === "danger" ? "text-danger-text" : tone === "verify" ? "text-verify-text" : "text-dim";
  return (
    <h2 className="flex items-center gap-3">
      <span aria-hidden="true" className={`block size-2 ${DOTS[tone]}`} />
      <span className={`font-mono text-[10.5px] uppercase tracking-[0.14em] ${text}`}>{children}</span>
    </h2>
  );
}

/*
  Transaction progress. Mirrors useTx: signing and confirming read as pending in
  gold, a confirmed write reads in teal.
*/
export function TxStatus({ status, error }: { status: TxStep; error?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="flex items-center gap-2.5 rounded-field border border-danger px-3 py-2.5 font-mono text-[11px] text-danger-text">
        {error}
      </p>
    );
  }

  if (status === "idle") return null;

  const done = status === "done";
  const label = done ? "Confirmed on-chain" : status === "signing" ? "Waiting for signature in wallet" : "Confirming on-chain";

  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-2.5 rounded-field border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] ${
        done ? "border-verify text-verify-text" : "border-seal-border bg-seal-bg text-seal-text"
      }`}
    >
      {!done && (
        <span
          aria-hidden="true"
          className="block size-[11px] rounded-full border-2 border-seal border-t-transparent motion-safe:animate-[borgen-spin_0.7s_linear_infinite]"
        />
      )}
      {label}
    </p>
  );
}
