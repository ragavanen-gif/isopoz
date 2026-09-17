"use client";

import { useState, useRef, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { saveTemplateBodyAction } from "./actions";
import { renderTemplate, KNOWN_VARIABLES } from "@/core/documents/template-engine";

const SAMPLE = {
  client: {
    nom: "Client ABC",
    adresse: "12 rue de l'Exemple, 75000 Paris",
    email: "contact@abc.fr",
    telephone: "01 23 45 67 89",
    siret: "123 456 789 00012",
    tva: "FR12345678900",
  },
  date: new Date().toLocaleDateString("fr-FR"),
  numero: "DEV-2026-001",
  objet: "Travaux d'isolation",
  gestionnaire: { nom: "Jean Martin", email: "jean.martin@isopoz.fr" },
  total_ht: "1 000,00 €",
  tva: "200,00 €",
  total_ttc: "1 200,00 €",
  prestations: "1× Isolation combles — 1 000,00 €",
};

export function TemplateEditor({
  templateId,
  initialBody,
  editable,
}: {
  templateId: string;
  initialBody: string;
  editable: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertVar(key: string) {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    setSaved(false);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  function save() {
    const fd = new FormData();
    fd.set("body", body);
    startTransition(async () => {
      await saveTemplateBodyAction(templateId, fd);
      setSaved(true);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <Textarea
          ref={ref}
          value={body}
          onChange={(e) => { setBody(e.target.value); setSaved(false); }}
          disabled={!editable}
          className="min-h-96 font-mono text-sm"
          placeholder="Rédigez le modèle. Utilisez les variables {{client.nom}}, {{total_ttc}}…"
        />
        {editable && (
          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} disabled={pending}>
              <Save /> {pending ? "Enregistrement…" : "Enregistrer (nouvelle version)"}
            </Button>
            {saved && <span className="text-sm text-success">Nouvelle version enregistrée.</span>}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {editable && (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-semibold">Variables</p>
            <div className="space-y-2">
              {KNOWN_VARIABLES.map((g) => (
                <div key={g.group}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.group}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.keys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => insertVar(k)}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-primary hover:text-primary-foreground"
                      >
                        {`{{${k}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-semibold">Aperçu (données d'exemple)</p>
          <pre className="whitespace-pre-wrap break-words text-sm text-foreground">{renderTemplate(body, SAMPLE)}</pre>
        </div>
      </div>
    </div>
  );
}
