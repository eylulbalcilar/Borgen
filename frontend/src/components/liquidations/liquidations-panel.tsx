"use client";

import { PositionRow, ROW_GRID, type Position } from "@/components/liquidations/position-card";
import { EmptyState, ScreenHeader } from "@/components/ui/panel";
import { SectionFlag, type Tone } from "@/components/ui/status";
import { useLiquidatable } from "@/lib/collateral";
import { usePoolData } from "@/lib/pool";

const COLUMNS = ["Token id", "Borrower", "Debt", "Collateral", "Due", "Health", ""];

export function LiquidationsPanel() {
  const { positions, refetch, isPending, error } = useLiquidatable();
  const pool = usePoolData();

  const refresh = () => {
    void refetch();
    void pool.refetch();
    setTimeout(() => void refetch(), 1500);
  };

  const atRisk = positions.filter((item) => item.isLiquidatable);
  const healthy = positions.filter((item) => !item.isLiquidatable);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-24 pt-11">
      <ScreenHeader
        eyebrow="( 0.6 ) Liquidations · public"
        title="Open positions"
        aside={
          <p className="max-w-[52ch] text-[14.5px] leading-[1.7]">
            Anyone may repay a position whose debt passes 80% of current value, or whose 30-day term
            has lapsed, and take the collateral token. No role required.
          </p>
        }
      />

      {isPending && (
        <p className="mt-9 font-mono text-[11.5px] uppercase tracking-[0.14em] text-dim">
          Reading positions from the pool…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-9 font-mono text-[11.5px] text-danger-text">
          {error.message}
        </p>
      )}

      {!isPending && !error && (
        <>
          <PositionTable
            tone="danger"
            flag={`Liquidatable · ${atRisk.length}`}
            positions={atRisk}
            allowance={pool.allowance}
            balance={pool.balance}
            onSuccess={refresh}
            emptyTitle="Nothing to liquidate"
            emptyBody="No position is past 80% of its collateral value or beyond its term right now."
            className="mt-9"
          />

          <PositionTable
            tone="verify"
            flag={`Healthy active loans · ${healthy.length}`}
            positions={healthy}
            allowance={pool.allowance}
            balance={pool.balance}
            onSuccess={refresh}
            emptyTitle="No active loans"
            emptyBody="Loans drawn against collateral tokens appear here until they are repaid."
            className="mt-11"
          />
        </>
      )}
    </div>
  );
}

function PositionTable({
  tone,
  flag,
  positions,
  allowance,
  balance,
  onSuccess,
  emptyTitle,
  emptyBody,
  className = "",
}: {
  tone: Tone;
  flag: string;
  positions: Position[];
  allowance: bigint;
  balance: bigint;
  onSuccess: () => void;
  emptyTitle: string;
  emptyBody: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3.5">
        <SectionFlag tone={tone}>{flag}</SectionFlag>
      </div>

      {positions.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      ) : (
        <div className="glass overflow-x-auto rounded-card">
          <div
            aria-hidden="true"
            className={`${ROW_GRID} border-b border-glass-border px-6 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim`}
          >
            {COLUMNS.map((column, index) => (
              <span key={column || index} className={index >= 2 ? "text-right" : undefined}>
                {column}
              </span>
            ))}
          </div>
          <ul>
            {positions.map((item) => (
              <PositionRow
                key={item.tokenId.toString()}
                position={item}
                allowance={allowance}
                balance={balance}
                onSuccess={onSuccess}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
