import type { ProfileData, ProfileField } from "./profile-schema";
import type { Criterion, I18nText, Rule } from "./rules";

/**
 * The eligibility engine (ADR-3). Pure: no I/O, no clock, no randomness.
 * Missing profile data yields "unknown", never "fail".
 */

export const ENGINE_VERSION = "1.0.0";

export type TriState = "pass" | "fail" | "unknown";

export type FailedCheck = { id: string; reason: I18nText };

export type RuleResult = {
  value: TriState;
  /** Checks that failed. Populated only when value is "fail". */
  failing: FailedCheck[];
  /** Profile fields whose absence prevents a decision. Populated only when value is "unknown". */
  missing: ProfileField[];
};

export type ProgramOutcome = "eligible" | "needs_info" | "ineligible";

export type ProgramEvaluation = {
  outcome: ProgramOutcome;
  failing: FailedCheck[];
  missing: ProfileField[];
};

const PASS: RuleResult = { value: "pass", failing: [], missing: [] };

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function matches(criterion: Criterion, actual: unknown): boolean {
  const expected = criterion.value;
  switch (criterion.op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
    case "not_in": {
      const list = expected as unknown[];
      // For multi-value fields "in" means "shares at least one value" (ADR-2).
      const hit = Array.isArray(actual)
        ? actual.some((v) => list.includes(v))
        : list.includes(actual);
      return criterion.op === "in" ? hit : !hit;
    }
    case "gte":
      return (actual as number) >= (expected as number);
    case "lte":
      return (actual as number) <= (expected as number);
    case "between": {
      const [min, max] = expected as [number, number];
      return (actual as number) >= min && (actual as number) <= max;
    }
    case "is_true":
      return actual === true;
    case "is_false":
      return actual === false;
  }
}

/** Evaluates a validated rule tree against a validated profile. */
export function evaluateRule(rule: Rule, profile: ProfileData): RuleResult {
  switch (rule.kind) {
    case "criterion": {
      const actual = profile[rule.field];
      if (actual === undefined || actual === null) {
        return { value: "unknown", failing: [], missing: [rule.field] };
      }
      return matches(rule, actual)
        ? PASS
        : { value: "fail", failing: [{ id: rule.id, reason: rule.reason }], missing: [] };
    }

    case "not": {
      const inner = evaluateRule(rule.rule, profile);
      if (inner.value === "pass") {
        return { value: "fail", failing: [{ id: rule.id, reason: rule.reason }], missing: [] };
      }
      if (inner.value === "fail") return PASS;
      return inner;
    }

    case "all": {
      const results = rule.rules.map((child) => evaluateRule(child, profile));
      const failed = results.filter((r) => r.value === "fail");
      if (failed.length > 0) {
        return { value: "fail", failing: failed.flatMap((r) => r.failing), missing: [] };
      }
      const unknown = results.filter((r) => r.value === "unknown");
      if (unknown.length > 0) {
        return {
          value: "unknown",
          failing: [],
          missing: unique(unknown.flatMap((r) => r.missing)),
        };
      }
      return PASS;
    }

    case "any": {
      const results = rule.rules.map((child) => evaluateRule(child, profile));
      if (results.some((r) => r.value === "pass")) return PASS;
      const unknown = results.filter((r) => r.value === "unknown");
      if (unknown.length > 0) {
        return {
          value: "unknown",
          failing: [],
          missing: unique(unknown.flatMap((r) => r.missing)),
        };
      }
      return { value: "fail", failing: results.flatMap((r) => r.failing), missing: [] };
    }
  }
}

const OUTCOME: Record<TriState, ProgramOutcome> = {
  pass: "eligible",
  unknown: "needs_info",
  fail: "ineligible",
};

export function evaluateProgram(rules: Rule, profile: ProfileData): ProgramEvaluation {
  const result = evaluateRule(rules, profile);
  return { outcome: OUTCOME[result.value], failing: result.failing, missing: result.missing };
}

export type CatalogEntry = { programId: string; programVersionId: string; rules: Rule };

export type CatalogResult = ProgramEvaluation & { programId: string; programVersionId: string };

/** Runs one profile against every published programme. Same inputs, same output. */
export function evaluateCatalog(profile: ProfileData, catalog: CatalogEntry[]): CatalogResult[] {
  return catalog.map((entry) => ({
    programId: entry.programId,
    programVersionId: entry.programVersionId,
    ...evaluateProgram(entry.rules, profile),
  }));
}
