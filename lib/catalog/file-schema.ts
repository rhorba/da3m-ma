import { z } from "zod";
import {
  checkGoldenProfiles,
  checkUrl,
  goldenProfileSchema,
  validateForPublish,
} from "@/lib/curation";
import type { Rule, RuleIssue } from "@/lib/engine";

/**
 * A programme as curated in git: data/programs/<slug>.json (ADR-8). The file carries
 * everything needed to publish a version, where every criterion came from, who
 * verified it, and the golden profiles that pin its behaviour in CI.
 */

const httpsUrl = z.url({ protocol: /^https$/ });
const isoDate = z.iso.date();

export const catalogueFileSchema = z
  .object({
    $schema: z.string().optional(),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use kebab-case"),
    operator: z.string().trim().min(1),
    kind: z.enum(["grant", "loan", "guarantee", "equity", "advance", "support"]),
    verification: z
      .object({
        status: z.enum(["draft", "verified"]),
        verifiedAt: isoDate.nullable(),
        verifiedBy: z.string().trim().min(1).nullable(),
        notes: z.string().optional(),
      })
      .strict()
      .refine(
        (v) => v.status === "draft" || (v.verifiedAt !== null && v.verifiedBy !== null),
        "A verified programme needs verifiedAt and verifiedBy",
      ),
    /** The official pages the criteria were taken from (Story 2.5: operator sources only). */
    sources: z
      .array(
        z.object({ url: httpsUrl, consultedAt: isoDate, note: z.string().optional() }).strict(),
      )
      .min(1),
    version: z
      .object({
        status: z.enum(["open", "closed", "upcoming", "rolling"]),
        opensAt: isoDate.nullable(),
        closesAt: isoDate.nullable(),
        amountMinMad: z.number().nonnegative().nullable(),
        amountMaxMad: z.number().nonnegative().nullable(),
        sourceUrl: z.string(),
        applicationUrl: z.string().nullable(),
        rules: z.unknown(),
        documents: z.unknown(),
        content: z.unknown(),
      })
      .strict(),
    watches: z.array(
      z.object({ url: httpsUrl, cssSelector: z.string().min(1).nullable() }).strict(),
    ),
    goldenProfiles: z.array(goldenProfileSchema).min(3),
  })
  .strict();

export type CatalogueFile = z.infer<typeof catalogueFileSchema>;

export type ValidCatalogueFile = CatalogueFile & { parsedRules: Rule };

export type CatalogueValidation =
  { ok: true; file: ValidCatalogueFile } | { ok: false; issues: RuleIssue[] };

export function validateCatalogueFile(
  raw: unknown,
  options: { fileName: string; today: string; allowedHosts: ReadonlySet<string> },
): CatalogueValidation {
  const parsed = catalogueFileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.map(String).join(".") || "(file)",
        message: i.message,
      })),
    };
  }
  const file = parsed.data;
  const issues: RuleIssue[] = [];

  if (options.fileName !== `${file.slug}.json`) {
    issues.push({ path: "slug", message: `File name must be ${file.slug}.json` });
  }

  // Drafts are validated as if verified today, so a draft is always one sign-off from publishable.
  const publish = validateForPublish(
    { ...file.version, verifiedAt: file.verification.verifiedAt ?? options.today },
    options.today,
  );
  if (!publish.ok) issues.push(...publish.issues.map((i) => ({ ...i, path: `version.${i.path}` })));

  const outcomes = new Set(file.goldenProfiles.map((g) => g.expected));
  for (const outcome of ["eligible", "ineligible", "needs_info"] as const) {
    if (!outcomes.has(outcome)) {
      issues.push({
        path: "goldenProfiles",
        message: `Needs at least one golden profile expecting ${outcome}`,
      });
    }
  }
  const names = file.goldenProfiles.map((g) => g.name);
  if (new Set(names).size !== names.length) {
    issues.push({ path: "goldenProfiles", message: "Golden profile names must be unique" });
  }

  if (publish.ok) {
    for (const mismatch of checkGoldenProfiles(publish.rules, file.goldenProfiles)) {
      issues.push({ path: `goldenProfiles[${mismatch.name}]`, message: mismatch.problem });
    }
  }

  file.watches.forEach((watch, i) => {
    const guard = checkUrl(watch.url, options.allowedHosts);
    if (!guard.ok) issues.push({ path: `watches.${i}.url`, message: guard.reason });
  });
  if (!file.sources.some((s) => s.url === file.version.sourceUrl)) {
    issues.push({
      path: "version.sourceUrl",
      message: "sourceUrl must be one of the listed sources",
    });
  }

  if (issues.length > 0 || !publish.ok) return { ok: false, issues };
  return { ok: true, file: { ...file, parsedRules: publish.rules } };
}
