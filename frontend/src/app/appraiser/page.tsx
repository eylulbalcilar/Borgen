import { RoleGuard } from "@/components/role-guard";

export default function AppraiserPage() {
  return (
    <RoleGuard role="appraiser">
      <h1 className="text-2xl font-semibold">Appraiser</h1>
    </RoleGuard>
  );
}
