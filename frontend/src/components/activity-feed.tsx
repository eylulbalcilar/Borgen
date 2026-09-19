"use client";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { useActivity, type Activity } from "@/lib/activity";
import { formatAmount } from "@/lib/format";

const EXPLORER = "https://sepolia.basescan.org";

const LABELS: Record<Activity["type"], string> = {
  user_registered: "Account created",
  appraisal_requested: "Valuation requested",
  appraisal_approved: "Valuation signed",
  appraisal_rejected: "Valuation rejected",
  appraisal_revalued: "Valuation updated",
  nft_minted: "Collateral token issued",
  deposited: "Deposited",
  withdrawn: "Withdrawn",
  borrowed: "Borrowed",
  repaid: "Repaid",
  liquidated: "Liquidated",
};

// Gold marks a valuation, teal a settled movement, red a loss of collateral.
const DOTS: Record<Activity["type"], string> = {
  user_registered: "bg-dim",
  appraisal_requested: "bg-seal",
  appraisal_approved: "bg-seal",
  appraisal_rejected: "bg-danger",
  appraisal_revalued: "bg-seal",
  nft_minted: "bg-seal",
  deposited: "bg-verify",
  withdrawn: "bg-verify",
  borrowed: "bg-verify",
  repaid: "bg-verify",
  liquidated: "bg-danger",
};

// Picks the amount that matters for each event type.
function amountOf(item: Activity): string | null {
  const raw = item.metadata?.amount ?? item.metadata?.debt ?? item.metadata?.valuation;
  return raw ? formatAmount(BigInt(raw), false) : null;
}

export function ActivityFeed() {
  const activity = useActivity();

  return (
    <Panel>
      <PanelHeader
        eyebrow="Activity"
        aside={
          <a
            href={EXPLORER}
            target="_blank"
            rel="noreferrer"
            className="link-seal font-mono text-[11px]"
          >
            All transactions ↗
          </a>
        }
      />

      {activity.isPending && <p className="px-6 py-5 font-mono text-[11.5px] text-dim">Loading activity…</p>}

      {activity.error && (
        <p role="alert" className="px-6 py-5 font-mono text-[11.5px] text-danger-text">
          {activity.error.message}
        </p>
      )}

      {activity.isSuccess && activity.data.length === 0 && (
        <p className="px-6 py-5 font-mono text-[11.5px] text-dim">No activity yet.</p>
      )}

      <ul>
        {(activity.data ?? []).map((item) => {
          const amount = amountOf(item);
          return (
            <li
              key={item._id}
              className="grid grid-cols-[14px_minmax(0,1fr)] items-center gap-x-[18px] gap-y-2 border-b border-line px-6 py-3.5 last:border-b-0 sm:grid-cols-[14px_minmax(0,1fr)_150px_170px_140px]"
            >
              <span aria-hidden="true" className={`block size-[7px] ${DOTS[item.type]}`} />
              <span className="text-[14.5px] text-text">
                {LABELS[item.type]}
                {item.tokenId && <span className="text-dim"> · Token #{item.tokenId}</span>}
              </span>
              <span className="col-start-2 font-mono text-[13px] text-body sm:col-start-3 sm:text-right">
                {amount ?? ""}
              </span>
              <time
                dateTime={item.createdAt}
                className="col-start-2 font-mono text-xs text-dim sm:col-start-4 sm:text-right"
              >
                {new Date(item.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <span className="col-start-2 sm:col-start-5 sm:justify-self-end">
                {item.txHash && (
                  <a
                    href={`${EXPLORER}/tx/${item.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="link-seal font-mono text-xs"
                  >
                    <span aria-hidden="true">{item.txHash.slice(0, 6)}…{item.txHash.slice(-4)} ↗</span>
                    <span className="sr-only">View transaction {item.txHash}</span>
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
