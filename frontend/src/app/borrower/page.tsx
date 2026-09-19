import { BorrowerPanel } from "@/components/borrower/borrower-panel";
import { RoleGuard } from "@/components/role-guard";

export default function BorrowerPage() {
  return (
    <RoleGuard role="borrower">
      <BorrowerPanel />
    </RoleGuard>
  );
}
