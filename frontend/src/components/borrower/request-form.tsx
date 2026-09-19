"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { TextArea, TextField } from "@/components/ui/field";
import { useCreateAppraisal } from "@/lib/appraisals";
import { ASSET_SYMBOL } from "@/lib/contracts";
import { parseAmount } from "@/lib/format";

export function RequestForm() {
  const [title, setTitle] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");
  const [valuation, setValuation] = useState("");

  // Errors appear only after a submit attempt, not while the form is still blank.
  const [attempted, setAttempted] = useState(false);

  const create = useCreateAppraisal();

  // The backend stores amounts as integer strings in the smallest unit.
  const amount = parseAmount(valuation);
  const errors = {
    title: title.trim() === "" ? "Enter the asset title" : undefined,
    serialNumber: serialNumber.trim() === "" ? "Enter the serial number" : undefined,
    valuation:
      valuation.trim() === ""
        ? "Enter the value you expect"
        : amount === undefined
          ? "Use digits only, for example 180000.00"
          : undefined,
  };

  function submit() {
    setAttempted(true);
    if (errors.title || errors.serialNumber || errors.valuation || !amount) return;
    create.mutate(
      {
        title: title.trim(),
        serialNumber: serialNumber.trim(),
        description: description.trim() || undefined,
        requestedValuation: amount.toString(),
      },
      {
        onSuccess: () => {
          setTitle("");
          setSerialNumber("");
          setDescription("");
          setValuation("");
          setAttempted(false);
        },
      },
    );
  }

  return (
    <Panel>
      <PanelHeader eyebrow="Request a valuation" title="Submit an asset to an appraiser" />

      <div className="grid gap-[18px] p-6">
        <TextField
          label="Asset title"
          value={title}
          maxLength={120}
          placeholder="e.g. Patek Philippe 5711/1A"
          error={attempted ? errors.title : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div className="grid gap-3.5 sm:grid-cols-2">
          <TextField
            label="Serial number"
            mono
            value={serialNumber}
            maxLength={120}
            placeholder="e.g. 5711-1A-010"
            error={attempted ? errors.serialNumber : undefined}
            onChange={(event) => setSerialNumber(event.target.value)}
          />
          <TextField
            label={`Requested value (${ASSET_SYMBOL})`}
            mono
            inputMode="decimal"
            value={valuation}
            placeholder="0.00"
            error={attempted ? errors.valuation : undefined}
            onChange={(event) => setValuation(event.target.value)}
          />
        </div>

        <TextArea
          label={
            <>
              Description <span className="normal-case tracking-normal">(optional)</span>
            </>
          }
          rows={3}
          maxLength={1000}
          value={description}
          placeholder="Add condition, provenance and service history"
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <p className="font-mono text-[11px] text-dim">Routed to a credentialed appraiser</p>
          <PillButton onPress={submit} isDisabled={create.isPending} isPending={create.isPending}>
            {create.isPending ? "Sending…" : "Submit request"}
          </PillButton>
        </div>

        {create.error && (
          <p role="alert" className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-field border border-danger px-[13px] py-3">
            <span aria-hidden="true" className="mt-1.5 block size-[7px] bg-danger" />
            <span className="text-[13px] leading-[1.6] text-danger-text">{create.error.message}</span>
          </p>
        )}
      </div>
    </Panel>
  );
}
