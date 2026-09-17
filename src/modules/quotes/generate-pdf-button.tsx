"use client";

import { useTransition, useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateQuoteDocumentAction } from "@/modules/documents/file-actions";

export function GenerateQuotePdfButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateQuoteDocumentAction(quoteId);
      if (res.ok) {
        // Ouvre le téléchargement du PDF fraîchement généré.
        window.open(`/api/documents/${res.id}/download`, "_blank");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" className="w-full" onClick={generate} disabled={pending}>
        <FileDown /> {pending ? "Génération…" : "Générer le PDF"}
      </Button>
      <p className="text-xs text-muted-foreground">Le PDF est classé dans les documents du client.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
