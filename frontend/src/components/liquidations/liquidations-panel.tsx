"use client";

import { PositionCard } from "@/components/liquidations/position-card";
import { useLiquidatable } from "@/lib/collateral";
import { usePoolData } from "@/lib/pool";

export function LiquidationsPanel() {
  const { positions, refetch, isPending, error } = useLiquidatable();
  const pool = usePoolData();

  const refresh = () => {
    void refetch();
    void pool.refetch();
    setTimeout(() => void refetch(), 1500);
  };

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading positions…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    );
  }

  const atRisk = positions.filter((item) => item.isLiquidatable);
  const healthy = positions.filter((item) => !item.isLiquidatable);

  return (
    <div className="flex w-full flex-col gap-10">
      <section aria-labelledby="at-risk-heading" className="flex flex-col gap-4">
        <h2 id="at-risk-heading" className="text-lg font-medium">
          Liquidatable positions
        </h2>
        {atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions can be liquidated right now.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {atRisk.map((item) => (
              <PositionCard
                key={item.tokenId.toString()}
                position={item}
                allowance={pool.allowance}
                balance={pool.balance}
                onSuccess={refresh}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="healthy-heading" className="flex flex-col gap-4">
        <h2 id="healthy-heading" className="text-lg font-medium">
          Active loans
        </h2>
        {healthy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active loans.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {healthy.map((item) => (
              <PositionCard
                key={item.tokenId.toString()}
                position={item}
                allowance={pool.allowance}
                balance={pool.balance}
                onSuccess={refresh}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
