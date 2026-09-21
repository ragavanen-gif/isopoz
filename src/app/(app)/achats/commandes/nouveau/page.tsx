import { requirePermission } from "@/core/auth/session";
import { listSuppliers } from "@/modules/suppliers";
import { listProjects } from "@/modules/projects/queries";
import { NewOrderForm } from "@/modules/orders/new-order-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewOrderPage() {
  await requirePermission("orders.create");
  const [suppliers, projects] = await Promise.all([listSuppliers(), listProjects()]);
  const projectOpts = projects
    .filter((p) => !["cloture", "annule"].includes(p.status))
    .map((p) => ({ id: p.id, label: `${p.reference ?? ""} — ${p.client?.name ?? ""}` }));

  return (
    <>
      <PageHeader title="Nouvelle commande" description="Choisir le fournisseur, puis ajouter les lignes." />
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Créez d'abord un fournisseur.</p>
      ) : (
        <NewOrderForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} projects={projectOpts} />
      )}
    </>
  );
}
