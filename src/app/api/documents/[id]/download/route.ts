import { NextResponse } from "next/server";
import { getSessionUser, userCan } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { CLIENT_BUCKET, HR_BUCKET } from "@/core/documents/storage";

/**
 * Téléchargement sécurisé : contrôle de permission côté serveur, puis URL signée
 * générée par le service_role (buckets privés). Voir docs/05 & docs/06.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("id, client_id, employee_id, storage_path, name")
    .eq("id", id)
    .maybeSingle();

  if (!doc || !doc.storage_path) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Périmètre : document client → documents.download ; document RH → hr.manage.
  const isHr = !!doc.employee_id;
  const bucket = isHr ? HR_BUCKET : CLIENT_BUCKET;
  const allowed = isHr ? userCan(user, "hr.manage") : userCan(user, "documents.download");
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { data: signed, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(doc.storage_path, 60, { download: doc.name ?? true });
  if (error || !signed) {
    return NextResponse.json({ error: "Échec de génération du lien" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
