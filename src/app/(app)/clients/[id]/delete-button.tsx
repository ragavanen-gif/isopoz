"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteClientAction } from "@/modules/clients/actions";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        <Trash2 /> Supprimer
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Confirmer ?</span>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => startTransition(() => deleteClientAction(clientId))}
      >
        {pending ? "Suppression…" : "Oui, supprimer"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(false)}>
        Non
      </Button>
    </div>
  );
}
