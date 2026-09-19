"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { AmountInput } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { TxStatus } from "@/components/ui/status";
import { ADDRESSES, ASSET_SYMBOL, lendingPoolAbi, stablecoinAbi } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";
import { useTx } from "@/lib/tx";

type Props = {
  balance: bigint;
  allowance: bigint;
  onSuccess: () => void;
};

type Action = "approve" | "deposit";

export function DepositForm({ balance, allowance, onSuccess }: Props) {
  const [input, setInput] = useState("");
  // Tracks which transaction is in flight, so approval does not reset the form.
  const [action, setAction] = useState<Action>("deposit");

  const tx = useTx(() => {
    if (action === "deposit") setInput("");
    onSuccess();
  });

  const amount = parseAmount(input);
  const needsApproval = amount !== undefined && allowance < amount;
  const tooLarge = amount !== undefined && amount > balance;

  async function submit() {
    if (!amount || tooLarge) return;
    tx.clear();

    if (needsApproval) {
      setAction("approve");
      await tx.send({
        address: ADDRESSES.stablecoin,
        abi: stablecoinAbi,
        functionName: "approve",
        args: [ADDRESSES.lendingPool, maxUint256],
      });
      return;
    }

    setAction("deposit");
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: lendingPoolAbi,
      functionName: "deposit",
      args: [amount],
    });
  }

  return (
    <Panel>
      <PanelHeader eyebrow="Deposit" title="Add liquidity to the pool" className="border-line" />

      <div className="grid gap-4 p-6">
        <AmountInput
          large
          label={`Amount to deposit in ${ASSET_SYMBOL}`}
          unit={ASSET_SYMBOL}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onMax={() => setInput((Number(balance) / 1_000_000).toFixed(2))}
          aria-invalid={tooLarge || undefined}
        />

        <dl className="grid gap-2.5 font-mono text-xs">
          <div className="flex justify-between">
            <dt className="text-dim">Available</dt>
            <dd className="text-text">{formatAmount(balance, false)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-dim">Borrow rate</dt>
            <dd className="text-text">10.00% APR</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-dim">Term</dt>
            <dd className="text-text">30 days</dd>
          </div>
        </dl>

        <PillButton onPress={submit} isDisabled={!amount || tooLarge} isPending={tx.isBusy}>
          {tx.status === "signing"
            ? "Check your wallet…"
            : tx.status === "confirming"
              ? "Confirming…"
              : needsApproval
                ? `Approve ${ASSET_SYMBOL}`
                : "Deposit"}
        </PillButton>

        {tooLarge && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            Amount exceeds your balance.
          </p>
        )}
        <TxStatus status={tx.status} error={tx.error} />
      </div>
    </Panel>
  );
}
