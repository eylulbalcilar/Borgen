"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCreateAppraisal } from "@/lib/appraisals";
import { ASSET_SYMBOL } from "@/lib/contracts";
import { parseAmount } from "@/lib/format";

const inputClass = "h-10 w-full rounded-lg border border-input px-3 text-sm";

export function RequestForm() {
  const [title, setTitle] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");
  const [valuation, setValuation] = useState("");

  const create = useCreateAppraisal();

  // The backend stores amounts as integer strings in the smallest unit.
  const amount = parseAmount(valuation);
  const canSubmit = title.trim() !== "" && serialNumber.trim() !== "" && amount !== undefined;

  function submit() {
    if (!canSubmit || !amount) return;
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
        },
      },
    );
  }

  return (
    <section aria-labelledby="request-heading" className="flex flex-col gap-4">
      <h2 id="request-heading" className="text-lg font-medium">
        Request a valuation
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="asset-title" className="text-sm font-medium">
            Asset
          </label>
          <input
            id="asset-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="asset-serial" className="text-sm font-medium">
            Serial number
          </label>
          <input
            id="asset-serial"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="asset-description" className="text-sm font-medium">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="asset-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full rounded-lg border border-input p-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="asset-valuation" className="text-sm font-medium">
          Requested value ({ASSET_SYMBOL})
        </label>
        <input
          id="asset-valuation"
          inputMode="decimal"
          placeholder="0.00"
          value={valuation}
          onChange={(event) => setValuation(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <Button onPress={submit} isDisabled={!canSubmit} isPending={create.isPending}>
          {create.isPending ? "Sending…" : "Send request"}
        </Button>
      </div>

      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {create.error.message}
        </p>
      )}
    </section>
  );
}
