import { requireAuth } from "@/core/auth/session";
import { createClient } from "@/core/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { euros } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ count: clientsCount }, projectsRes, invRes, payRes] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "en_cours").is("deleted_at", null),
    supabase.from("invoices").select("id, total_cents, issue_date, status").is("deleted_at", null),
    supabase.from("payments").select("amount_cents, invoice_id"),
  ]);

  const invoices = (invRes.data ?? []) as { id: string; total_cents: number; issue_date: string; status: string }[];
  const billable = invoices.filter((i) => i.status !== "brouillon" && i.status !== "annulee");
  const paidByInv = new Map<string, number>();
  for (const p of (payRes.data ?? []) as { amount_cents: number; invoice_id: string }[]) {
    paidByInv.set(p.invoice_id, (paidByInv.get(p.invoice_id) ?? 0) + p.amount_cents);
  }
  const caMonth = billable.filter((i) => i.issue_date >= monthStart).reduce((s, i) => s + i.total_cents, 0);
  const outstanding = billable.reduce((s, i) => s + (i.total_cents - (paidByInv.get(i.id) ?? 0)), 0);

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.fullName?.split(" ")[0] ?? ""}`.trim()}
        description="Vue d'ensemble de l'activité."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clients" value={String(clientsCount ?? 0)} />
        <StatCard label="CA du mois (facturé)" value={euros(caMonth)} />
        <StatCard label="Chantiers en cours" value={String(projectsRes.count ?? 0)} />
        <StatCard label="Restant à encaisser" value={euros(outstanding)} tone={outstanding > 0 ? "warning" : "default"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prochaines étapes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="mb-3">
              Phase 1 (fondations) en place : authentification, permissions granulaires,
              clients, administration.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Phase 2 — Demandes, devis, modèles de documents</li>
              <li>Phase 3 — Chantiers, planning, équipes, matériel</li>
              <li>Phase 4 — Factures, paiements, relances, analyses CA</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cycle métier ISOPoz</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="font-mono text-xs leading-relaxed">
              Client → Demande → Devis → Chantier → Planning → Équipe/Matériel →
              Facture → Paiement → Analyse → Archivage
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
