import { requirePermission } from "@/core/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export default async function Page() {
  await requirePermission("admin.settings");
  return <ComingSoon title="Paramètres" phase="Phase 1+" />;
}
