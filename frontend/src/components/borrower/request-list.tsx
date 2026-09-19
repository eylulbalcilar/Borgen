"use client";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { Badge, type Tone } from "@/components/ui/status";
import { useAcceptAppraisal, useAppraisals, type Appraisal } from "@/lib/appraisals";
import { formatAmount } from "@/lib/format";

const STATUS: Record<Appraisal["status"], { label: string; tone: Tone }> = {
  pending: { label: "Awaiting appraiser", tone: "seal" },
  approved: { label: "Signed · accept to mint", tone: "seal" },
  rejected: { label: "Rejected", tone: "danger" },
  minted: { label: "Token issued", tone: "verify" },
};

export function RequestList() {
  const appraisals = useAppraisals();
  const accept = useAcceptAppraisal();

  const items = appraisals.data ?? [];

  return (
    <Panel>
      <PanelHeader
        eyebrow="Your requests"
        title="Valuation pipeline"
        aside={<span className="font-mono text-[11px] text-dim">{items.length} total</span>}
      />

      {appraisals.isPending && (
        <p className="px-6 py-[18px] font-mono text-[11.5px] text-dim">Loading your requests…</p>
      )}

      {appraisals.error && (
        <p role="alert" className="px-6 py-[18px] font-mono text-[11.5px] text-danger-text">
          {appraisals.error.message}
        </p>
      )}

      {appraisals.isSuccess && items.length === 0 && (
        <p className="px-6 py-[18px] font-mono text-[11.5px] text-dim">No requests yet.</p>
      )}

      <ul>
        {items.map((item) => {
          const status = STATUS[item.status];
          const isAccepting = accept.isPending && accept.variables === item._id;

          return (
            <li key={item._id} className="grid gap-3 border-b border-glass-border px-6 py-[18px] last:border-b-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15.5px] font-semibold text-text">{item.asset.title}</h3>
                  <p className="mt-1.5 font-mono text-[11px] text-dim">
                    {item.asset.serialNumber}
                    {item.tokenId && ` · token #${item.tokenId}`}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <dl className="flex gap-6 font-mono text-[12.5px] text-body">
                  <div className="flex gap-2">
                    <dt className="text-dim">req</dt>
                    <dd>{formatAmount(BigInt(item.requestedValuation), false)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-dim">appr</dt>
                    <dd>{item.valuation ? formatAmount(BigInt(item.valuation), false) : "-"}</dd>
                  </div>
                </dl>

                {item.status === "approved" && (
                  <PillButton
                    variant="seal"
                    size="sm"
                    isPending={isAccepting}
                    onPress={() => accept.mutate(item._id)}
                  >
                    {isAccepting ? "Signing and minting…" : "Accept valuation"}
                  </PillButton>
                )}
              </div>

              {item.status === "approved" && (
                <p className="font-mono text-[10.5px] leading-[1.7] text-dim">
                  Accepting signs the Neuro contract and issues the collateral token. This can take
                  up to a minute.
                </p>
              )}

              {accept.error && accept.variables === item._id && (
                <p role="alert" className="font-mono text-[11px] text-danger-text">
                  {accept.error.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
