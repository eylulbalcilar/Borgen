"use client";

import { useId, type ReactNode } from "react";
import { PillButton } from "@/components/ui/pill-button";

const FIELD =
  "w-full rounded-field border border-glass-border bg-surface-2 px-[13px] py-3 text-text outline-none focus-visible:border-seal";

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
      {children}
    </label>
  );
}

export function TextField({
  label,
  mono = false,
  error,
  className = "",
  ...props
}: { label: ReactNode; mono?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const id = props.id ?? generated;
  const errorId = `${id}-error`;
  return (
    <div className={`grid gap-2 ${className}`}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : props["aria-describedby"]}
        className={`${FIELD} ${mono ? "font-mono text-sm" : "text-[15px]"} ${error ? "border-danger" : ""}`}
      />
      {error && (
        <p id={errorId} className="font-mono text-[11px] text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  className = "",
  ...props
}: { label: ReactNode } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <div className={`grid gap-2 ${className}`}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        {...props}
        id={id}
        className={`${FIELD} resize-y text-[14.5px] leading-[1.6]`}
      />
    </div>
  );
}

/*
  Amount input: a mono figure, the settlement unit, and an optional MAX chip.
  The whole row is the field, so the border reacts to focus inside it.
*/
export function AmountInput({
  label,
  unit,
  onMax,
  large = false,
  className = "",
  ...props
}: {
  label: string;
  unit: string;
  onMax?: () => void;
  large?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <div
      className={`flex items-center rounded-field border border-glass-border bg-surface-2 px-[13px] focus-within:border-seal ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        {...props}
        id={id}
        inputMode="decimal"
        placeholder={props.placeholder ?? "0.00"}
        className={`min-w-0 flex-1 border-0 bg-transparent py-3.5 font-mono text-text outline-none ${
          large ? "text-[19px]" : "text-[15px]"
        }`}
      />
      <span aria-hidden="true" className="ml-2 font-mono text-[11px] text-dim">
        {unit}
      </span>
      {onMax && (
        <PillButton variant="chip" size="chip" className="ml-2.5" onPress={onMax}>
          Max
        </PillButton>
      )}
    </div>
  );
}
