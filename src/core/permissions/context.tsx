"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PermissionKey } from "./catalog";

type PermissionContextValue = {
  isSuperAdmin: boolean;
  permissions: Set<string>;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  isSuperAdmin,
  permissions,
  children,
}: {
  isSuperAdmin: boolean;
  permissions: string[];
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ isSuperAdmin, permissions: new Set(permissions) }),
    [isSuperAdmin, permissions],
  );
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/** Hook UI : masquer un bouton/menu si la permission manque. NB : confort, pas sécurité. */
export function useCan(key: PermissionKey): boolean {
  const ctx = useContext(PermissionContext);
  if (!ctx) return false;
  return ctx.isSuperAdmin || ctx.permissions.has(key);
}

export function useIsSuperAdmin(): boolean {
  return useContext(PermissionContext)?.isSuperAdmin ?? false;
}
