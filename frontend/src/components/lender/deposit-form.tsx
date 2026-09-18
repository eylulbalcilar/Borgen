"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { Button } from "@/components/ui/button";
import { ADDRESSES, lendingPoolAbi, stablecoinAbi } from "@/lib/contracts";
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
    <div className="flex flex-col gap-3">
      <label htmlFor="deposit-amount" className="text-sm font-medium">
        Deposit
      </label>
      <input
        id="deposit-amount"
        inputMode="decimal"
        placeholder="0.00"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        aria-describedby="deposit-balance"
        aria-invalid={tooLarge || undefined}
        className="h-10 w-full rounded-lg border border-input px-3 text-sm"
      />
      <p id="deposit-balance" className="text-sm text-muted-foreground">
        Wallet balance: {formatAmount(balance)}
      </p>

      <Button onPress={submit} isDisabled={!amount || tooLarge} isPending={tx.isBusy}>
        {tx.status === "signing"
          ? "Check your wallet…"
          : tx.status === "confirming"
            ? "Confirming…"
            : needsApproval
              ? "Approve"
              : "Deposit"}
      </Button>

      {tooLarge && (
        <p role="alert" className="text-sm text-destructive">
          Amount exceeds your balance.
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
