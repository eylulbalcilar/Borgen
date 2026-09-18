"use client";

import { useActivity, type Activity } from "@/lib/activity";
import { formatAmount } from "@/lib/format";

const LABELS: Record<Activity["type"], string> = {
  user_registered: "Account created",
  appraisal_requested: "Valuation requested",
  appraisal_approved: "Valuation signed",
  appraisal_rejected: "Valuation rejected",
  nft_minted: "Collateral token issued",
  deposited: "Deposited",
  withdrawn: "Withdrawn",
  borrowed: "Borrowed",
  repaid: "Repaid",
  liquidated: "Liquidated",
};

// Picks the amount that matters for each event type.
function amountOf(item: Activity): string | null {
  const raw = item.metadata?.amount ?? item.metadata?.debt ?? item.metadata?.valuation;
  return raw ? formatAmount(BigInt(raw)) : null;
}

export function ActivityFeed() {
  const activity = useActivity();

  if (activity.isPending) {
    return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  }

  if (activity.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {activity.error.message}
      </p>
    );
  }

  if (!activity.data?.length) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {activity.data.map((item) => {
        const amount = amountOf(item);
        return (
          <li key={item._id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <span className="text-sm">
              {LABELS[item.type]}
              {item.tokenId && <span className="text-muted-foreground"> · Token #{item.tokenId}</span>}
            </span>

            <span className="flex items-baseline gap-3 text-sm text-muted-foreground">
              {amount && <span className="text-foreground">{amount}</span>}
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {item.txHash && (
                <a
                  href={"https://sepolia.basescan.org/tx/" + item.txHash}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Tx
                </a>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
