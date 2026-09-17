import { PageHeader } from "./page-header";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-medium">Module en préparation</p>
          <p className="max-w-md text-sm text-muted-foreground">
            « {title} » sera disponible en <strong>{phase}</strong>. L'architecture et le
            modèle de données sont déjà définis (voir <code>docs/</code>).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
