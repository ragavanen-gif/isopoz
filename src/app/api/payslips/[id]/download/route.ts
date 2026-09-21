import { NextResponse } from "next/server";
import { getSessionUser, userCan } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { HR_BUCKET } from "@/core/documents/storage";

/** Téléchargement d'une fiche de paie : le salarié propriétaire OU hr.manage. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: payslip } = await admin
    .from("payslips")
    .select("id, employee_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!payslip || !payslip.storage_path) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const isOwner = user.employeeId && payslip.employee_id === user.employeeId;
  if (!isOwner && !userCan(user, "hr.manage")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: signed, error } = await admin.storage
    .from(HR_BUCKET)
    .createSignedUrl(payslip.storage_path, 60, { download: true });
  if (error || !signed) {
    return NextResponse.json({ error: "Échec du lien" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
