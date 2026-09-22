import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const sp = await searchParams;
  const redirectTo = typeof sp.redirect === "string" ? sp.redirect : "/dashboard";
  const disabled = sp.error === "disabled";

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm text-sidebar-foreground">Espace professionnel — Gestion interne</p>
        </div>
        <div className="rounded-[var(--radius-app)] bg-surface p-6 shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ISOPOZ" className="mx-auto mb-5 h-16 w-auto" />
          <h2 className="mb-1 text-lg font-semibold">Connexion</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Accédez à votre espace de travail.
          </p>
          {disabled && (
            <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              Ce compte est désactivé. Contactez un administrateur.
            </p>
          )}
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </main>
  );
}
