import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import type { NextFetchEvent, NextRequest } from "next/server";
import { routing } from "./i18n/routing";

/**
 * Locale negotiation for everyone; Clerk only where someone must be signed in (ADR-7).
 *
 * Clerk is invoked inside the branch rather than wrapped around the whole handler on
 * purpose: the public wizard, results and catalogue are the acquisition surface, and
 * they must keep working — and keep being statically served — whether or not Clerk is
 * configured or reachable. Wrapping everything would make every public request depend
 * on Clerk credentials.
 */

const intlMiddleware = createMiddleware(routing);

const isPrivate = createRouteMatcher([
  "/:locale/mon-espace(.*)",
  "/:locale/cabinet(.*)",
  "/:locale/admin(.*)",
]);

const privateMiddleware = clerkMiddleware(async (auth, request) => {
  // `auth.protect()` answers an unauthenticated page request with 404 when it cannot
  // resolve a sign-in URL, which tells a visitor their own space does not exist.
  // Redirecting explicitly sends them somewhere they can actually do something.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  return intlMiddleware(request as NextRequest);
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  return isPrivate(request) ? privateMiddleware(request, event) : intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
