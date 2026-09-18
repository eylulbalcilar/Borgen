import { RoleGuard } from "@/components/role-guard";

export default function LenderPage() {
  return (
    <RoleGuard role="lender">
      <h1 className="text-2xl font-semibold">Lender</h1>
    </RoleGuard>
  );
}
