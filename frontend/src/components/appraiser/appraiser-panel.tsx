"use client";

import { ActivitySection } from "@/components/activity-section";
import { RevalueCard } from "@/components/appraiser/revalue-card";
import { ReviewCard } from "@/components/appraiser/review-card";
import { useAppraisals, type Appraisal } from "@/lib/appraisals";
import { formatAmount } from "@/lib/format";

const HISTORY_LABELS: Record<Appraisal["status"], string> = {
  pending: "Pending",
  approved: "Signed, waiting for the owner",
  rejected: "Rejected",
  minted: "Collateral token issued",
};

export function AppraiserPanel() {
  const appraisals = useAppraisals();

  if (appraisals.isPending) {
    return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  }

  if (appraisals.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {appraisals.error.message}
      </p>
    );
  }

  const pending = appraisals.data?.filter((item) => item.status === "pending") ?? [];
  const minted = appraisals.data?.filter((item) => item.status === "minted") ?? [];
  const history = appraisals.data?.filter(
    (item) => item.status !== "pending" && item.status !== "minted",
  ) ?? [];

  return (
    <div className="flex w-full flex-col gap-10">
      <section aria-labelledby="pending-heading" className="flex flex-col gap-4">
        <h2 id="pending-heading" className="text-lg font-medium">
          Pending requests
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((item) => (
              <ReviewCard key={item._id} request={item} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="issued-heading" className="flex flex-col gap-4">
        <h2 id="issued-heading" className="text-lg font-medium">
          Issued collateral
        </h2>
        {minted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collateral tokens issued yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {minted.map((item) => (
              <RevalueCard key={item._id} request={item} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        <h2 id="history-heading" className="text-lg font-medium">
          History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewed requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((item) => (
              <li
                key={item._id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border p-4"
              >
                <span className="font-medium">{item.asset.title}</span>
                <span className="text-sm">
                  {item.valuation ? formatAmount(BigInt(item.valuation)) : "-"}
                </span>
                <span className="text-sm text-muted-foreground">{HISTORY_LABELS[item.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ActivitySection />

    </div>
  );
}
