/**
 * Moteur de templating ISOPoz.
 * Remplace les variables {{chemin.pointé}} par les valeurs du contexte.
 * Ex: "{{client.nom}}" avec { client: { nom: "ABC" } } -> "ABC".
 * Une variable non résolue est laissée visible entre crochets pour signalement.
 */
export type TemplateContext = Record<string, unknown>;

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolve(path: string, ctx: TemplateContext): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, ctx);
}

export function renderTemplate(body: string, ctx: TemplateContext): string {
  return body.replace(VAR_RE, (_m, path: string) => {
    const value = resolve(path, ctx);
    if (value === undefined || value === null) return `[${path}]`;
    return String(value);
  });
}

/** Extrait la liste des variables utilisées dans un modèle (pour l'aide à la saisie). */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE);
  while ((m = re.exec(body)) !== null) found.add(m[1]);
  return Array.from(found).sort();
}

/** Variables standard documentées (aide dans l'éditeur de modèles). */
export const KNOWN_VARIABLES: { group: string; keys: string[] }[] = [
  { group: "Client", keys: ["client.nom", "client.adresse", "client.email", "client.telephone", "client.siret", "client.tva"] },
  { group: "Document", keys: ["date", "numero", "objet"] },
  { group: "Gestionnaire", keys: ["gestionnaire.nom", "gestionnaire.email"] },
  { group: "Montants", keys: ["total_ht", "tva", "total_ttc"] },
  { group: "Prestations", keys: ["prestations"] },
];
