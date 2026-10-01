import { type NextRequest } from "next/server";
import { updateSession } from "@/core/supabase/middleware";

// Next.js 16 : la convention `middleware` est renommée `proxy` (runtime nodejs).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Tout sauf _next et fichiers statiques (images, worker .mjs, .pdf, polices, etc.)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|js|css|pdf|txt|woff|woff2|ttf|map)$).*)",
  ],
};
