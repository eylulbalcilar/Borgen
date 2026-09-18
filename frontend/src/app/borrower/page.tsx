import { RoleGuard } from "@/components/role-guard";

export default function BorrowerPage() {
  return (
    <RoleGuard role="borrower">
      <h1 className="text-2xl font-semibold">Borrower</h1>
    </RoleGuard>
  );
}
