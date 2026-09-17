import Link from "next/link";
import { requirePermission } from "@/core/auth/session";
import { getAnalytics } from "@/modules/analytics/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { euros } from "@/lib/format";

export default async function AnalysePage({ searchParams }: PageProps<"/analyse">) {
  await requirePermission("analytics.view");
  const sp = await searchParams;
  const now = new Date().getFullYear();
  const year = typeof sp.year === "string" ? Number(sp.year) || now : now;
  const a = await getAnalytics(year);
  const years = [now, now - 1, now - 2];

  return (
    <>
      <PageHeader
        title="Chiffre d'affaires"
        description="CA facturé (chiffre d'affaires) et CA encaissé (trésorerie) sont distingués."
        actions={
          <div className="flex gap-2 text-sm">
            {years.map((y) => (
              <Link key={y} href={`/analyse?year=${y}`} className={y === year ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>{y}</Link>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`CA facturé ${year}`} value={euros(a.caBilled)} />
        <StatCard label={`CA encaissé ${year}`} value={euros(a.caCollected)} tone="success" />
        <StatCard label="Restant à encaisser" value={euros(a.outstanding)} tone="warning" />
        <StatCard label="Factures en retard" value={euros(a.overdue)} tone="danger" />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>CA facturé par mois — {year}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-2">
            {a.monthly.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.round((m.cents / a.monthlyMax) * 100)}%` }}
                    title={euros(m.cents)}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>CA par client — {year}</CardTitle></CardHeader>
          <CardContent>
            {a.byClient.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée.</p> : (
              <Table>
                <THead><TR><TH>Client</TH><TH className="text-right">CA facturé</TH></TR></THead>
                <TBody>
                  {a.byClient.map((c) => (
                    <TR key={c.name}><TD>{c.name}</TD><TD className="text-right tabular-nums font-medium">{euros(c.cents)}</TD></TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rentabilité des chantiers</CardTitle></CardHeader>
          <CardContent>
            {a.profitability.length === 0 ? <p className="text-sm text-muted-foreground">Aucun chantier chiffré.</p> : (
              <Table>
                <THead><TR><TH>Chantier</TH><TH className="text-right">Devis</TH><TH className="text-right">Coûts</TH><TH className="text-right">Marge</TH><TH className="text-right">Taux</TH></TR></THead>
                <TBody>
                  {a.profitability.map((p) => (
                    <TR key={p.id}>
                      <TD><Link href={`/chantiers/${p.id}`} className="text-primary hover:underline">{p.reference}</Link><span className="block text-xs text-muted-foreground">{p.clientName}</span></TD>
                      <TD className="text-right tabular-nums">{euros(p.quote)}</TD>
                      <TD className="text-right tabular-nums text-muted-foreground">{euros(p.cost)}</TD>
                      <TD className={`text-right tabular-nums font-medium ${p.margin >= 0 ? "text-success" : "text-danger"}`}>{euros(p.margin)}</TD>
                      <TD className={`text-right tabular-nums ${p.margin >= 0 ? "text-success" : "text-danger"}`}>{p.rate}%</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
