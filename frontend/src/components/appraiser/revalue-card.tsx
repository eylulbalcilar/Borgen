"use client";

import { useState } from "react";
import { AmountInput } from "@/components/ui/field";
import { PillButton } from "@/components/ui/pill-button";
import { useRevalueAppraisal, type Appraisal } from "@/lib/appraisals";
import { ASSET_SYMBOL } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";

const EXPLORER = "https://sepolia.basescan.org/address/";

// One row of the issued-collateral table. Re-valuing updates the on-chain value;
// a lower value can push a loan past the liquidation threshold.
export function RevalueCard({ request }: { request: Appraisal }) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const revalue = useRevalueAppraisal();

  const amount = parseAmount(input);

  return (
    <li className="grid gap-3 border-b border-line px-6 py-3.5 last:border-b-0">
      <div className="grid items-center gap-4 sm:grid-cols-[150px_minmax(0,1fr)_130px_120px]">
        <a
          href={EXPLORER + request.tokenId}
          target="_blank"
          rel="noreferrer"
          className="link-seal w-fit font-mono text-[12.5px]"
        >
          Token #{request.tokenId} ↗
        </a>
        <span className="truncate text-[14.5px] text-text">{request.asset.title}</span>
        <span className="font-mono text-[13px] text-text sm:text-right">
          {request.valuation ? formatAmount(BigInt(request.valuation), false) : "-"}
        </span>
        <PillButton
          variant="chip"
          size="chip-lg"
          className="justify-self-start sm:justify-self-end"
          onPress={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Cancel" : "Re-value"}
        </PillButton>
      </div>

      {isOpen && (
        <div className="flex flex-wrap gap-2.5 pb-1">
          <AmountInput
            className="min-w-[180px] flex-1"
            label={`New value for token ${request.tokenId}`}
            unit={ASSET_SYMBOL}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <PillButton
            size="sm"
            isDisabled={!amount}
            isPending={revalue.isPending}
            onPress={() =>
              amount &&
              revalue.mutate(
                { id: request._id, valuation: amount.toString() },
                {
                  onSuccess: () => {
                    setInput("");
                    setIsOpen(false);
                  },
                },
              )
            }
          >
            {revalue.isPending ? "Updating…" : "Update value"}
          </PillButton>
        </div>
      )}

      {revalue.error && (
        <p role="alert" className="font-mono text-[11px] text-danger-text">
          {revalue.error.message}
        </p>
      )}
    </li>
  );
}
