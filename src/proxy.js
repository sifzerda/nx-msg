// src/proxy.js

import { updateSession } from "./lib/supabase/proxy";

export function proxy(request) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico$|sw\\.js$|manifest\\.webmanifest$|manifest\\.json$|robots\\.txt$|sitemap\\.xml$|api/push/send$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2)$).*)",
  ],
};