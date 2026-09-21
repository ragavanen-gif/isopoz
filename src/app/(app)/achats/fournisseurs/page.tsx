import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listSuppliers } from "@/modules/suppliers";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";

export default async function FournisseursPage() {
  await requirePermission("suppliers.view");
  const user = await getSessionUser();
  const suppliers = await listSuppliers();
  const canCreate = user ? userCan(user, "suppliers.create") : false;

  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description={`${suppliers.length} fournisseur(s)`}
        actions={canCreate && (<Link href="/achats/fournisseurs/nouveau"><Button><Plus /> Nouveau fournisseur</Button></Link>)}
      />
      {suppliers.length === 0 ? (
        <EmptyState message="Aucun fournisseur." />
      ) : (
        <Table>
          <THead><TR><TH>Nom</TH><TH>Contact</TH><TH>Email</TH><TH>Téléphone</TH><TH>Conditions</TH></TR></THead>
          <TBody>
            {suppliers.map((s) => (
              <TR key={s.id}>
                <TD><Link href={`/achats/fournisseurs/${s.id}`} className="font-medium text-primary hover:underline">{s.name}</Link></TD>
                <TD>{s.contact ?? "—"}</TD>
                <TD>{s.email ?? "—"}</TD>
                <TD>{s.phone ?? "—"}</TD>
                <TD>{s.payment_terms ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
