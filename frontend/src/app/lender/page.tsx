import { LenderPanel } from "@/components/lender/lender-panel";
import { RoleGuard } from "@/components/role-guard";

export default function LenderPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold">Lender</h1>
      <RoleGuard role="lender">
        <LenderPanel />
      </RoleGuard>
    </div>
  );
}
