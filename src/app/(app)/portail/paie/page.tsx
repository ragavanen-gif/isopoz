import Link from "next/link";
import { Download } from "lucide-react";
import { requirePermission } from "@/core/auth/session";
import { getMyPayslips } from "@/modules/portal/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { euros } from "@/lib/format";

const MONTHS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default async function PortailPaiePage() {
  const user = await requirePermission("portal.self");
  if (!user.employeeId) {
    return (
      <>
        <PageHeader title="Mes fiches de paie" />
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Compte non relié à une fiche salarié.</CardContent></Card>
      </>
    );
  }
  const payslips = await getMyPayslips(user.employeeId);

  return (
    <>
      <PageHeader title="Mes fiches de paie" description="Consultation et téléchargement." />
      {payslips.length === 0 ? (
        <EmptyState message="Aucune fiche de paie disponible." />
      ) : (
        <Table>
          <THead><TR><TH>Période</TH><TH>Libellé</TH><TH className="text-right">Net</TH><TH></TH></TR></THead>
          <TBody>
            {payslips.map((p) => (
              <TR key={p.id}>
                <TD>{MONTHS[p.month]} {p.year}</TD>
                <TD>{p.label ?? "Fiche de paie"}</TD>
                <TD className="text-right tabular-nums">{p.net_cents != null ? euros(p.net_cents) : "—"}</TD>
                <TD className="text-right">
                  {p.storage_path && (
                    <Link href={`/api/payslips/${p.id}/download`} prefetch={false} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="size-4" /> Télécharger
                    </Link>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
