import { lookup } from "node:dns/promises";
import {
  createSourceWatchHandler,
  getCurationJobsRepository,
  parseAllowedHosts,
} from "@/lib/curation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_USER_AGENT = "Da3mBot/1.0 (+https://da3m.ma/bot)";

export async function GET(request: Request): Promise<Response> {
  return createSourceWatchHandler({
    jobs: getCurationJobsRepository(),
    cronSecret: process.env.CRON_SECRET,
    today: () => new Date().toISOString().slice(0, 10),
    watcher: {
      fetch,
      resolveAll: async (hostname) =>
        (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address),
      allowedHosts: parseAllowedHosts(process.env.WATCH_ALLOWED_HOSTS),
      userAgent: process.env.WATCH_USER_AGENT || DEFAULT_USER_AGENT,
    },
  })(request);
}
