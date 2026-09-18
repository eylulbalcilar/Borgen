"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRevalueAppraisal, type Appraisal } from "@/lib/appraisals";
import { ASSET_SYMBOL } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";

// Lets the appraiser update the on-chain value of an issued collateral token.
// A lower value can push a loan past the liquidation threshold.
export function RevalueCard({ request }: { request: Appraisal }) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const revalue = useRevalueAppraisal();

  const amount = parseAmount(input);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{request.asset.title}</span>
        <span className="text-sm text-muted-foreground">Token #{request.tokenId}</span>
      </div>

      <p className="text-sm">
        Current value: {request.valuation ? formatAmount(BigInt(request.valuation)) : "-"}
      </p>

      {isOpen ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor={`revalue-${request._id}`} className="text-sm font-medium">
              New value ({ASSET_SYMBOL})
            </label>
            <input
              id={`revalue-${request._id}`}
              inputMode="decimal"
              placeholder="0.00"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-10 w-full rounded-lg border border-input px-3 text-sm"
            />
          </div>
          <Button
            size="sm"
            isDisabled={!amount}
            isPending={revalue.isPending}
            onPress={() =>
              amount &&
              revalue.mutate(
                { id: request._id, valuation: amount.toString() },
                { onSuccess: () => { setInput(""); setIsOpen(false); } },
              )
            }
          >
            {revalue.isPending ? "Updating…" : "Update value"}
          </Button>
        </div>
      ) : (
        <div>
          <Button size="sm" variant="outline" onPress={() => setIsOpen(true)}>
            Re-value asset
          </Button>
        </div>
      )}

      {revalue.error && (
        <p role="alert" className="text-sm text-destructive">
          {revalue.error.message}
        </p>
      )}
    </li>
  );
}
