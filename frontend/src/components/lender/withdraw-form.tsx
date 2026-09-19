"use client";

import { useState } from "react";
import { AmountInput } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { TxStatus } from "@/components/ui/status";
import { ADDRESSES, ASSET_SYMBOL, lendingPoolAbi } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";
import { useTx } from "@/lib/tx";

type Props = {
  shares: bigint;
  position: bigint;
  available: bigint | undefined;
  onSuccess: () => void;
};

export function WithdrawForm({ shares, position, available, onSuccess }: Props) {
  const [input, setInput] = useState("");
  const tx = useTx(() => {
    setInput("");
    onSuccess();
  });

  const amount = parseAmount(input);

  // The contract takes shares, the user thinks in mUSD.
  // Withdrawing everything uses the share balance directly to avoid rounding dust.
  const isFullWithdrawal = amount !== undefined && amount >= position;
  const sharesToBurn =
    amount === undefined || position === 0n
      ? 0n
      : isFullWithdrawal
        ? shares
        : (amount * shares) / position;

  const tooLarge = amount !== undefined && amount > position;
  const notEnoughLiquidity =
    amount !== undefined && available !== undefined && amount > available && !tooLarge;

  async function submit() {
    if (!sharesToBurn || tooLarge) return;
    await tx.send({
      address: ADDRESSES.lendingPool,
      abi: lendingPoolAbi,
      functionName: "withdraw",
      args: [sharesToBurn],
    });
  }

  return (
    <Panel>
      <PanelHeader eyebrow="Withdraw" title="Redeem from your position" className="border-line" />

      <div className="grid gap-4 p-6">
        <AmountInput
          large
          label={`Amount to withdraw in ${ASSET_SYMBOL}`}
          unit={ASSET_SYMBOL}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onMax={() => setInput((Number(position) / 1_000_000).toFixed(2))}
          aria-invalid={tooLarge || undefined}
        />

        <dl className="grid gap-2.5 font-mono text-xs">
          <div className="flex justify-between">
            <dt className="text-dim">Your position</dt>
            <dd className="text-text">{formatAmount(position, false)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-dim">Instantly redeemable</dt>
            <dd className="text-text">{formatAmount(available, false)}</dd>
          </div>
        </dl>

        <PillButton
          variant="outline"
          onPress={submit}
          isDisabled={!amount || tooLarge || notEnoughLiquidity}
          isPending={tx.isBusy}
        >
          {tx.status === "signing" ? "Check your wallet…" : tx.status === "confirming" ? "Confirming…" : "Withdraw"}
        </PillButton>

        <p className="font-mono text-[10.5px] leading-[1.7] text-dim">
          Redemptions are capped by available liquidity. The remainder can be withdrawn once a
          repayment lands.
        </p>

        {tooLarge && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            Amount exceeds your position.
          </p>
        )}
        {notEnoughLiquidity && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            Not enough liquidity right now: {formatAmount(available)} available.
          </p>
        )}
        <TxStatus status={tx.status} error={tx.error} />
      </div>
    </Panel>
  );
}
