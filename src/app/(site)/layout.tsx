import Link from "next/link";
import type { Metadata } from "next";
import { getSiteSettings } from "@/modules/site/queries";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return { title: `${s.company_name} — ${s.tagline}`, description: s.hero_subtitle };
}

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/realisations", label: "Nos réalisations" },
  { href: "/avis", label: "Avis clients" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const s = await getSiteSettings();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.png" alt={s.company_name} className="h-12 w-auto" /></Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm font-medium text-foreground hover:text-accent">{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/contact" className="hidden rounded-[var(--radius-app)] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 sm:inline-block">
              Devis gratuit
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Espace pro</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <p className="text-lg font-bold text-white">{s.company_name}</p>
            <p className="mt-2 text-sm">{s.tagline}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">Navigation</p>
            <ul className="space-y-1 text-sm">
              {NAV.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">Contact</p>
            <ul className="space-y-1 text-sm">
              {s.email && <li>{s.email}</li>}
              {s.phone && <li>{s.phone}</li>}
              {s.address && <li>{s.address}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-sidebar-foreground/70">
          © {new Date().getFullYear()} {s.company_name}. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
