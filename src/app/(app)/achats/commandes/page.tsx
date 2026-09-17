import { requirePermission } from "@/core/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export default async function Page() {
  await requirePermission("orders.view");
  return <ComingSoon title="Commandes" phase="Phase 5" />;
}
