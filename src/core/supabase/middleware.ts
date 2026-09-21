import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages d'authentification
const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"];
// Site vitrine public (accessible sans connexion)
const SITE_PREFIXES = ["/realisations", "/avis", "/a-propos", "/contact"];

function isPublicPath(path: string): boolean {
  if (path === "/") return true; // accueil du site
  if (AUTH_PATHS.some((p) => path.startsWith(p))) return true;
  if (SITE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return true;
  return false;
}

/** Rafraîchit la session Supabase et protège les routes authentifiées. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
