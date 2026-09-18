import { BorrowerPanel } from "@/components/borrower/borrower-panel";
import { RoleGuard } from "@/components/role-guard";

export default function BorrowerPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold">Borrower</h1>
      <RoleGuard role="borrower">
        <BorrowerPanel />
      </RoleGuard>
    </div>
  );
}
