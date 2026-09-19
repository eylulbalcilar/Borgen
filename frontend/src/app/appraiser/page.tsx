import { AppraiserPanel } from "@/components/appraiser/appraiser-panel";
import { RoleGuard } from "@/components/role-guard";

export default function AppraiserPage() {
  return (
    <RoleGuard role="appraiser">
      <AppraiserPanel />
    </RoleGuard>
  );
}
