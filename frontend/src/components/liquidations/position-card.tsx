"use client";

import { Button } from "@/components/ui/button";
import { ADDRESSES, loanAbi, stablecoinAbi } from "@/lib/contracts";
import { formatAmount, shortenAddress } from "@/lib/format";
import { useTx } from "@/lib/tx";
import { maxUint256 } from "viem";

type Position = {
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

export function PositionCard({ position, allowance, balance, onSuccess }: Props) {
  const tx = useTx(onSuccess);

  const needsApproval = allowance < position.debt;
  const notEnoughFunds = balance < position.debt;
  const isOverdue = position.dueAt * 1000 < Date.now();

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

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Token #{position.tokenId.toString()}</h3>
        <span className="text-sm text-muted-foreground">
          {position.isLiquidatable ? (isOverdue ? "Overdue" : "Below threshold") : "Healthy"}
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Debt</dt>
          <dd>{formatAmount(position.debt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Collateral value</dt>
          <dd>{formatAmount(position.valuation)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Due</dt>
          <dd>{new Date(position.dueAt * 1000).toLocaleDateString()}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Borrower</dt>
          <dd>
            <span aria-hidden="true">{shortenAddress(position.borrower)}</span>
            <span className="sr-only">{position.borrower}</span>
          </dd>
        </div>
      </dl>

      {position.isLiquidatable && (
        <>
          <p className="text-sm text-muted-foreground">
            Repaying the debt transfers the collateral token to you.
          </p>
          <div>
            <Button
              size="sm"
              onPress={liquidate}
              isDisabled={notEnoughFunds && !needsApproval}
              isPending={tx.isBusy}
            >
              {tx.isBusy
                ? tx.status === "signing"
                  ? "Check your wallet…"
                  : "Confirming…"
                : needsApproval
                  ? "Approve mUSD"
                  : "Liquidate"}
            </Button>
          </div>
          {notEnoughFunds && (
            <p role="alert" className="text-sm text-destructive">
              You need {formatAmount(position.debt)} to liquidate this position.
            </p>
          )}
        </>
      )}

      {tx.error && (
        <p role="alert" className="text-sm text-destructive">
          {tx.error}
        </p>
      )}
    </li>
  );
}
