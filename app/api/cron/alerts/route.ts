import { createAlertsDigestHandler, getAlertsRepository, getMailer } from "@/lib/alerts";
import { getCatalogueReadRepository } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The daily alert digest (Story 4.4), at 08:00 per vercel.json. */
export async function GET(request: Request): Promise<Response> {
  return createAlertsDigestHandler({
    alerts: getAlertsRepository(),
    catalogue: getCatalogueReadRepository(),
    mailer: getMailer(),
    cronSecret: process.env.CRON_SECRET,
    signingSecret: process.env.ALERTS_SIGNING_SECRET,
    now: () => new Date(),
  })(request);
}
