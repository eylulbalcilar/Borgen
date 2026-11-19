"use client";

import { useState } from "react";
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
  // Up for sale, and what it costs right now. The price only ever falls.
  inAuction: boolean;
  price: bigint;
  floorPrice: bigint;
};

type Props = {
  position: Position;
  allowance: bigint;
  balance: bigint;
  // Whether this wallet may receive a collateral token, and how to get that
  // approval when it may not.
  canHold: boolean;
  requestAccess: () => Promise<void>;
  onSuccess: () => void;
};

// One table row. The grid matches the header row in liquidations-panel.
export const ROW_GRID =
  "grid min-w-[1220px] grid-cols-[140px_minmax(180px,1fr)_130px_130px_130px_120px_120px_150px] gap-4";

export function PositionRow({ position, allowance, balance, canHold, requestAccess, onSuccess }: Props) {
  const tx = useTx(onSuccess);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const now = useNow();

  const needsApproval = position.inAuction && allowance < position.price;
  const notEnoughFunds = position.inAuction && balance < position.price;
  const isOverdue = now !== null && position.dueAt * 1000 < now;

  // Debt against current collateral value; 80% is the liquidation threshold.
  const health =
    position.valuation > 0n ? Number((position.debt * 10_000n) / position.valuation) / 100 : 0;

  async function openSale() {
    tx.clear();
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "startAuction",
      args: [position.tokenId],
    });
  }

  async function buy() {
    tx.clear();
    setAccessError(null);

    if (needsApproval) {
      await tx.send({
        address: ADDRESSES.stablecoin,
        abi: stablecoinAbi,
        functionName: "approve",
        args: [ADDRESSES.lendingPool, maxUint256],
      });
      return;
    }

    // The token can only be sent to an approved wallet, so settle that first
    // or the purchase reverts.
    if (!canHold) {
      setIsPreparing(true);
      try {
        await requestAccess();
      } catch (err) {
        setAccessError(err instanceof Error ? err.message : "Could not approve this wallet.");
        return;
      } finally {
        setIsPreparing(false);
      }
    }

    // The price shown is the most this purchase will pay. The live price can
    // only be at or below it by the time the transaction lands.
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "buy",
      args: [position.tokenId, position.price],
    });
  }

  const due = new Date(position.dueAt * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const isBusy = tx.isBusy || isPreparing;
  const busyLabel = isPreparing
    ? "Approving wallet…"
    : tx.status === "signing"
      ? "Check wallet…"
      : "Confirming…";

  const status = position.inAuction
    ? "On sale"
    : position.isLiquidatable
      ? isOverdue
        ? "Overdue"
        : "At risk"
      : "Healthy";

  const error = tx.error ?? accessError;

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
      <span className="text-right font-mono text-[13px] text-text">
        {position.inAuction ? formatAmount(position.price, false) : "-"}
      </span>
      <span
        className={`text-right font-mono text-xs ${isOverdue ? "text-danger-text" : "text-dim"}`}
      >
        {due}
      </span>
      <span className="justify-self-end">
        <Badge tone={position.isLiquidatable || position.inAuction ? "danger" : "verify"}>
          {status}
          <span className="sr-only">, debt at {health.toFixed(0)}% of collateral value</span>
        </Badge>
      </span>

      <span className="justify-self-end">
        {position.inAuction ? (
          <PillButton
            variant="danger"
            size="sm"
            onPress={buy}
            isDisabled={notEnoughFunds && !needsApproval}
            isPending={isBusy}
          >
            {isBusy ? busyLabel : needsApproval ? `Approve ${ASSET_SYMBOL}` : "Buy at this price"}
          </PillButton>
        ) : position.isLiquidatable ? (
          <PillButton variant="danger" size="sm" onPress={openSale} isPending={isBusy}>
            {isBusy ? busyLabel : "Open sale"}
          </PillButton>
        ) : (
          <span className="font-mono text-[10.5px] text-dim">Not eligible</span>
        )}
      </span>

      {(error ?? notEnoughFunds) && (
        <p role="alert" className="col-span-full font-mono text-[11px] text-danger-text">
          {error ?? `You need ${formatAmount(position.price)} to buy this collateral.`}
        </p>
      )}
    </li>
  );
}
