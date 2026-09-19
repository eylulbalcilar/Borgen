"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Button as ButtonPrimitive, type ButtonProps } from "react-aria-components";

// Pill buttons from the handoff. Built on react-aria's Button so onPress,
// isPending and isDisabled behave exactly as they did before the restyle.
const pillVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border font-sans font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        solid: "border-btn-bg bg-btn-bg text-btn-fg hover:border-btn-hover hover:bg-btn-hover",
        outline: "border-line-strong bg-transparent text-text hover:border-text",
        seal: "border-seal-border bg-transparent text-text hover:border-seal hover:bg-seal-bg",
        danger: "border-danger bg-transparent text-danger-text hover:bg-danger hover:text-bg",
        // Small mono chip, e.g. MAX inside an amount field or a table action.
        chip: "border-line-strong bg-transparent font-mono text-[10px] uppercase tracking-[0.1em] text-body hover:border-text hover:text-text",
      },
      size: {
        md: "px-[22px] py-3 text-sm",
        sm: "px-[14px] py-2 text-[13px]",
        chip: "px-[7px] py-1",
        "chip-lg": "px-3 py-[7px]",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export function PillButton({
  className,
  variant,
  size,
  ...props
}: Omit<ButtonProps, "className"> &
  VariantProps<typeof pillVariants> & { className?: string }) {
  return <ButtonPrimitive className={cn(pillVariants({ variant, size, className }))} {...props} />;
}
