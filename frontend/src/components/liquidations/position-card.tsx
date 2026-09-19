"use client";

import { maxUint256 } from "viem";
import { PillButton } from "@/components/ui/pill-button";
import { Badge } from "@/components/ui/status";
import { useNow } from "@/components/ui/use-now";
import { ADDRESSES, ASSET_SYMBOL, loanAbi, stablecoinAbi } from "@/lib/contracts";
import { formatAmount, shortenAddress } from "@/lib/format";
import { useTx } from "@/lib/tx";

const EXPLORER = "https://sepolia.basescan.org/address/";

export type Position = {
  tokenId: bigint;
  borrower: string;
  debt: bigint;
  dueAt: number;
  valuation: bigint;
  isLiquidatable: boolean;
};

type Props = {
  position: Position;
  allowance: bigint;
  balance: bigint;
  onSuccess: () => void;
};

// One table row. The grid matches the header row in liquidations-panel.
export const ROW_GRID =
  "grid min-w-[1090px] grid-cols-[140px_minmax(180px,1fr)_130px_130px_120px_120px_130px] gap-4";

export function PositionRow({ position, allowance, balance, onSuccess }: Props) {
  const tx = useTx(onSuccess);

  const now = useNow();

  const needsApproval = allowance < position.debt;
  const notEnoughFunds = balance < position.debt;
  const isOverdue = now !== null && position.dueAt * 1000 < now;

  // Debt against current collateral value; 80% is the liquidation threshold.
  const health =
    position.valuation > 0n ? Number((position.debt * 10_000n) / position.valuation) / 100 : 0;

  async function liquidate() {
    tx.clear();

    if (needsApproval) {
      await tx.send({
        address: ADDRESSES.stablecoin,
        abi: stablecoinAbi,
        functionName: "approve",
        args: [ADDRESSES.lendingPool, maxUint256],
      });
      return;
    }

    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "liquidate",
      args: [position.tokenId],
    });
  }

  const due = new Date(position.dueAt * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <li className={`${ROW_GRID} items-center border-b border-line px-6 py-[15px] last:border-b-0`}>
      <a
        href={EXPLORER + ADDRESSES.collateralNft}
        target="_blank"
        rel="noreferrer"
        className="link-seal w-fit font-mono text-[12.5px]"
      >
        Token #{position.tokenId.toString()} ↗
      </a>

      <div className="min-w-0">
        <a
          href={EXPLORER + position.borrower}
          target="_blank"
          rel="noreferrer"
          className="link-seal font-mono text-[11.5px]"
        >
          <span aria-hidden="true">{shortenAddress(position.borrower)} ↗</span>
          <span className="sr-only">Borrower {position.borrower}</span>
        </a>
      </div>

      <span className="text-right font-mono text-[13px] text-text">
        {formatAmount(position.debt, false)}
      </span>
      <span className="text-right font-mono text-[13px]">
        {formatAmount(position.valuation, false)}
      </span>
      <span
        className={`text-right font-mono text-xs ${isOverdue ? "text-danger-text" : "text-dim"}`}
      >
        {due}
      </span>
      <span className="justify-self-end">
        <Badge tone={position.isLiquidatable ? "danger" : "verify"}>
          {position.isLiquidatable ? (isOverdue ? "Overdue" : "At risk") : "Healthy"}
          <span className="sr-only">, debt at {health.toFixed(0)}% of collateral value</span>
        </Badge>
      </span>

      <span className="justify-self-end">
        {position.isLiquidatable ? (
          <PillButton
            variant="danger"
            size="sm"
            onPress={liquidate}
            isDisabled={notEnoughFunds && !needsApproval}
            isPending={tx.isBusy}
          >
            {tx.isBusy
              ? tx.status === "signing"
                ? "Check wallet…"
                : "Confirming…"
              : needsApproval
                ? `Approve ${ASSET_SYMBOL}`
                : "Liquidate"}
          </PillButton>
        ) : (
          <span className="font-mono text-[10.5px] text-dim">Not eligible</span>
        )}
      </span>

      {(tx.error ?? (notEnoughFunds && position.isLiquidatable)) && (
        <p role="alert" className="col-span-full font-mono text-[11px] text-danger-text">
          {tx.error ?? `You need ${formatAmount(position.debt)} to liquidate this position.`}
        </p>
      )}
    </li>
  );
}
