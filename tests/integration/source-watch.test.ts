import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createCurationJobsRepository, createSourceWatchHandler, hashText } from "@/lib/curation";
import { programs, programVersions, reviewTasks, sourceWatches } from "@/lib/db/schema";
import { connectTestDatabase, uniqueId } from "./helpers";

// Story 2.4 — source watcher persistence and cron entry point.

const db = connectTestDatabase();
const jobs = createCurationJobsRepository(db);

async function seedProgram(options: { verifiedAt?: string; published?: boolean } = {}) {
  const [program] = await db
    .insert(programs)
    .values({ slug: uniqueId("prog"), operator: "Tamwilcom", kind: "loan" })
    .returning();
  const [version] = await db
    .insert(programVersions)
    .values({
      programId: program!.id,
      version: 1,
      status: "open",
      rules: { kind: "criterion", id: "a", field: "is_mre", op: "is_true", reason: { fr: "x" } },
      content: { fr: { title: "T" } },
      sourceUrl: "https://www.tamwilcom.ma/fr/intelaka",
      verifiedAt: options.verifiedAt ?? "2026-09-01",
      verifiedBy: "user_curator",
      publishedAt: options.published === false ? null : new Date("2026-09-01T10:00:00Z"),
    })
    .returning();
  return { program: program!, version: version! };
}

async function seedWatch(programId: string, url: string, lastCheckedAt: Date | null = null) {
  const [watch] = await db
    .insert(sourceWatches)
    .values({ programId, url, lastCheckedAt })
    .returning();
  return watch!;
}

const tasksFor = (programId: string) =>
  db.select().from(reviewTasks).where(eq(reviewTasks.programId, programId));

describe("recording watch outcomes", () => {
  it("stores a baseline without opening a task", async () => {
    const { program } = await seedProgram();
    const watch = await seedWatch(program.id, "https://www.tamwilcom.ma/fr/a");
    await jobs.recordOutcome(watch, { kind: "baseline", hash: hashText("x"), text: "x" });
    const [row] = await db.select().from(sourceWatches).where(eq(sourceWatches.id, watch.id));
    expect(row).toMatchObject({ lastHash: hashText("x"), lastText: "x", lastError: null });
    expect(row!.lastCheckedAt).not.toBeNull();
    expect(await tasksFor(program.id)).toEqual([]);
  });

  it("opens a review task on change and leaves the published version untouched (Story 2.4 AC)", async () => {
    const { program, version } = await seedProgram();
    const watch = await seedWatch(program.id, "https://www.tamwilcom.ma/fr/b");
    await jobs.recordOutcome(watch, {
      kind: "changed",
      hash: hashText("new"),
      text: "new",
      diffExcerpt: "- old\n+ new",
    });

    const tasks = await tasksFor(program.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: "source_changed",
      status: "open",
      diffExcerpt: "- old\n+ new",
      watchId: watch.id,
    });

    const [after] = await db
      .select()
      .from(programVersions)
      .where(eq(programVersions.id, version.id));
    expect(after).toEqual(version);
    const [row] = await db.select().from(sourceWatches).where(eq(sourceWatches.id, watch.id));
    expect(row!.lastChangedAt).not.toBeNull();
  });

  it("clears the last error when a check succeeds again", async () => {
    const { program } = await seedProgram();
    const watch = await seedWatch(program.id, "https://www.tamwilcom.ma/fr/c");
    await jobs.recordOutcome(watch, { kind: "error", reason: "HTTP 500" });
    await jobs.recordOutcome(watch, { kind: "unchanged", hash: "h" });
    const [row] = await db.select().from(sourceWatches).where(eq(sourceWatches.id, watch.id));
    expect(row!.lastError).toBeNull();
  });

  it("opens one fetch_failing task per watch, not one per run", async () => {
    const { program } = await seedProgram();
    const watch = await seedWatch(program.id, "https://evil.example/");
    await jobs.recordOutcome(watch, {
      kind: "blocked",
      reason: "Host not in WATCH_ALLOWED_HOSTS: evil.example",
    });
    await jobs.recordOutcome(watch, { kind: "error", reason: "Timed out" });

    const tasks = await tasksFor(program.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: "fetch_failing",
      diffExcerpt: "Host not in WATCH_ALLOWED_HOSTS: evil.example",
    });
    const [row] = await db.select().from(sourceWatches).where(eq(sourceWatches.id, watch.id));
    expect(row!.lastError).toBe("Timed out");

    await db
      .update(reviewTasks)
      .set({ status: "resolved_no_change" })
      .where(eq(reviewTasks.id, tasks[0]!.id));
    await jobs.recordOutcome(watch, { kind: "error", reason: "Timed out again" });
    expect(await tasksFor(program.id)).toHaveLength(2);
  });
});

