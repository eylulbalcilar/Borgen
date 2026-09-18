"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApproveAppraisal, useRejectAppraisal, type Appraisal } from "@/lib/appraisals";
import { ASSET_SYMBOL } from "@/lib/contracts";
import { formatAmount, parseAmount, shortenAddress } from "@/lib/format";

export function ReviewCard({ request }: { request: Appraisal }) {
  // Pre-filled with the requested amount; the appraiser decides the final value.
  const [valuation, setValuation] = useState(
    (Number(request.requestedValuation) / 1_000_000).toString(),
  );

  const approve = useApproveAppraisal();
  const reject = useRejectAppraisal();

  const amount = parseAmount(valuation);
  const isBusy = approve.isPending || reject.isPending;
  const error = approve.error ?? reject.error;

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{request.asset.title}</h3>
        {request.asset.description && (
          <p className="text-sm text-muted-foreground">{request.asset.description}</p>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Serial</dt>
          <dd>{request.asset.serialNumber}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Requested</dt>
          <dd>{formatAmount(BigInt(request.requestedValuation))}</dd>
        </div>
        {request.borrower && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Owner</dt>
            <dd>
              <span aria-hidden="true">{shortenAddress(request.borrower.walletAddress)}</span>
              <span className="sr-only">{request.borrower.walletAddress}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-2">
        <label htmlFor={`valuation-${request._id}`} className="text-sm font-medium">
          Your valuation ({ASSET_SYMBOL})
        </label>
        <input
          id={`valuation-${request._id}`}
          inputMode="decimal"
          value={valuation}
          onChange={(event) => setValuation(event.target.value)}
          className="h-10 w-full rounded-lg border border-input px-3 text-sm sm:max-w-xs"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          isDisabled={!amount || isBusy}
          isPending={approve.isPending}
          onPress={() => amount && approve.mutate({ id: request._id, valuation: amount.toString() })}
        >
          {approve.isPending ? "Signing in Neuro…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          isDisabled={isBusy}
          isPending={reject.isPending}
          onPress={() => reject.mutate(request._id)}
        >
          {reject.isPending ? "Rejecting…" : "Reject"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </li>
  );
}
