import Link from "next/link";
import {
  Star, ShieldCheck, Clock, Flame, ThermometerSnowflake, Gauge,
  Award, Users, Ruler, CheckCircle2, Phone, FileCheck, HardHat, Sparkles,
} from "lucide-react";
import { getSiteSettings, listActiveServices, listPublishedReviews, listPublishedRealisations, siteMediaUrl } from "@/modules/site/queries";
import { Simulator } from "@/modules/site/simulator";
import { HexPattern, HexEmblem, VisualPanel } from "@/modules/site/decor";
import { euros } from "@/lib/format";

export default async function AccueilPage() {
  const [s, services, reviews, realisations] = await Promise.all([
    getSiteSettings(), listActiveServices(), listPublishedReviews(), listPublishedRealisations(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-sidebar text-white">
        <HexPattern className="text-white" opacity={0.10} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
              <Sparkles className="size-4" /> {s.tagline}
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">{s.hero_title}</h1>
            <p className="mt-4 max-w-xl text-lg text-sidebar-foreground">{s.hero_subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-[var(--radius-app)] bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-accent/90">{s.cta_text}</Link>
              <Link href="/realisations" className="rounded-[var(--radius-app)] border border-white/30 px-6 py-3 font-medium text-white hover:bg-white/10">Voir nos réalisations</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-sidebar-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Devis gratuit sous 48 h</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Interventions certifiées</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Travaux garantis</span>
            </div>
          </div>
          <VisualPanel className="hidden aspect-[4/3] lg:flex">
            <HexEmblem className="mx-auto w-48 opacity-95" />
            <p className="mt-4 text-lg font-semibold">Flocage & Calorifuge</p>
            <p className="text-sm text-white/70">Protection passive incendie · Isolation thermique</p>
          </VisualPanel>
        </div>
      </section>

      {/* Bandeau chiffres */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {[
            { icon: Award, num: "15+", label: "ans d'expérience" },
            { icon: HardHat, num: "500+", label: "chantiers réalisés" },
            { icon: Ruler, num: "120 000 m²", label: "traités" },
            { icon: Users, num: "98 %", label: "clients satisfaits" },
          ].map((k) => (
            <div key={k.label} className="text-center">
              <k.icon className="mx-auto size-7 text-accent" />
              <p className="mt-2 text-2xl font-bold text-primary">{k.num}</p>
              <p className="text-sm text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Nos métiers */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold">Nos domaines d'expertise</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Spécialiste du flocage et du calorifugeage, ISOPOZ intervient auprès des professionnels,
            industriels et collectivités pour protéger et isoler durablement vos bâtiments et réseaux.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { icon: Flame, title: "Flocage coupe-feu", text: "Protection passive contre l'incendie des structures métalliques et béton, conforme aux normes en vigueur (stabilité au feu).", points: ["Structures acier & béton", "Parkings & ERP", "Rapport de conformité"] },
            { icon: ThermometerSnowflake, title: "Calorifugeage", text: "Isolation thermique des tuyauteries, réseaux, chaufferies et équipements pour limiter les déperditions et réaliser des économies d'énergie.", points: ["Tuyauteries & gaines", "Chaufferies & CTA", "Économies d'énergie"] },
            { icon: Gauge, title: "Isolation thermo-acoustique", text: "Flocage isolant projeté pour le confort thermique et acoustique des bâtiments tertiaires et industriels.", points: ["Confort acoustique", "Isolation projetée", "Grandes surfaces"] },
          ].map((c) => (
            <article key={c.title} className="rounded-[var(--radius-app)] border border-border bg-surface p-6">
              <div className="flex size-12 items-center justify-center rounded-[var(--radius-app)] bg-primary/10 text-primary"><c.icon className="size-6" /></div>
              <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
              <ul className="mt-4 space-y-1.5">
                {c.points.map((p) => <li key={p} className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-accent" /> {p}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Notre méthode */}
      <section className="bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">Notre méthode, en 4 étapes</h2>
            <p className="mt-2 text-muted-foreground">Un accompagnement clair, du premier contact à la livraison.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Phone, step: "1", title: "Prise de contact", text: "Vous nous exposez votre besoin, nous étudions votre projet." },
              { icon: FileCheck, step: "2", title: "Visite & devis", text: "Diagnostic sur site et devis détaillé gratuit sous 48 h." },
              { icon: HardHat, step: "3", title: "Réalisation", text: "Intervention par nos équipes qualifiées, dans le respect des délais." },
              { icon: ShieldCheck, step: "4", title: "Réception", text: "Contrôle qualité, rapport de conformité et garantie des travaux." },
            ].map((st) => (
              <div key={st.step} className="relative rounded-[var(--radius-app)] border border-border bg-surface p-6">
                <span className="absolute -top-3 left-6 flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{st.step}</span>
                <st.icon className="mt-2 size-7 text-primary" />
                <h3 className="mt-3 font-semibold">{st.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{st.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi ISOPOZ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <VisualPanel className="aspect-[4/3]">
            <HexEmblem className="mx-auto w-40 opacity-95" />
            <p className="mt-4 text-lg font-semibold">Un savoir-faire reconnu</p>
          </VisualPanel>
          <div>
            <h2 className="text-3xl font-bold">Pourquoi choisir ISOPOZ ?</h2>
            <p className="mt-2 text-muted-foreground">Des équipes expérimentées, des matériaux certifiés et un engagement qualité sur chaque chantier.</p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { icon: Award, title: "Expertise certifiée", text: "Techniciens formés et qualifiés." },
                { icon: Clock, title: "Délais respectés", text: "Une organisation rigoureuse." },
                { icon: ShieldCheck, title: "Travaux garantis", text: "Conformité et suivi assurés." },
                { icon: Gauge, title: "Performance", text: "Économies d'énergie mesurables." },
              ].map((f) => (
                <div key={f.title} className="flex gap-3">
                  <f.icon className="size-6 shrink-0 text-accent" />
                  <div><p className="font-medium">{f.title}</p><p className="text-sm text-muted-foreground">{f.text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Simulateur */}
      {s.simulator_enabled && services.length > 0 && (
        <section className="relative overflow-hidden bg-sidebar text-white">
          <HexPattern className="text-white" opacity={0.08} />
          <div className="relative mx-auto max-w-4xl px-4 py-16">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold">Estimez votre projet</h2>
              <p className="mt-2 text-sidebar-foreground">Une estimation indicative immédiate, sans engagement.</p>
            </div>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {services.slice(0, 3).map((sv) => (
                <div key={sv.id} className="rounded-[var(--radius-app)] border border-white/15 bg-white/5 p-4">
                  <p className="font-medium text-white">{sv.name}</p>
                  <p className="mt-2 text-sm font-semibold text-accent">{euros(sv.unit_price_cents)} / {sv.unit_label}</p>
                </div>
              ))}
            </div>
            <Simulator services={services} title={s.simulator_title} />
          </div>
        </section>
      )}

      {/* Réalisations */}
      {realisations.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div><h2 className="text-3xl font-bold">Nos réalisations</h2><p className="mt-1 text-muted-foreground">Un aperçu de nos chantiers.</p></div>
            <Link href="/realisations" className="text-sm font-medium text-primary hover:underline">Tout voir →</Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {realisations.slice(0, 3).map((r) => {
              const img = siteMediaUrl(r.image_path);
              return (
                <article key={r.id} className="overflow-hidden rounded-[var(--radius-app)] border border-border bg-surface">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={r.title} className="h-48 w-full object-cover" />
                  ) : <VisualPanel className="h-48"><HexEmblem className="mx-auto w-20 opacity-90" /></VisualPanel>}
                  <div className="p-5"><h3 className="font-semibold">{r.title}</h3>{r.location && <p className="text-xs text-muted-foreground">{r.location}</p>}</div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Avis */}
      {reviews.length > 0 && (
        <section className="bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="mb-8 text-center text-3xl font-bold">Ils nous font confiance</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((r) => (
                <div key={r.id} className="rounded-[var(--radius-app)] border border-border bg-surface p-6">
                  <div className="flex gap-0.5 text-warning">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}</div>
                  <p className="mt-3 text-sm">{r.content}</p>
                  <p className="mt-3 text-sm font-medium">{r.author_name}{r.author_role ? <span className="text-muted-foreground"> · {r.author_role}</span> : null}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center"><Link href="/avis" className="text-sm font-medium text-primary hover:underline">Voir tous les avis →</Link></div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Questions fréquentes</h2>
        <div className="space-y-3">
          {[
            { q: "Le devis est-il vraiment gratuit ?", a: "Oui. Nous nous déplaçons pour évaluer votre projet et vous remettons un devis détaillé et gratuit, sans engagement." },
            { q: "Dans quelles zones intervenez-vous ?", a: "Nous intervenons sur l'ensemble de la région et ses alentours. Contactez-nous pour vérifier la couverture de votre secteur." },
            { q: "Vos travaux sont-ils garantis ?", a: "Oui. Nos interventions respectent les normes en vigueur et font l'objet d'un contrôle qualité ainsi que d'un rapport de conformité." },
            { q: "Quels délais pour une intervention ?", a: "Après validation du devis, nous planifions rapidement l'intervention en fonction de vos contraintes et de la nature du chantier." },
          ].map((f) => (
            <details key={f.q} className="group rounded-[var(--radius-app)] border border-border bg-surface p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold">Un projet de flocage ou de calorifugeage ?</h2>
          <p className="mt-2 text-primary-foreground/80">{s.cta_text} — nos équipes vous répondent rapidement.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-[var(--radius-app)] bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-accent/90">Nous contacter</Link>
            {s.phone && <a href={`tel:${s.phone}`} className="rounded-[var(--radius-app)] border border-white/30 px-6 py-3 font-medium hover:bg-white/10">{s.phone}</a>}
          </div>
        </div>
      </section>
    </>
  );
}