describe("scheduling", () => {
  it("returns the least recently checked watch per host", async () => {
    const { program } = await seedProgram();
    const host = `${uniqueId("h")}.example`;
    const old = await seedWatch(
      program.id,
      `https://${host}/old`,
      new Date("2026-09-01T00:00:00Z"),
    );
    await seedWatch(program.id, `https://${host}/recent`, new Date("2026-09-16T00:00:00Z"));
    const never = await seedWatch(program.id, `https://other-${host}/never`);
    const invalid = await seedWatch(program.id, "::not a url::");

    const due = await jobs.listDueWatches();
    const ids = due.map((w) => w.id);
    expect(ids).toContain(old.id);
    expect(ids).toContain(never.id);
    expect(ids).toContain(invalid.id);
    expect(due.filter((w) => w.url.includes(`//${host}/`))).toHaveLength(1);
  });

  it("opens reverify tasks for stale published versions only, once", async () => {
    const stale = await seedProgram({ verifiedAt: "2026-08-01" });
    const fresh = await seedProgram({ verifiedAt: "2026-09-10" });
    const draft = await seedProgram({ verifiedAt: "2026-01-01", published: false });

    await jobs.openReverifyTasks("2026-09-17");
    await jobs.openReverifyTasks("2026-09-18");

    expect((await tasksFor(stale.program.id)).map((t) => t.kind)).toEqual(["reverify_due"]);
    expect(await tasksFor(fresh.program.id)).toEqual([]);
    expect(await tasksFor(draft.program.id)).toEqual([]);
  });

  it("judges staleness by the latest published version", async () => {
    const { program } = await seedProgram({ verifiedAt: "2026-06-01" });
    await db.insert(programVersions).values({
      programId: program.id,
      version: 2,
      status: "open",
      rules: {},
      content: {},
      sourceUrl: "https://www.tamwilcom.ma/fr/intelaka",
      verifiedAt: "2026-09-15",
      verifiedBy: "user_curator",
      publishedAt: new Date("2026-09-15T10:00:00Z"),
    });
    await jobs.openReverifyTasks("2026-09-17");
    expect(await tasksFor(program.id)).toEqual([]);
  });
});

describe("cron endpoint", () => {
  const request = (auth?: string) =>
    new Request("http://localhost/api/cron/source-watch", {
      headers: auth ? { authorization: auth } : {},
    });

  const handler = (cronSecret: string | undefined) =>
    createSourceWatchHandler({
      jobs,
      cronSecret,
      today: () => "2026-09-17",
      watcher: {
        fetch: (async () => new Response("", { status: 404 })) as unknown as typeof fetch,
        resolveAll: async () => ["196.200.1.10"],
        allowedHosts: new Set<string>(),
        userAgent: "Da3mBot/1.0",
      },
    });

  it("rejects missing, wrong, and unconfigured secrets", async () => {
    expect((await handler("s3cret")(request())).status).toBe(401);
    expect((await handler("s3cret")(request("Bearer wrong"))).status).toBe(401);
    expect((await handler(undefined)(request("Bearer "))).status).toBe(401);
  });

  it("runs due watches and reports a summary", async () => {
    const response = await handler("s3cret")(request("Bearer s3cret"));
    expect(response.status).toBe(200);
    const summary = (await response.json()) as {
      checked: number;
      outcomes: Record<string, number>;
    };
    expect(summary.checked).toBeGreaterThan(0);
    // With an empty allowlist every watch is blocked before any request.
    expect(Object.keys(summary.outcomes)).toEqual(["blocked"]);
  });
});
