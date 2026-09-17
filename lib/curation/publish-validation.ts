import { z } from "zod";
import {
  collectReasons,
  evaluateProgram,
  parseRules,
  profileDataSchema,
  type ProfileField,
  type ProgramOutcome,
  type Rule,
  type RuleIssue,
} from "@/lib/engine";

/**
 * What must be true before a programme version can be published (Story 2.2, FR-11).
 * Drafts may be incomplete; publishing may not. Storage-agnostic: takes plain values.
 */

const trilingual = z.object({
  fr: z.string().trim().min(1),
  ar: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const localisedContent = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
});

export const publishableContentSchema = z.object({
  fr: localisedContent,
  ar: localisedContent,
  en: localisedContent,
});
export type PublishableContent = z.infer<typeof publishableContentSchema>;

export const documentsSchema = z
  .array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/), label: trilingual }))
  .refine((docs) => new Set(docs.map((d) => d.id)).size === docs.length, "Duplicate document ids");
export type ProgramDocuments = z.infer<typeof documentsSchema>;

const httpsUrl = z.url({ protocol: /^https$/ });
const isoDate = z.iso.date();

export type VersionDraft = {
  status: "open" | "closed" | "upcoming" | "rolling";
  opensAt: string | null;
  closesAt: string | null;
  amountMinMad: number | null;
  amountMaxMad: number | null;
  rules: unknown;
  documents: unknown;
  content: unknown;
  sourceUrl: string;
  applicationUrl: string | null;
  verifiedAt: string;
};

export type PublishValidation =
  | { ok: true; rules: Rule; content: PublishableContent; documents: ProgramDocuments }
  | { ok: false; issues: RuleIssue[] };

function zodIssues(prefix: string, error: z.ZodError): RuleIssue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].join("."),
    message: issue.message,
  }));
}

export function validateForPublish(draft: VersionDraft, today: string): PublishValidation {
  const issues: RuleIssue[] = [];

  const rules = parseRules(draft.rules);
  if (!rules.ok) issues.push(...rules.issues);
  else {
    for (const { id, reason } of collectReasons(rules.rules)) {
      for (const locale of ["ar", "en"] as const) {
        if (!reason[locale]?.trim()) {
          issues.push({
            path: `rules#${id}.reason.${locale}`,
            message: `Missing ${locale} reason for "${id}"`,
          });
        }
      }
    }
  }

  const content = publishableContentSchema.safeParse(draft.content);
  if (!content.success) issues.push(...zodIssues("content", content.error));

  const documents = documentsSchema.safeParse(draft.documents);
  if (!documents.success) issues.push(...zodIssues("documents", documents.error));

  if (!httpsUrl.safeParse(draft.sourceUrl).success) {
    issues.push({
      path: "sourceUrl",
      message: "Source URL must be an https URL of the operator's official page",
    });
  }
  if (draft.applicationUrl !== null && !httpsUrl.safeParse(draft.applicationUrl).success) {
    issues.push({ path: "applicationUrl", message: "Application URL must be https" });
  }

  if (!isoDate.safeParse(draft.verifiedAt).success) {
    issues.push({ path: "verifiedAt", message: "Verification date must be YYYY-MM-DD" });
  } else if (draft.verifiedAt > today) {
    issues.push({ path: "verifiedAt", message: "Verification date cannot be in the future" });
  }

  for (const key of ["opensAt", "closesAt"] as const) {
    const value = draft[key];
    if (value !== null && !isoDate.safeParse(value).success) {
      issues.push({ path: key, message: "Date must be YYYY-MM-DD" });
    }
  }
  if (draft.opensAt && draft.closesAt && draft.opensAt > draft.closesAt) {
    issues.push({ path: "closesAt", message: "Closing date is before opening date" });
  }
  if (draft.status === "upcoming" && !draft.opensAt) {
    issues.push({ path: "opensAt", message: "An upcoming programme needs an opening date" });
  }

  for (const key of ["amountMinMad", "amountMaxMad"] as const) {
    const value = draft[key];
    if (value !== null && !(Number.isFinite(value) && value >= 0)) {
      issues.push({ path: key, message: "Amount must be a non-negative number" });
    }
  }
  if (
    draft.amountMinMad !== null &&
    draft.amountMaxMad !== null &&
    draft.amountMinMad > draft.amountMaxMad
  ) {
    issues.push({ path: "amountMaxMad", message: "Maximum amount is below the minimum" });
  }

  if (issues.length > 0 || !rules.ok || !content.success || !documents.success) {
    return { ok: false, issues };
  }
  return { ok: true, rules: rules.rules, content: content.data, documents: documents.data };
}

// ---------- golden profiles (test strategy §5) ----------

export const goldenProfileSchema = z.object({
  name: z.string().min(1),
  profile: profileDataSchema.strict(),
  expected: z.enum(["eligible", "needs_info", "ineligible"]),
  /** When set, these exact criterion ids must be the ones failing. */
  expectedFailing: z.array(z.string()).optional(),
  /** When set, these exact fields must be the ones missing. */
  expectedMissing: z.array(z.string()).optional(),
});
export type GoldenProfile = z.infer<typeof goldenProfileSchema>;

export type GoldenMismatch = { name: string; problem: string };

export function checkGoldenProfiles(rules: Rule, goldens: GoldenProfile[]): GoldenMismatch[] {
  const mismatches: GoldenMismatch[] = [];
  for (const golden of goldens) {
    const result = evaluateProgram(rules, golden.profile);
    if (result.outcome !== golden.expected) {
      mismatches.push({
        name: golden.name,
        problem: `expected ${golden.expected}, got ${result.outcome}`,
      });
      continue;
    }
    const sameSet = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x) => b.includes(x));
    if (
      golden.expectedFailing &&
      !sameSet(
        result.failing.map((f) => f.id),
        golden.expectedFailing,
      )
    ) {
      mismatches.push({
        name: golden.name,
        problem: `expected failing [${golden.expectedFailing.join(", ")}], got [${result.failing.map((f) => f.id).join(", ")}]`,
      });
    }
    if (golden.expectedMissing && !sameSet(result.missing, golden.expectedMissing)) {
      mismatches.push({
        name: golden.name,
        problem: `expected missing [${golden.expectedMissing.join(", ")}], got [${result.missing.join(", ")}]`,
      });
    }
  }
  return mismatches;
}

export type PreviewRow = {
  name: string;
  before: ProgramOutcome | null;
  after: ProgramOutcome;
  changed: boolean;
  missing: ProfileField[];
};

/** What publishing a draft would change for each test profile (RuleDiffPreview). */
export function previewRuleChange(
  current: Rule | null,
  draft: Rule,
  goldens: GoldenProfile[],
): PreviewRow[] {
  return goldens.map((golden) => {
    const before = current ? evaluateProgram(current, golden.profile).outcome : null;
    const after = evaluateProgram(draft, golden.profile);
    return {
      name: golden.name,
      before,
      after: after.outcome,
      changed: before !== after.outcome,
      missing: after.missing,
    };
  });
}
