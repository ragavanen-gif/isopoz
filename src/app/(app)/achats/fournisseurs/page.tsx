import { requirePermission } from "@/core/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export default async function Page() {
  await requirePermission("suppliers.view");
  return <ComingSoon title="Fournisseurs" phase="Phase 5" />;
}
