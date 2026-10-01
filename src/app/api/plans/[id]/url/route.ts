import { NextResponse } from "next/server";
import { getSessionUser, userCan } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";

/** Renvoie une URL signée (courte durée) du plan PDF d'un projet de métré. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!userCan(user, "tools.view")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("estimation_projects")
    .select("plan_path")
    .eq("id", id)
    .maybeSingle();
  if (!project?.plan_path) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

  const { data: signed, error } = await admin.storage.from("plans").createSignedUrl(project.plan_path, 600);
  if (error || !signed) return NextResponse.json({ error: "Échec du lien" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl });
}
