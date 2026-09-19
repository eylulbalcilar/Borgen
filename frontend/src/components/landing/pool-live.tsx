"use client";

import { formatAmount } from "@/lib/format";
import { usePoolStats } from "@/lib/pool";

function percent(borrowed: bigint | undefined, total: bigint | undefined) {
  if (borrowed === undefined || total === undefined || total === 0n) return undefined;
  return Number((borrowed * 10_000n) / total) / 100;
}

// Live numbers read straight from the lending pool.
export function PoolLive() {
  const { totalAssets, totalBorrowed } = usePoolStats();

  const available =
    totalAssets !== undefined && totalBorrowed !== undefined ? totalAssets - totalBorrowed : undefined;
  const utilisation = percent(totalBorrowed, totalAssets);

  const tiles = [
    { label: "Total liquidity", value: totalAssets, note: "mUSD · 6 decimals" },
    {
      label: "Currently borrowed",
      value: totalBorrowed,
      note: utilisation === undefined ? "Reading the pool…" : `${utilisation.toFixed(2)}% utilisation`,
    },
    { label: "Available to borrow", value: available, note: "Base Sepolia, latest block" },
  ];

  return (
    <div data-reveal className="glass mx-auto max-w-[1320px] rounded-feature p-2">
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[20px] bg-glass px-7 py-[30px]">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
              {tile.label}
            </dt>
            <dd className="mt-3.5 font-mono text-[34px] text-text">{formatAmount(tile.value, false)}</dd>
            <dd className="mt-2 font-mono text-[11px] text-dim">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <div className="px-7 pb-5 pt-[22px]">
        <div
          className="relative h-1.5 overflow-hidden rounded-pill bg-track"
          role="meter"
          aria-valuenow={utilisation ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Pool utilisation"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-pill bg-fill transition-[width] duration-700"
            style={{ width: `${utilisation ?? 0}%` }}
          />
        </div>
        <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim">
          Utilisation
        </p>
      </div>
    </div>
  );
}
