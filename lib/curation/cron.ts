import { createHash, timingSafeEqual } from "node:crypto";
import type { CurationJobsRepository } from "./repository";
import { checkWatch, type WatcherDeps } from "./watcher";

/** Constant-time bearer check (security baseline §2). Hashing first makes lengths equal. */
export function isAuthorizedCron(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const actual = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, actual);
}

export type SourceWatchSummary = {
  checked: number;
  outcomes: Record<string, number>;
  reverifyTasksOpened: number;
};

export function createSourceWatchHandler(deps: {
  jobs: CurationJobsRepository;
  watcher: WatcherDeps;
  cronSecret: string | undefined;
  today: () => string;
}) {
  return async function handle(request: Request): Promise<Response> {
    if (!isAuthorizedCron(request, deps.cronSecret)) {
      return Response.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid cron credentials.",
            request_id: `req_${crypto.randomUUID()}`,
          },
        },
        { status: 401 },
      );
    }

    const summary: SourceWatchSummary = { checked: 0, outcomes: {}, reverifyTasksOpened: 0 };
    for (const watch of await deps.jobs.listDueWatches()) {
      const outcome = await checkWatch(watch, deps.watcher);
      await deps.jobs.recordOutcome(watch, outcome);
      summary.checked++;
      summary.outcomes[outcome.kind] = (summary.outcomes[outcome.kind] ?? 0) + 1;
    }
    summary.reverifyTasksOpened = await deps.jobs.openReverifyTasks(deps.today());

    return Response.json(summary);
  };
}
