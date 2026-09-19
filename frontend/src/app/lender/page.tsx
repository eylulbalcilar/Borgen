import { LenderPanel } from "@/components/lender/lender-panel";
import { RoleGuard } from "@/components/role-guard";

export default function LenderPage() {
  return (
    <RoleGuard role="lender">
      <LenderPanel />
    </RoleGuard>
  );
}
