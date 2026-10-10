import { getAlertsRepository, verifyAlertToken } from "@/lib/alerts";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058), the target of every digest's List-Unsubscribe
 * header. Mail clients POST here without a page in between; RFC 8058 makes POST the
 * only safe method, since scanners fetch GET links.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.ALERTS_SIGNING_SECRET;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const now = new Date();
  const payload = secret ? verifyAlertToken(token, "unsubscribe", secret, now) : null;

  if (!payload || !(await getAlertsRepository().unsubscribe(payload.subscriptionId, now))) {
    return Response.json(
      {
        error: {
          code: "INVALID_TOKEN",
          message: "This unsubscribe link is not valid.",
          request_id: `req_${crypto.randomUUID()}`,
        },
      },
      { status: 400 },
    );
  }
  return new Response(null, { status: 204 });
}

/** A client that opens the header link instead gets the page with the button. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(`/${routing.defaultLocale}/alertes/desinscription`, url.origin);
  target.searchParams.set("t", url.searchParams.get("t") ?? "");
  return Response.redirect(target, 303);
}
