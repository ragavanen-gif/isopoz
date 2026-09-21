import { getSiteSettings } from "@/modules/site/queries";

export const metadata = { title: "À propos — ISOPoz" };

export default async function AProposPage() {
  const s = await getSiteSettings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">{s.about_title}</h1>
      <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-foreground">{s.about_text}</div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { k: "Expertise", v: "Isolation thermique & pose" },
          { k: "Engagement", v: "Qualité & délais respectés" },
          { k: "Proximité", v: "Un interlocuteur dédié" },
        ].map((c) => (
          <div key={c.k} className="rounded-[var(--radius-app)] border border-border bg-surface p-5 text-center">
            <p className="font-semibold text-primary">{c.k}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
