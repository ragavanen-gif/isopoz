"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

type Result = { ok: true } | { ok: false; error: string };

/** Bouton qui exécute une Server Action renvoyant {ok,error} et affiche le retour. */
export function AsyncActionButton({
  action,
  label,
  pendingLabel,
  successMessage,
  variant = "secondary",
  size = "sm",
  icon,
  confirm,
}: {
  action: () => Promise<Result>;
  label: string;
  pendingLabel?: string;
  successMessage?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: ReactNode;
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await action();
      setMsg(res.ok ? { ok: true, text: successMessage ?? "Fait." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant={variant} size={size} onClick={run} disabled={pending}>
        {icon} {pending ? pendingLabel ?? "En cours…" : label}
      </Button>
      {msg && <p className={msg.ok ? "text-xs text-success" : "text-xs text-danger"}>{msg.text}</p>}
    </div>
  );
}
