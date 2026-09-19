"use client";

import { ActivityFeed } from "@/components/activity-feed";
import { RevalueCard } from "@/components/appraiser/revalue-card";
import { ReviewCard } from "@/components/appraiser/review-card";
import { EmptyState, Panel, PanelHeader, ScreenHeader } from "@/components/ui/panel";
import { Badge, type Tone } from "@/components/ui/status";
import { useAppraisals, type Appraisal } from "@/lib/appraisals";
import { formatAmount } from "@/lib/format";
import { useCurrentUser } from "@/lib/user";

const VERDICT: Record<Appraisal["status"], { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  approved: { label: "Signed", tone: "seal" },
  rejected: { label: "Rejected", tone: "danger" },
  minted: { label: "Issued", tone: "verify" },
};

export function AppraiserPanel() {
  const appraisals = useAppraisals();
  const user = useCurrentUser();

  const all = appraisals.data ?? [];
  const pending = all.filter((item) => item.status === "pending");
  const minted = all.filter((item) => item.status === "minted");
  const history = all.filter((item) => item.status !== "pending");

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-24 pt-11">
      <ScreenHeader
        eyebrow="( 0.4 ) Appraiser"
        title="Review desk"
        aside={
          <Badge tone="seal" dot>
            {user.data?.neuroLegalId
              ? `Credential verified · Neuro ID ${user.data.neuroLegalId}`
              : "Credential pending"}
          </Badge>
        }
      />

      <section aria-labelledby="pending-heading" className="mt-9">
        <h2
          id="pending-heading"
          className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim"
        >
          Pending requests · {pending.length}
        </h2>

        {appraisals.isPending && (
          <p className="font-mono text-[11.5px] text-dim">Loading requests…</p>
        )}

        {appraisals.error && (
          <p role="alert" className="font-mono text-[11.5px] text-danger-text">
            {appraisals.error.message}
          </p>
        )}

        {appraisals.isSuccess && pending.length === 0 ? (
          <EmptyState title="Nothing to review">
            Incoming valuation requests land here. Signed decisions move to the history list below.
          </EmptyState>
        ) : (
          <ul className="grid gap-[18px]">
            {pending.map((item) => (
              <ReviewCard key={item._id} request={item} />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] items-start gap-6">
        <Panel>
          <PanelHeader eyebrow="Issued collateral" />
          {minted.length === 0 ? (
            <p className="px-6 py-[18px] font-mono text-[11.5px] text-dim">
              No collateral tokens issued yet.
            </p>
          ) : (
            <>
              <div className="hidden border-b border-glass-border px-6 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim sm:grid sm:grid-cols-[150px_minmax(0,1fr)_130px_120px] sm:gap-4">
                <span>Token id</span>
                <span>Asset</span>
                <span className="text-right">Current value</span>
                <span className="text-right">Action</span>
              </div>
              <ul>
                {minted.map((item) => (
                  <RevalueCard key={item._id} request={item} />
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Decision history" />
          {history.length === 0 ? (
            <p className="px-6 py-[18px] font-mono text-[11.5px] text-dim">
              No reviewed requests yet.
            </p>
          ) : (
            <ul>
              {history.map((item) => (
                <li
                  key={item._id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line px-6 py-3.5 last:border-b-0"
                >
                  <Badge tone={VERDICT[item.status].tone}>{VERDICT[item.status].label}</Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text">{item.asset.title}</p>
                    <p className="mt-1 font-mono text-[11px] text-dim">
                      {item.valuation ? formatAmount(BigInt(item.valuation)) : "-"}
                    </p>
                  </div>
                  <time
                    dateTime={item.createdAt}
                    className="font-mono text-[11.5px] text-dim"
                  >
                    {new Date(item.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-12">
        <ActivityFeed />
      </div>
    </div>
  );
}
