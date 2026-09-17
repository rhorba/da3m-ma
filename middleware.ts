import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Public routes run locale negotiation only. Clerk middleware is added for the
// signed-in areas (/mon-espace, /cabinet, /admin) when they are built (ADR-7).
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
