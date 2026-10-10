import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { claimAnonymousData } from "@/lib/profiles";
import { getActor } from "@/lib/session";

/**
 * Where Mon espace sends a signed-in visitor who still carries an anonymous cookie
 * (Story 4.3). The claim rotates that cookie, and a Server Component cannot set
 * cookies, so the work happens here and the page only displays the count.
 *
 * A GET with a side effect, on purpose: it can only attach the caller's own anonymous
 * work to the caller's own account, so a cross-site request gains an attacker nothing.
 * The middleware has already required a session on this path.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;

  const actor = await getActor();
  const { claimed } = actor ? await claimAnonymousData(actor) : { claimed: 0 };

  const back = new URL(`/${locale}/mon-espace`, request.url);
  back.searchParams.set("reclames", String(claimed));
  return NextResponse.redirect(back, 303);
}
