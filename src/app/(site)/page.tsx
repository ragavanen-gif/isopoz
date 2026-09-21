import Link from "next/link";
import { Star, ShieldCheck, Clock, ThumbsUp } from "lucide-react";
import { getSiteSettings, listActiveServices, listPublishedReviews } from "@/modules/site/queries";
import { Simulator } from "@/modules/site/simulator";
import { euros } from "@/lib/format";

export default async function AccueilPage() {
  const [s, services, reviews] = await Promise.all([
    getSiteSettings(), listActiveServices(), listPublishedReviews(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="bg-sidebar text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-sidebar-foreground">{s.tagline}</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{s.hero_title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sidebar-foreground">{s.hero_subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-[var(--radius-app)] bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-accent/90">{s.cta_text}</Link>
            <Link href="/realisations" className="rounded-[var(--radius-app)] border border-white/30 px-6 py-3 font-medium text-white hover:bg-white/10">Nos réalisations</Link>
          </div>
        </div>
      </section>

      {/* Garanties */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Travaux garantis", text: "Un savoir-faire reconnu et des matériaux de qualité." },
            { icon: Clock, title: "Intervention rapide", text: "Des délais courts et respectés." },
            { icon: ThumbsUp, title: "Devis gratuit", text: "Une estimation claire et sans engagement." },
          ].map((f) => (
            <div key={f.title} className="rounded-[var(--radius-app)] border border-border bg-surface p-6 text-center">
              <f.icon className="mx-auto size-8 text-primary" />
              <p className="mt-3 font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prestations + simulateur */}
      {s.simulator_enabled && services.length > 0 && (
        <section className="bg-muted/40">
          <div className="mx-auto max-w-4xl px-4 py-14">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold">Nos prestations</h2>
              <p className="mt-1 text-muted-foreground">Estimez le coût de votre projet en quelques secondes.</p>
            </div>
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {services.map((sv) => (
                <div key={sv.id} className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
                  <p className="font-medium">{sv.name}</p>
                  {sv.description && <p className="mt-1 text-xs text-muted-foreground">{sv.description}</p>}
                  <p className="mt-2 text-sm font-semibold text-primary">{euros(sv.unit_price_cents)} / {sv.unit_label}</p>
                </div>
              ))}
            </div>
            <Simulator services={services} title={s.simulator_title} />
          </div>
        </section>
      )}

      {/* Avis */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold">Ils nous font confiance</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-[var(--radius-app)] border border-border bg-surface p-6">
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
                </div>
                <p className="mt-3 text-sm">{r.content}</p>
                <p className="mt-3 text-sm font-medium">{r.author_name}{r.author_role ? <span className="text-muted-foreground"> · {r.author_role}</span> : null}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/avis" className="text-sm font-medium text-primary hover:underline">Voir tous les avis →</Link>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold">Un projet d'isolation ou de rénovation ?</h2>
          <p className="mt-2 text-primary-foreground/80">{s.cta_text}</p>
          <Link href="/contact" className="mt-6 inline-block rounded-[var(--radius-app)] bg-white px-6 py-3 font-medium text-primary hover:bg-white/90">Nous contacter</Link>
        </div>
      </section>
    </>
  );
}
