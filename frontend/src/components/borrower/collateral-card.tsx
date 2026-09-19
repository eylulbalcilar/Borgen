"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { AmountInput } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { PillButton } from "@/components/ui/pill-button";
import { Badge, TxStatus } from "@/components/ui/status";
import type { Collateral } from "@/lib/collateral";
import { ADDRESSES, ASSET_SYMBOL, collateralNftAbi, loanAbi, stablecoinAbi } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";
import { useTx } from "@/lib/tx";

type Props = {
  item: Collateral;
  title: string;
  allowance: bigint;
  wallet: string | undefined;
  onSuccess: () => void;
};

function toInput(value: bigint) {
  return (Number(value) / 1_000_000).toFixed(2);
}

export function CollateralCard({ item, title, allowance, wallet, onSuccess }: Props) {
  const [input, setInput] = useState("");
  const tx = useTx(() => {
    setInput("");
    onSuccess();
  });

  /*
    Once escrowed the pool holds the token and the loan records the borrower;
    otherwise the wallet must be the owner. If neither matches, every action on
    this token reverts, so the card offers none.
  */
  const holder = item.isEscrowed ? item.loanBorrower : item.owner;
  const isHeld = Boolean(wallet && holder && holder.toLowerCase() === wallet.toLowerCase());

  const amount = parseAmount(input);
  const exceedsLtv = amount !== undefined && amount > item.maxBorrow;
  const needsTokenApproval = !item.isApproved && !item.isEscrowed;
  const needsAssetApproval = allowance < item.debt;

  // Debt as a share of the maximum loan; 100% here is the 50% LTV ceiling.
  const usage = item.maxBorrow > 0n ? Number((item.debt * 10_000n) / item.maxBorrow) / 100 : 0;

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

  const metrics = [
    { k: "Appraised", v: formatAmount(item.valuation, false) },
    { k: "Max loan", v: formatAmount(item.maxBorrow, false) },
    { k: "Current debt", v: formatAmount(item.debt, false) },
    {
      k: "Due",
      v: item.hasLoan ? new Date(item.dueAt * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-",
    },
  ];

  return (
    <li className="glass grid content-start overflow-hidden rounded-[24px]">
      <div className="flex items-start justify-between gap-[18px] border-b border-line px-6 pb-5 pt-6">
        <div>
          <h3 className="font-serif text-[23px] font-semibold leading-[1.25] text-text">{title}</h3>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-dim">
            Token #{item.tokenId.toString()}
          </p>
        </div>
        <Badge tone={item.hasLoan ? "seal" : "verify"} dot>
          {item.hasLoan ? "Locked · borrowed" : "Signed appraisal"}
        </Badge>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-px bg-glass-border">
        {metrics.map((metric) => (
          <div key={metric.k} className="bg-glass px-4 py-3.5">
            <dt className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.08em] text-dim">
              {metric.k}
            </dt>
            <dd className="mt-[7px] font-mono text-[15.5px] text-text">{metric.v}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-line px-6 py-5">
        <Meter
          thin
          value={usage}
          label={`Debt ${usage.toFixed(0)}% of max loan`}
          note="Liquidation at 80%"
        />
      </div>

      <div className="grid gap-3 px-6 pb-6">
        {!isHeld ? (
          <p
            role="alert"
            className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-field border border-seal-border bg-seal-bg px-[13px] py-3"
          >
            <span aria-hidden="true" className="mt-1.5 block size-[7px] bg-seal" />
            <span className="text-[13px] leading-[1.6] text-seal-text">
              This token is held by another address, so it cannot be borrowed against or repaid
              from this wallet. Connect the wallet that owns it, or request a new valuation from
              this one.
            </span>
          </p>
        ) : item.hasLoan ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <PillButton onPress={repay} isPending={tx.isBusy}>
              {tx.isBusy ? busyLabel : needsAssetApproval ? `Approve ${ASSET_SYMBOL}` : "Repay and unlock"}
            </PillButton>
            <span className="font-mono text-[11.5px] text-dim">
              {formatAmount(item.debt)} incl. interest
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <AmountInput
              className="min-w-[200px] flex-1"
              label={`Borrow amount against token ${item.tokenId}`}
              unit={ASSET_SYMBOL}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onMax={() => setInput(toInput(item.maxBorrow - item.debt))}
              aria-invalid={exceedsLtv || undefined}
            />
            <PillButton onPress={borrow} isDisabled={!amount || exceedsLtv} isPending={tx.isBusy}>
              {tx.isBusy ? busyLabel : needsTokenApproval ? "Approve token" : "Borrow"}
            </PillButton>
          </div>
        )}

        {exceedsLtv && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            Maximum loan for this asset is {formatAmount(item.maxBorrow)}.
          </p>
        )}
        <TxStatus status={tx.status} error={tx.error} />
      </div>
    </li>
  );
}
