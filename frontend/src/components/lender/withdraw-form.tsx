"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ADDRESSES, lendingPoolAbi } from "@/lib/contracts";
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
    <div className="flex flex-col gap-3">
      <label htmlFor="withdraw-amount" className="text-sm font-medium">
        Withdraw
      </label>
      <input
        id="withdraw-amount"
        inputMode="decimal"
        placeholder="0.00"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        aria-describedby="withdraw-position"
        aria-invalid={tooLarge || undefined}
        className="h-10 w-full rounded-lg border border-input px-3 text-sm"
      />
      <p id="withdraw-position" className="text-sm text-muted-foreground">
        Your position: {formatAmount(position)}
      </p>

      <Button
        variant="outline"
        onPress={submit}
        isDisabled={!amount || tooLarge || notEnoughLiquidity}
        isPending={tx.isBusy}
      >
        {tx.status === "signing" ? "Check your wallet…" : tx.status === "confirming" ? "Confirming…" : "Withdraw"}
      </Button>

      {tooLarge && (
        <p role="alert" className="text-sm text-destructive">
          Amount exceeds your position.
        </p>
      )}
      {notEnoughLiquidity && (
        <p role="alert" className="text-sm text-destructive">
          Not enough liquidity right now: {formatAmount(available)} available.
        </p>
      )}
      {tx.error && (
        <p role="alert" className="text-sm text-destructive">
          {tx.error}
        </p>
      )}
    </div>
  );
}
