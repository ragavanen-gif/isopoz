import { type NextRequest } from "next/server";
import { updateSession } from "@/core/supabase/middleware";

// Next.js 16 : la convention `middleware` est renommée `proxy` (runtime nodejs).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Tout sauf assets statiques et fichiers image
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
