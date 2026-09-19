"use client";

import { useEffect, useRef, useState } from "react";
import type { Abi, Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

export type TxStep = "idle" | "signing" | "confirming" | "done";

// Declining the wallet prompt is a normal outcome, not a failure to report.
// viem wraps the rejection, so the cause chain is walked for it.
function isUserRejection(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth += 1) {
    const node = current as { name?: string; code?: number; cause?: unknown };
    if (node.name === "UserRejectedRequestError" || node.code === 4001) return true;
    current = node.cause;
  }
  return false;
}

// Wraps a contract write: send, wait for the receipt, expose one status.
// onConfirmed runs once per successful transaction.
export function useTx(onConfirmed?: (hash: `0x${string}`) => void) {
  const { writeContractAsync, reset } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}`>();
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash });

  // Remembers the last handled hash so the callback never fires twice.
  const handled = useRef<string | undefined>(undefined);
  const callback = useRef(onConfirmed);
  callback.current = onConfirmed;

  useEffect(() => {
    if (!receipt.isSuccess || !hash || handled.current === hash) return;
    handled.current = hash;
    setStep("done");
    callback.current?.(hash);
  }, [receipt.isSuccess, hash]);

  async function send(request: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  }) {
    setError(null);
    setStep("signing");
    try {
      const txHash = await writeContractAsync(request as never);
      setHash(txHash);
      setStep("confirming");
      return txHash;
    } catch (err) {
      setStep("idle");
      if (!isUserRejection(err)) {
        const shortMessage =
          err && typeof err === "object" && "shortMessage" in err ? String(err.shortMessage) : null;
        setError(shortMessage ?? (err instanceof Error ? err.message : "Transaction failed"));
      }
      // Deliberately not rethrown: onPress ignores the returned promise, so a
      // rethrow escapes as an unhandled rejection instead of reaching the UI.
      return undefined;
    }
  }

  function clear() {
    setHash(undefined);
    setStep("idle");
    setError(null);
    reset();
  }

  const isBusy = step === "signing" || step === "confirming";

  return { send, clear, status: step, isBusy, error, hash };
}
