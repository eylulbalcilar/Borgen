"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { AmountInput } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { PillButton } from "@/components/ui/pill-button";
import { Badge, TxStatus } from "@/components/ui/status";
import type { Collateral } from "@/lib/collateral";
import { ADDRESSES, ASSET_SYMBOL, collateralNftAbi, loanAbi, stablecoinAbi } from "@/lib/contracts";
import { formatAmount, parseAmount, toAmountInput } from "@/lib/format";
import { useTx } from "@/lib/tx";

type Props = {
  item: Collateral;
  title: string;
  allowance: bigint;
  // Idle money in the pool; undefined until it has been read.
  available: bigint | undefined;
  wallet: string | undefined;
  mintedTo: string | undefined;
  onSuccess: () => void;
};

type Action = "approve" | "borrow" | "repay" | "payDown" | "renew";

export function CollateralCard({ item, title, allowance, available, wallet, mintedTo, onSuccess }: Props) {
  const [input, setInput] = useState("");
  // Tracks which leg is in flight, so an approval does not wipe the amount the
  // borrower already typed for the borrow that follows it.
  const [action, setAction] = useState<Action>("borrow");

  // Which button started the transaction in flight, so only that one shows it.
  const [origin, setOrigin] = useState<Exclude<Action, "approve">>("borrow");

  const tx = useTx(() => {
    if (action === "borrow" || action === "payDown") setInput("");
    onSuccess();
  });

  /*
    Who may act on this token. While a loan is open the pool holds it and the
    loan carries the borrower, otherwise it is the owner. The record answers
    before the chain batch resolves, so the card does not flash an action it
    then hides, but the chain wins once loaded: a liquidation moves the token
    without touching the record. If neither names this wallet every action
    would revert, so the card offers none.
  */
  const chainHolder = item.isEscrowed ? item.loanBorrower : item.owner;
  const holder = chainHolder || mintedTo || "";
  const isHeld = Boolean(wallet && holder && holder.toLowerCase() === wallet.toLowerCase());

  const amount = parseAmount(input);
  const exceedsLtv = !item.hasLoan && amount !== undefined && amount > item.maxBorrow;
  // The pool can only lend what it holds. Checked here because a wallet turns
  // the revert into an unrelated gas limit error.
  const exceedsLiquidity =
    !item.hasLoan && !exceedsLtv && amount !== undefined && available !== undefined && amount > available;
  // Paying the whole debt goes through repay, which also returns the token.
  const coversDebt = item.hasLoan && amount !== undefined && amount >= item.debt;
  const needsTokenApproval = !item.isApproved && !item.isEscrowed;
  const needsAssetApproval = allowance < item.debt;

  // Debt as a share of the maximum loan; 100% here is the 50% LTV ceiling.
  const usage = item.maxBorrow > 0n ? Number((item.debt * 10_000n) / item.maxBorrow) / 100 : 0;

  async function borrow() {
    if (!amount || exceedsLtv || exceedsLiquidity) return;
    tx.clear();

    // The pool pulls the token, so it must be approved first.
    setOrigin("borrow");
    if (needsTokenApproval) {
      setAction("approve");
      await tx.send({
        address: ADDRESSES.collateralNft,
        abi: collateralNftAbi,
        functionName: "approve",
        args: [ADDRESSES.lendingPool, item.tokenId],
      });
      return;
    }

    setAction("borrow");
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "borrow",
      args: [item.tokenId, amount],
    });
  }

  // Every payment is pulled by the pool, so it needs an allowance first.
  // Returns true when it sent the approval instead of the payment.
  async function approveAssetFirst(from: Exclude<Action, "approve">) {
    tx.clear();
    setOrigin(from);
    if (!needsAssetApproval) return false;

    setAction("approve");
    await tx.send({
      address: ADDRESSES.stablecoin,
      abi: stablecoinAbi,
      functionName: "approve",
      args: [ADDRESSES.lendingPool, maxUint256],
    });
    return true;
  }

  async function repay() {
    if (await approveAssetFirst("repay")) return;

    setAction("repay");
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "repay",
      args: [item.tokenId],
    });
  }

  async function payDown() {
    if (!amount || coversDebt) return;
    if (await approveAssetFirst("payDown")) return;

    setAction("payDown");
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "repayPartial",
      args: [item.tokenId, amount],
    });
  }

  async function renew() {
    if (await approveAssetFirst("renew")) return;

    setAction("renew");
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: loanAbi,
      functionName: "renew",
      args: [item.tokenId],
    });
  }

  const busyLabel = tx.status === "signing" ? "Check your wallet…" : "Confirming…";
  const approveLabel = `Approve ${ASSET_SYMBOL}`;
  // The label a button shows: busy if it started the transaction in flight,
  // the approval step if one is still needed, otherwise its own action.
  const labelFor = (from: Exclude<Action, "approve">, text: string) =>
    tx.isBusy && origin === from ? busyLabel : needsAssetApproval ? approveLabel : text;

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
        <Badge tone={item.inAuction ? "danger" : item.hasLoan ? "seal" : "verify"} dot>
          {item.inAuction ? "Up for sale" : item.hasLoan ? "Locked · borrowed" : "Signed appraisal"}
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
              Issued to another wallet, so it cannot be used from here. Connect that wallet, or
              request a new valuation from this one.
            </span>
          </p>
        ) : item.hasLoan ? (
          <>
            {item.inAuction && (
              <p
                role="alert"
                className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-field border border-seal-border bg-seal-bg px-[13px] py-3"
              >
                <span aria-hidden="true" className="mt-1.5 block size-[7px] bg-seal" />
                <span className="text-[13px] leading-[1.6] text-seal-text">
                  This loan is overdue or no longer covered by its collateral, so the asset is up
                  for sale. Repaying the full debt before someone buys it takes it back. If it
                  sells, whatever is left after the debt is yours to collect.
                </span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <PillButton
                onPress={repay}
                isPending={tx.isBusy && origin === "repay"}
                isDisabled={tx.isBusy && origin !== "repay"}
              >
                {labelFor("repay", "Repay and unlock")}
              </PillButton>
              <span className="font-mono text-[11.5px] text-dim">
                {formatAmount(item.debt)} incl. interest
              </span>
            </div>
            {!item.inAuction && (
              <div className="flex flex-wrap gap-2.5">
                <AmountInput
                  className="min-w-[200px] flex-1"
                  label={`Amount to pay down on token ${item.tokenId}`}
                  unit={ASSET_SYMBOL}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  aria-invalid={coversDebt || undefined}
                />
                <PillButton
                  variant="outline"
                  onPress={payDown}
                  isPending={tx.isBusy && origin === "payDown"}
                  isDisabled={!amount || coversDebt || (tx.isBusy && origin !== "payDown")}
                >
                  {labelFor("payDown", "Pay down")}
                </PillButton>
                <PillButton
                  variant="outline"
                  onPress={renew}
                  isPending={tx.isBusy && origin === "renew"}
                  isDisabled={tx.isBusy && origin !== "renew"}
                >
                  {labelFor("renew", "Renew term")}
                </PillButton>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <AmountInput
              className="min-w-[200px] flex-1"
              label={`Borrow amount against token ${item.tokenId}`}
              unit={ASSET_SYMBOL}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onMax={() => {
                // The most that can actually be drawn: the loan limit, or what
                // the pool holds if that is less.
                const limit = item.maxBorrow - item.debt;
                setInput(toAmountInput(available !== undefined && available < limit ? available : limit));
              }}
              aria-invalid={exceedsLtv || exceedsLiquidity || undefined}
            />
            <PillButton
              onPress={borrow}
              isDisabled={!amount || exceedsLtv || exceedsLiquidity}
              isPending={tx.isBusy}
            >
              {tx.isBusy ? busyLabel : needsTokenApproval ? "Approve token" : "Borrow"}
            </PillButton>
          </div>
        )}

        {exceedsLtv && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            Maximum loan for this asset is {formatAmount(item.maxBorrow)}.
          </p>
        )}
        {exceedsLiquidity && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            {available === 0n
              ? "The pool has nothing to lend yet. A lender has to deposit first."
              : `The pool can lend ${formatAmount(available ?? 0n)} right now.`}
          </p>
        )}
        {coversDebt && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            That covers the whole debt. Use Repay and unlock to close the loan.
          </p>
        )}
        <TxStatus status={tx.status} error={tx.error} />
      </div>
    </li>
  );
}
