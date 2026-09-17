import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createCatalogueReadRepository,
  createCatalogueSyncRepository,
  validateCatalogueFile,
  type ValidCatalogueFile,
} from "@/lib/catalog";
import { AccessDeniedError, hashAnonToken, type Actor } from "@/lib/auth";
import { createProfilesRepository } from "@/lib/profiles";
import { buildReport, createReportsRepository } from "@/lib/reports";
import { exampleFile } from "../fixtures/catalogue";
import { connectTestDatabase, seedFirm, uniqueId } from "./helpers";

// Story 3.3 — reports pin the programme version they were run against (ADR-4) and are
// readable only by the visitor who owns the profile (security §4).

const db = connectTestDatabase();
const sync = createCatalogueSyncRepository(db);
const catalogue = createCatalogueReadRepository(db);
const profilesRepo = createProfilesRepository(db);
const reports = createReportsRepository(db);

const anon = (): Extract<Actor, { kind: "anonymous" }> => ({
  kind: "anonymous",
  tokenHash: hashAnonToken(uniqueId("token")),
});

function verifiedFile(slug: string, overrides: Record<string, unknown> = {}): ValidCatalogueFile {
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

/** The example file with its age ceiling moved, which changes who is eligible. */
function fileWithMaxAge(slug: string, months: number): ValidCatalogueFile {
  const base = exampleFile({ slug });
  const version = base.version as Record<string, unknown>;
  const rules = version.rules as Record<string, unknown>;
  return verifiedFile(slug, {
    version: { ...version, rules: { ...rules, value: months } },
    goldenProfiles: [
      { name: "young", profile: { company_age_months: 1 }, expected: "eligible" },
      {
        name: "old",
        profile: { company_age_months: months + 1 },
        expected: "ineligible",
        expectedFailing: ["young"],
      },
      {
        name: "unknown",
        profile: {},
        expected: "needs_info",
        expectedMissing: ["company_age_months"],
      },
    ],
  });
}

const slugFor = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

async function profileFor(actor: Actor, data: Record<string, unknown>) {
  return profilesRepo.saveProfile(actor, data);
}

describe("published catalogue reads", () => {
  it("returns each programme at its latest published version", async () => {
    const slug = slugFor("latest");
    await sync.sync([fileWithMaxAge(slug, 60)]);
    await sync.sync([fileWithMaxAge(slug, 24)]);

    const published = await catalogue.listPublished();
    const entry = published.filter((p) => p.slug === slug);

    expect(entry).toHaveLength(1);
    expect(entry[0]?.version).toBe(2);
    expect(entry[0]?.rules).toMatchObject({ field: "company_age_months", value: 24 });
  });

  it("leaves drafts out of the published catalogue", async () => {
    const slug = slugFor("draft");
    const raw = exampleFile({ slug });
    const validated = validateCatalogueFile(raw, {
      fileName: `${slug}.json`,
      today: "2026-09-17",
      allowedHosts: new Set(["www.tamwilcom.ma"]),
    });
    if (!validated.ok) throw new Error("fixture should validate");
    await sync.sync([validated.file]);

    const published = await catalogue.listPublished();
    expect(published.map((p) => p.slug)).not.toContain(slug);
  });

  it("carries the version facts a report needs to snapshot", async () => {
    const slug = slugFor("facts");
    await sync.sync([verifiedFile(slug)]);

    const entry = (await catalogue.listPublished()).find((p) => p.slug === slug);

    expect(entry).toMatchObject({
      operator: "Tamwilcom",
      kind: "loan",
      status: "open",
      amountMaxMad: 1_000_000,
      amountMinMad: null,
      sourceUrl: "https://www.tamwilcom.ma/fr/example",
      verifiedAt: "2026-09-16",
    });
    expect(entry?.content.fr?.title).toBe("Exemple");
  });
});

describe("creating reports", () => {
  it("stores a report against the visitor's own profile", async () => {
    const actor = anon();
    const profile = await profileFor(actor, { company_age_months: 12 });
    const published = await catalogue.listPublished();

    const report = await reports.createReport(actor, profile.id, buildReport({}, published));

    expect(report.profileId).toBe(profile.id);
    expect(report.orgId).toBeNull();
    expect(report.engineVersion).toBe("1.0.0");
  });

  it("refuses a profile the visitor does not own", async () => {
    const owner = anon();
    const stranger = anon();
    const profile = await profileFor(owner, { company_age_months: 12 });

    await expect(
      reports.createReport(stranger, profile.id, buildReport({}, [])),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("refuses an unknown profile id", async () => {
    await expect(
      reports.createReport(anon(), randomUUID(), buildReport({}, [])),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("refuses a malformed profile id without querying", async () => {
    await expect(
      reports.createReport(anon(), "not-a-uuid", buildReport({}, [])),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("refuses firm members, who work from cabinet reports instead", async () => {
    const { member } = await seedFirm(db, "Cabinet");
    const consultant = await member("consultant");
    const visitor = anon();
    const profile = await profileFor(visitor, {});

    await expect(
      reports.createReport(consultant, profile.id, buildReport({}, [])),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
});

describe("reading reports", () => {
  it("returns the report to its owner, with results intact", async () => {
    const actor = anon();
    const profile = await profileFor(actor, { company_age_months: 12 });
    const published = await catalogue.listPublished();
    const created = await reports.createReport(
      actor,
      profile.id,
      buildReport({ company_age_months: 12 }, published),
    );

    const fetched = await reports.getReport(actor, created.id);

    expect(fetched?.id).toBe(created.id);
    expect(fetched?.results.length).toBe(published.length);
    expect(fetched?.inputSnapshot).toEqual({ company_age_months: 12 });
  });

  it("hides the report from every other visitor", async () => {
    const owner = anon();
    const profile = await profileFor(owner, {});
    const created = await reports.createReport(owner, profile.id, buildReport({}, []));

    expect(await reports.getReport(anon(), created.id)).toBeNull();
    expect(await reports.getReport({ kind: "user", userId: uniqueId("u") }, created.id)).toBeNull();
    expect(
      await reports.getReport({ kind: "admin", userId: uniqueId("a") }, created.id),
    ).toBeNull();
  });

  it("returns null for unknown and malformed ids", async () => {
    const actor = anon();
    expect(await reports.getReport(actor, randomUUID())).toBeNull();
    expect(await reports.getReport(actor, "not-a-uuid")).toBeNull();
  });
});

describe("report immutability (ADR-4)", () => {
  it("keeps its original outcome after a stricter version is published", async () => {
    const slug = slugFor("immutable");
    await sync.sync([fileWithMaxAge(slug, 60)]);

    const actor = anon();
    const data = { company_age_months: 36 };
    const profile = await profileFor(actor, data);
    const before = (await catalogue.listPublished()).filter((p) => p.slug === slug);
    const created = await reports.createReport(actor, profile.id, buildReport(data, before));

    expect(created.results[0]).toMatchObject({ slug, outcome: "eligible", version: 1 });

    // The programme tightens: 36 months no longer qualifies.
    await sync.sync([fileWithMaxAge(slug, 24)]);
    const after = (await catalogue.listPublished()).filter((p) => p.slug === slug);
    expect(after[0]?.version).toBe(2);

    const reread = await reports.getReport(actor, created.id);
    expect(reread?.results[0]).toMatchObject({ slug, outcome: "eligible", version: 1 });
    expect(reread?.results[0]?.programVersionId).toBe(created.results[0]?.programVersionId);

    // A report run now sees the new rule, so the two disagree on purpose.
    const fresh = await reports.createReport(actor, profile.id, buildReport(data, after));
    expect(fresh.results[0]).toMatchObject({ slug, outcome: "ineligible", version: 2 });
  });
});
