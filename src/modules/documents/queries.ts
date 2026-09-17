import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type DocumentRow = {
  id: string;
  client_id: string | null;
  employee_id: string | null;
  year: number;
  doc_type: string;
  ref_date: string;
  reference: string | null;
  name: string;
  storage_path: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string;
};

export async function listDocuments(clientId?: string): Promise<DocumentRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("documents")
    .select("id, client_id, employee_id, year, doc_type, ref_date, reference, name, storage_path, amount_cents, status, created_at")
    .order("ref_date", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  else q = q.not("client_id", "is", null); // documents clients par défaut (RH séparés)
  const { data } = await q;
  return (data ?? []) as DocumentRow[];
}

/** Regroupe pour l'affichage Client → Année → Type (classement automatique). */
export function groupByYearType(docs: DocumentRow[]) {
  const map = new Map<number, Map<string, DocumentRow[]>>();
  for (const d of docs) {
    const byType = map.get(d.year) ?? new Map<string, DocumentRow[]>();
    const arr = byType.get(d.doc_type) ?? [];
    arr.push(d);
    byType.set(d.doc_type, arr);
    map.set(d.year, byType);
  }
  return map;
}
