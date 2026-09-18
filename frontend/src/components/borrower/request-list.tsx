"use client";

import { useAcceptAppraisal, useAppraisals, type Appraisal } from "@/lib/appraisals";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";

const STATUS_LABELS: Record<Appraisal["status"], string> = {
  pending: "Waiting for an appraiser",
  approved: "Valued, waiting for your acceptance",
  rejected: "Rejected",
  minted: "Collateral token issued",
};

export function RequestList() {
  const appraisals = useAppraisals();
  const accept = useAcceptAppraisal();

  if (appraisals.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your requests…</p>;
  }

  if (appraisals.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {appraisals.error.message}
      </p>
    );
  }

  if (!appraisals.data?.length) {
    return <p className="text-sm text-muted-foreground">No requests yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {appraisals.data.map((item) => (
        <li key={item._id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">{item.asset.title}</h3>
            <span className="text-sm text-muted-foreground">{STATUS_LABELS[item.status]}</span>
          </div>

          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Serial</dt>
              <dd>{item.asset.serialNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Requested</dt>
              <dd>{formatAmount(BigInt(item.requestedValuation))}</dd>
            </div>
            {item.valuation && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Valued at</dt>
                <dd>{formatAmount(BigInt(item.valuation))}</dd>
              </div>
            )}
            {item.tokenId && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Token</dt>
                <dd>#{item.tokenId}</dd>
              </div>
            )}
          </dl>

          {item.status === "approved" && (
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onPress={() => accept.mutate(item._id)}
                isPending={accept.isPending && accept.variables === item._id}
              >
                {accept.isPending && accept.variables === item._id
                  ? "Signing and minting…"
                  : "Accept valuation"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Accepting signs the Neuro contract and issues the collateral token. This can take up
                to a minute.
              </p>
            </div>
          )}

          {item.mintTxHash && (
            <a
              href={"https://sepolia.basescan.org/tx/" + item.mintTxHash}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              View mint transaction
            </a>
          )}

          {accept.error && accept.variables === item._id && (
            <p role="alert" className="text-sm text-destructive">
              {accept.error.message}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
