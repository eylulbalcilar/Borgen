"use client";

import { useAccount, useReadContract } from "wagmi";
import { ClaimNotice } from "@/components/claim-notice";
import { PositionRow, ROW_GRID, type Position } from "@/components/liquidations/position-card";
import { EmptyState, ScreenHeader } from "@/components/ui/panel";
import { SectionFlag, type Tone } from "@/components/ui/status";
import { useAuth } from "@/lib/auth";
import { useLiquidatable } from "@/lib/collateral";
import { ADDRESSES, collateralNftAbi } from "@/lib/contracts";
import { usePoolData } from "@/lib/pool";

const COLUMNS = ["Token id", "Borrower", "Debt", "Collateral", "Sale price", "Due", "Health", ""];

export function LiquidationsPanel() {
  const { positions, refetch, isPending, error } = useLiquidatable();
  const pool = usePoolData();
  const { address } = useAccount();
  const { request } = useAuth();

  // Collateral can only be sent to a wallet that has been approved to hold it.
  const access = useReadContract({
    address: ADDRESSES.collateralNft,
    abi: collateralNftAbi,
    functionName: "isTransferAllowed",
    args: [address ?? "0x"],
    query: { enabled: Boolean(address) },
  });

  const requestAccess = async () => {
    await request("/users/me/collateral-access", { method: "POST" });
    await access.refetch();
  };

  const refresh = () => {
    void refetch();
    void pool.refetch();
    setTimeout(() => void refetch(), 1500);
  };

  const atRisk = positions.filter((item) => item.isLiquidatable || item.inAuction);
  const healthy = positions.filter((item) => !item.isLiquidatable && !item.inAuction);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-24 pt-11">
      <ScreenHeader
        eyebrow="( 0.6 ) Liquidations · public"
        title="Open positions"
        aside={
          <p className="max-w-[52ch] text-[14.5px] leading-[1.7]">
            When a debt passes 80% of the current value of its collateral, or its term lapses, anyone
            may open a sale. The price falls until someone buys. The sale repays the debt and the
            rest goes back to the owner.
          </p>
        }
      />

      <ClaimNotice amount={pool.claimable} onSuccess={refresh} />

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
            flag={`At risk or on sale · ${atRisk.length}`}
            positions={atRisk}
            allowance={pool.allowance}
            balance={pool.balance}
            canHold={access.data ?? false}
            requestAccess={requestAccess}
            onSuccess={refresh}
            emptyTitle="Nothing for sale"
            emptyBody="No position is past 80% of its collateral value or beyond its term right now."
            className="mt-9"
          />

          <PositionTable
            tone="verify"
            flag={`Healthy active loans · ${healthy.length}`}
            positions={healthy}
            allowance={pool.allowance}
            balance={pool.balance}
            canHold={access.data ?? false}
            requestAccess={requestAccess}
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
  canHold,
  requestAccess,
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
  canHold: boolean;
  requestAccess: () => Promise<void>;
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
                canHold={canHold}
                requestAccess={requestAccess}
                onSuccess={onSuccess}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
