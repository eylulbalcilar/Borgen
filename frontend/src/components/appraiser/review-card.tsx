"use client";

import { useState } from "react";
import { AmountInput, TextArea } from "@/components/ui/field";
import { PillButton } from "@/components/ui/pill-button";
import { Badge } from "@/components/ui/status";
import { useApproveAppraisal, useRejectAppraisal, type Appraisal } from "@/lib/appraisals";
import { ASSET_SYMBOL, BPS, LTV_BPS } from "@/lib/contracts";
import { formatAmount, parseAmount, shortenAddress } from "@/lib/format";

const EXPLORER = "https://sepolia.basescan.org/address/";

export function ReviewCard({ request }: { request: Appraisal }) {
  // Pre-filled with the requested amount; the appraiser decides the final value.
  const [valuation, setValuation] = useState(
    (Number(request.requestedValuation) / 1_000_000).toString(),
  );
  // Kept locally: the note is context for the decision, not stored on-chain.
  const [note, setNote] = useState("");

  const approve = useApproveAppraisal();
  const reject = useRejectAppraisal();

  const amount = parseAmount(valuation);
  const isBusy = approve.isPending || reject.isPending;
  const error = approve.error ?? reject.error;
  const maxLoan = amount === undefined ? undefined : (amount * LTV_BPS) / BPS;

  return (
    <li className="glass grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] overflow-hidden rounded-[24px]">
      <div className="border-b border-glass-border p-6 sm:border-b-0 sm:border-r">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-[23px] font-semibold leading-[1.25] text-text">
              {request.asset.title}
            </h3>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-dim">
              {request.asset.serialNumber} · submitted{" "}
              {new Date(request.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge>Pending</Badge>
        </div>

        {request.asset.description && (
          <p className="mt-4 max-w-[62ch] text-[14.5px] leading-[1.7]">{request.asset.description}</p>
        )}

        <dl className="mt-5 flex flex-wrap gap-8 border-t border-glass-border pt-4 font-mono text-[12.5px]">
          {request.borrower && (
            <div>
              <dt className="mb-1.5 text-[10px] uppercase tracking-[0.1em] text-dim">Owner</dt>
              <dd>
                <a
                  href={EXPLORER + request.borrower.walletAddress}
                  target="_blank"
                  rel="noreferrer"
                  className="link-seal"
                >
                  <span aria-hidden="true">{shortenAddress(request.borrower.walletAddress)} ↗</span>
                  <span className="sr-only">{request.borrower.walletAddress}</span>
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="mb-1.5 text-[10px] uppercase tracking-[0.1em] text-dim">Requested value</dt>
            <dd className="text-text">{formatAmount(BigInt(request.requestedValuation), false)}</dd>
          </div>
          <div>
            <dt className="mb-1.5 text-[10px] uppercase tracking-[0.1em] text-dim">Max loan at 50%</dt>
            <dd className="text-text">{maxLoan === undefined ? "-" : formatAmount(maxLoan, false)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid content-start gap-4 p-6">
        <div className="grid gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">Your valuation</p>
          <AmountInput
            large
            label={`Valuation for ${request.asset.title}`}
            unit={ASSET_SYMBOL}
            value={valuation}
            onChange={(event) => setValuation(event.target.value)}
          />
          <p className="font-mono text-[11px] text-dim">
            Max loan at 50% → {maxLoan === undefined ? "-" : formatAmount(maxLoan)}
          </p>
        </div>

        <TextArea
          label="Note on the record"
          rows={2}
          value={note}
          placeholder="Add the basis of valuation and any comparables"
          onChange={(event) => setNote(event.target.value)}
        />

        <div className="flex gap-2.5">
          <PillButton
            className="flex-1"
            isDisabled={!amount || isBusy}
            isPending={approve.isPending}
            onPress={() => amount && approve.mutate({ id: request._id, valuation: amount.toString() })}
          >
            {approve.isPending ? "Signing in Neuro…" : "Sign & approve"}
          </PillButton>
          <PillButton
            variant="danger"
            isDisabled={isBusy}
            isPending={reject.isPending}
            onPress={() => reject.mutate(request._id)}
          >
            {reject.isPending ? "Rejecting…" : "Reject"}
          </PillButton>
        </div>

        <p className="font-mono text-[10.5px] leading-[1.7] text-dim">
          Both signatures are required before the relay mints the collateral token.
        </p>

        {error && (
          <p role="alert" className="font-mono text-[11px] text-danger-text">
            {error.message}
          </p>
        )}
      </div>
    </li>
  );
}
