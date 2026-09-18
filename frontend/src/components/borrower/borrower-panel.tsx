"use client";

import { RequestForm } from "@/components/borrower/request-form";
import { RequestList } from "@/components/borrower/request-list";

export function BorrowerPanel() {
  return (
    <div className="flex w-full flex-col gap-10">
      <RequestForm />

      <section aria-labelledby="requests-heading" className="flex flex-col gap-4">
        <h2 id="requests-heading" className="text-lg font-medium">
          Your requests
        </h2>
        <RequestList />
      </section>
    </div>
  );
}
