import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  createCatalogueSyncRepository,
  validateCatalogueFile,
  type ValidCatalogueFile,
} from "@/lib/catalog";
import { createCurationJobsRepository } from "@/lib/curation";
import { programs, programVersions, reviewTasks, sourceWatches } from "@/lib/db/schema";
import { exampleFile } from "../fixtures/catalogue";
import { connectTestDatabase, uniqueId } from "./helpers";

// ADR-8 — syncing verified catalogue files into immutable programme versions.

const db = connectTestDatabase();
const sync = createCatalogueSyncRepository(db);

function verifiedFile(overrides: Record<string, unknown> = {}): ValidCatalogueFile {
  const slug = (overrides.slug as string) ?? uniqueId("prog").replace(/_/g, "-");
  const raw = exampleFile({
    slug,
    verification: { status: "verified", verifiedAt: "2026-09-16", verifiedBy: "rhorba" },
    ...overrides,
  });
  const result = validateCatalogueFile(raw, {
    fileName: `${slug}.json`,
    today: "2026-09-17",
    allowedHosts: new Set(["www.tamwilcom.ma"]),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.file;
}

async function versionsOf(slug: string) {
  return db
    .select({
      version: programVersions.version,
      rules: programVersions.rules,
      amountMaxMad: programVersions.amountMaxMad,
      publishedAt: programVersions.publishedAt,
      verifiedBy: programVersions.verifiedBy,
    })
    .from(programVersions)
    .innerJoin(programs, eq(programs.id, programVersions.programId))
    .where(eq(programs.slug, slug))
    .orderBy(asc(programVersions.version));
}

describe("catalogue sync", () => {
  it("publishes a verified file as version 1, and is idempotent", async () => {
    const file = verifiedFile();
    expect(await sync.sync([file])).toEqual({
      published: [file.slug],
      unchanged: [],
      skippedDrafts: [],
    });
    expect(await sync.sync([file])).toEqual({
      published: [],
      unchanged: [file.slug],
      skippedDrafts: [],
    });

    const versions = await versionsOf(file.slug);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      version: 1,
      amountMaxMad: "1000000.00",
      verifiedBy: "rhorba",
    });
    expect(versions[0]!.publishedAt).not.toBeNull();
  });

  it("creates a new version on change and never modifies the old one", async () => {
    const file = verifiedFile();
    await sync.sync([file]);
    const [v1] = await versionsOf(file.slug);

    const changed = { ...file, version: { ...file.version, amountMaxMad: 1_200_000 } };
    expect((await sync.sync([changed])).published).toEqual([file.slug]);

    const versions = await versionsOf(file.slug);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[0]).toEqual(v1);
    expect(versions[1]!.amountMaxMad).toBe("1200000.00");
  });

  it("detects rule changes even though jsonb reorders keys", async () => {
    const file = verifiedFile();
    await sync.sync([file]);
    const stricter = {
      ...file,
      parsedRules: { ...file.parsedRules, value: 36 } as typeof file.parsedRules,
    };
    expect((await sync.sync([stricter])).published).toEqual([file.slug]);
    expect((await sync.sync([stricter])).unchanged).toEqual([file.slug]);
  });

  it("skips drafts entirely", async () => {
    const draft = {
      ...verifiedFile(),
      verification: { status: "draft" as const, verifiedAt: null, verifiedBy: null },
    };
    expect(await sync.sync([draft])).toEqual({
      published: [],
      unchanged: [],
      skippedDrafts: [draft.slug],
    });
    expect(await db.select().from(programs).where(eq(programs.slug, draft.slug))).toEqual([]);
  });

  it("upserts listed watches and removes unlisted ones", async () => {
    const file = verifiedFile();
    const second = "https://www.tamwilcom.ma/fr/example-2";
    await sync.sync([{ ...file, watches: [...file.watches, { url: second, cssSelector: null }] }]);
    await sync.sync([{ ...file, watches: [{ url: second, cssSelector: "#conditions" }] }]);

    const [program] = await db.select().from(programs).where(eq(programs.slug, file.slug));
    const watches = await db
      .select()
      .from(sourceWatches)
      .where(eq(sourceWatches.programId, program!.id));
    expect(watches.map((w) => [w.url, w.cssSelector])).toEqual([[second, "#conditions"]]);

    await sync.sync([{ ...file, watches: [] }]);
    expect(
      await db.select().from(sourceWatches).where(eq(sourceWatches.programId, program!.id)),
    ).toEqual([]);
  });

  it("leaves programmes that are no longer in the files untouched", async () => {
    const file = verifiedFile();
    await sync.sync([file]);
    await sync.sync([verifiedFile()]);
    expect(await versionsOf(file.slug)).toHaveLength(1);
  });
});

describe("review task commands", () => {
  it("lists open tasks with their programme, and resolves each once", async () => {
    const jobs = createCurationJobsRepository(db);
    const file = verifiedFile();
    await sync.sync([file]);
    const [program] = await db.select().from(programs).where(eq(programs.slug, file.slug));
    const [task] = await db
      .insert(reviewTasks)
      .values({ programId: program!.id, kind: "source_changed", diffExcerpt: "- a\n+ b" })
      .returning();

    expect((await jobs.listOpenTasks()).find((t) => t.id === task!.id)).toMatchObject({
      slug: file.slug,
      kind: "source_changed",
      url: null,
    });
    expect(await jobs.resolveTask(task!.id, "resolved_no_change", "rhorba")).toBe(true);
    expect(await jobs.resolveTask(task!.id, "resolved_changed", "rhorba")).toBe(false);
    expect((await jobs.listOpenTasks()).some((t) => t.id === task!.id)).toBe(false);
  });
});
