import Link from "next/link";
import { Target, HeartHandshake, ShieldCheck, Leaf, Award, Users } from "lucide-react";
import { getSiteSettings } from "@/modules/site/queries";
import { HexEmblem, VisualPanel } from "@/modules/site/decor";

export const metadata = { title: "À propos — ISOPoz" };

export default async function AProposPage() {
  const s = await getSiteSettings();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{s.about_title}</h1>
          <div className="mt-6 space-y-4 whitespace-pre-wrap text-base leading-relaxed text-foreground">{s.about_text}</div>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Spécialisée dans le <strong>flocage</strong> et le <strong>calorifugeage</strong>, notre entreprise met son
            savoir-faire au service des professionnels, industriels et collectivités. De la protection passive contre
            l'incendie à l'isolation thermique des réseaux, nous garantissons des travaux conformes, durables et
            performants.
          </p>
        </div>
        <VisualPanel className="aspect-[4/3]">
          <HexEmblem className="mx-auto w-44 opacity-95" />
          <p className="mt-4 text-lg font-semibold">{s.company_name}</p>
          <p className="text-sm text-white/70">{s.tagline}</p>
        </VisualPanel>
      </div>

      {/* Valeurs */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold">Nos valeurs</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Target, title: "Expertise", text: "Un métier technique maîtrisé de bout en bout." },
            { icon: ShieldCheck, title: "Sécurité", text: "Le respect strict des normes et de la protection incendie." },
            { icon: HeartHandshake, title: "Proximité", text: "Un interlocuteur dédié et à l'écoute." },
            { icon: Leaf, title: "Performance énergétique", text: "Des solutions qui réduisent les déperditions." },
          ].map((v) => (
            <div key={v.title} className="rounded-[var(--radius-app)] border border-border bg-surface p-6 text-center">
              <v.icon className="mx-auto size-8 text-accent" />
              <p className="mt-3 font-semibold">{v.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Engagements */}
      <section className="mt-16 rounded-[var(--radius-app)] border border-border bg-muted/40 p-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { icon: Award, title: "Qualité certifiée", text: "Des matériaux et procédés conformes aux normes." },
            { icon: Users, title: "Équipes qualifiées", text: "Des techniciens formés et expérimentés." },
            { icon: ShieldCheck, title: "Travaux garantis", text: "Contrôle qualité et rapport de conformité." },
          ].map((e) => (
            <div key={e.title} className="flex gap-3">
              <e.icon className="size-8 shrink-0 text-primary" />
              <div><p className="font-semibold">{e.title}</p><p className="text-sm text-muted-foreground">{e.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 text-center">
        <Link href="/contact" className="inline-block rounded-[var(--radius-app)] bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-accent/90">
          Discutons de votre projet
        </Link>
      </div>
    </div>
  );
}
