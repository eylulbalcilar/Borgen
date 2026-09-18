"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { Button } from "@/components/ui/button";
import { ADDRESSES, collateralNftAbi, loanAbi, stablecoinAbi } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";
import type { Collateral } from "@/lib/collateral";
import { useTx } from "@/lib/tx";

type Props = {
  item: Collateral;
  title: string;
  allowance: bigint;
  onSuccess: () => void;
};

export function CollateralCard({ item, title, allowance, onSuccess }: Props) {
  const [input, setInput] = useState("");
  const tx = useTx(() => {
    setInput("");
    onSuccess();
  });

  const amount = parseAmount(input);
  const exceedsLtv = amount !== undefined && amount > item.maxBorrow;
  const needsTokenApproval = !item.isApproved && !item.isEscrowed;
  const needsAssetApproval = allowance < item.debt;

  async function borrow() {
    if (!amount || exceedsLtv) return;
    tx.clear();

    // The pool pulls the token, so it must be approved first.
    if (needsTokenApproval) {
      await tx.send({
        address: ADDRESSES.collateralNft,
        abi: collateralNftAbi,
        functionName: "approve",
        args: [ADDRESSES.lendingPool, item.tokenId],
      });
      return;
    }

    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "borrow",
      args: [item.tokenId, amount],
    });
  }

  async function repay() {
    tx.clear();

    if (needsAssetApproval) {
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
      functionName: "repay",
      args: [item.tokenId],
    });
  }

  const busyLabel = tx.status === "signing" ? "Check your wallet…" : "Confirming…";

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-sm text-muted-foreground">Token #{item.tokenId.toString()}</span>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Valuation</dt>
          <dd>{formatAmount(item.valuation)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Max loan</dt>
          <dd>{formatAmount(item.maxBorrow)}</dd>
        </div>
        {item.hasLoan && (
          <>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Debt</dt>
              <dd>{formatAmount(item.debt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Due</dt>
              <dd>{new Date(item.dueAt * 1000).toLocaleDateString()}</dd>
            </div>
          </>
        )}
      </dl>

      {item.hasLoan ? (
        <div>
          <Button size="sm" onPress={repay} isPending={tx.isBusy}>
            {tx.isBusy ? busyLabel : needsAssetApproval ? "Approve mUSD" : "Repay and unlock"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor={`borrow-${item.tokenId}`} className="text-sm font-medium">
              Borrow amount
            </label>
            <input
              id={`borrow-${item.tokenId}`}
              inputMode="decimal"
              placeholder="0.00"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={exceedsLtv || undefined}
              className="h-10 w-full rounded-lg border border-input px-3 text-sm"
            />
          </div>
          <Button size="sm" onPress={borrow} isDisabled={!amount || exceedsLtv} isPending={tx.isBusy}>
            {tx.isBusy ? busyLabel : needsTokenApproval ? "Approve token" : "Borrow"}
          </Button>
        </div>
      )}

      {exceedsLtv && (
        <p role="alert" className="text-sm text-destructive">
          Maximum loan for this asset is {formatAmount(item.maxBorrow)}.
        </p>
      )}
      {tx.error && (
        <p role="alert" className="text-sm text-destructive">
          {tx.error}
        </p>
      )}
    </li>
  );
}
