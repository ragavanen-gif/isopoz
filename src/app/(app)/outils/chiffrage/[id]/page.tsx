import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getEstimationProject, listPrestations } from "@/modules/tools/queries";
import { deleteEstimationProjectAction } from "@/modules/tools/actions";
import { EstimationEditor } from "@/modules/tools/estimation-editor";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default async function EstimationProjectPage({ params }: PageProps<"/outils/chiffrage/[id]"> ) {
  await requirePermission("tools.view");
  const user = await getSessionUser();
  const { id } = await params;
  const [project, prestations] = await Promise.all([getEstimationProject(id), listPrestations()]);
  if (!project) notFound();
  const canDelete = user ? userCan(user, "tools.manage") : false;

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.plan_filename ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/outils/chiffrage"><Button variant="ghost" size="sm"><ArrowLeft /> Retour</Button></Link>
            {canDelete && (
              <form action={deleteEstimationProjectAction.bind(null, id)}>
                <Button type="submit" variant="secondary" size="sm">Supprimer</Button>
              </form>
            )}
          </div>
        }
      />
      <EstimationEditor project={project} prestations={prestations} />
    </>
  );
}
