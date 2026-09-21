"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, HardHat, Calendar, UserCog, Wrench,
  Package, FolderOpen, BarChart3, Settings, Menu, X, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav-config";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, FileText, HardHat, Calendar, UserCog, Wrench,
  Package, FolderOpen, BarChart3, Settings, UserCircle,
};

export function Sidebar({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const nav = (
    <nav className="flex flex-col gap-6 p-4">
      <Link href="/dashboard" className="px-2 text-2xl font-bold tracking-tight text-white">
        ISOPoz
      </Link>
      <div className="flex flex-col gap-5">
        {groups.map((group) => {
          const Icon = ICONS[group.icon] ?? LayoutDashboard;
          return (
            <div key={group.label}>
              <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
                <Icon className="size-3.5" />
                {group.label}
              </div>
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-sidebar-active text-white font-medium"
                            : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Bouton mobile */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3 z-30 rounded-md bg-sidebar p-2 text-white lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 overflow-y-auto bg-sidebar lg:block">{nav}</aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-sidebar">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-sidebar-foreground"
              aria-label="Fermer le menu"
            >
              <X className="size-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
