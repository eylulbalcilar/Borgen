"use client";

import { PillButton } from "@/components/ui/pill-button";
import { ADDRESSES, lendingPoolAbi } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { useTx } from "@/lib/tx";

/*
  Money the pool is holding for this wallet: what was left of a sale after the
  debt was repaid, or the fee for opening one. The pool does not send it on its
  own, so it has to be collected.
*/
export function ClaimNotice({ amount, onSuccess }: { amount: bigint; onSuccess: () => void }) {
  const tx = useTx(onSuccess);

  if (amount === 0n) return null;

  async function collect() {
    tx.clear();
    await tx.send({ address: ADDRESSES.lendingPool, abi: lendingPoolAbi, functionName: "claim", args: [] });
  }

  return (
    <div className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-card border border-seal-border bg-seal-bg px-6 py-4">
      <p className="text-[14.5px] leading-[1.6] text-text">
        The pool is holding {formatAmount(amount)} for you from a collateral sale.
      </p>
      <div className="flex items-center gap-3">
        {tx.error && (
          <span role="alert" className="font-mono text-[11px] text-danger-text">
            {tx.error}
          </span>
        )}
        <PillButton size="sm" onPress={collect} isPending={tx.isBusy}>
          {tx.isBusy ? (tx.status === "signing" ? "Check wallet…" : "Confirming…") : "Collect"}
        </PillButton>
      </div>
    </div>
  );
}
