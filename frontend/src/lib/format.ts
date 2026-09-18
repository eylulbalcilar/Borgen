import { formatUnits, parseUnits } from "viem";
import { ASSET_DECIMALS, ASSET_SYMBOL } from "./contracts";

// Chain amounts are integers in the smallest unit; format only for display.
export function formatAmount(value: bigint | undefined, withSymbol = true): string {
  if (value === undefined) return "…";
  const formatted = Number(formatUnits(value, ASSET_DECIMALS)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${formatted} ${ASSET_SYMBOL}` : formatted;
}

// Returns undefined when the input is not a usable positive amount.
export function parseAmount(input: string): bigint | undefined {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return undefined;
  const value = parseUnits(trimmed, ASSET_DECIMALS);
  return value > 0n ? value : undefined;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
