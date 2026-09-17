"use client";

import { useState, useRef, useEffect } from "react";
import { Search, LogOut, ChevronDown } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

export function Topbar({ fullName, email }: { fullName: string | null; email: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (fullName ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-surface px-4 pl-16 lg:pl-4">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Rechercher un client, devis, chantier…"
          className="h-9 w-full rounded-[var(--radius-app)] border border-input bg-muted/40 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div ref={ref} className="relative ml-auto">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials || "?"}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block font-medium leading-tight">{fullName ?? "Utilisateur"}</span>
            <span className="block text-xs leading-tight text-muted-foreground">{email}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-48 rounded-[var(--radius-app)] border border-border bg-surface py-1 shadow-lg">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <LogOut className="size-4" /> Se déconnecter
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
