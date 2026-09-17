import { z } from "zod";
import { FIELD_SPECS, isProfileField, type FieldSpec, type ProfileField } from "./profile-schema";

/** Rule DSL (ADR-2). Rules are stored as JSON in program_versions.rules. */

export const RULE_MAX_DEPTH = 10;

export const OPERATORS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "gte",
  "lte",
  "between",
  "is_true",
  "is_false",
] as const;
export type Operator = (typeof OPERATORS)[number];

export const i18nTextSchema = z.object({
  fr: z.string().trim().min(1),
  ar: z.string().trim().min(1).optional(),
  en: z.string().trim().min(1).optional(),
});
export type I18nText = z.infer<typeof i18nTextSchema>;

export type Criterion = {
  kind: "criterion";
  id: string;
  field: ProfileField;
  op: Operator;
  value?: unknown;
  reason: I18nText;
};

export type Rule =
  | { kind: "all"; rules: Rule[] }
  | { kind: "any"; rules: Rule[] }
  /** A negated group needs its own id and reason: its children's reasons describe the opposite. */
  | { kind: "not"; id: string; rule: Rule; reason: I18nText }
  | Criterion;

export type RuleIssue = { path: string; message: string };

// ---------- structural parsing ----------

type RawRule =
  | { kind: "all"; rules: RawRule[] }
  | { kind: "any"; rules: RawRule[] }
  | { kind: "not"; id: string; rule: RawRule; reason: I18nText }
  | {
      kind: "criterion";
      id: string;
      field: string;
      op: Operator;
      value?: unknown;
      reason: I18nText;
    };

const idSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "Use lowercase letters, digits, - or _ (max 64)");

const rawRuleSchema: z.ZodType<RawRule> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("all"), rules: z.array(rawRuleSchema) }),
    z.object({ kind: z.literal("any"), rules: z.array(rawRuleSchema) }),
    z.object({
      kind: z.literal("not"),
      id: idSchema,
      rule: rawRuleSchema,
      reason: i18nTextSchema,
    }),
    z.object({
      kind: z.literal("criterion"),
      id: idSchema,
      field: z.string(),
      op: z.enum(OPERATORS),
      value: z.unknown().optional(),
      reason: i18nTextSchema,
    }),
  ]),
);

/** Depth of an arbitrary JSON value, stopping as soon as it exceeds the limit. */
function exceedsDepth(value: unknown, limit: number): boolean {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (node === null || typeof node !== "object") continue;
    const obj = node as { kind?: unknown; rules?: unknown; rule?: unknown };
    const children = Array.isArray(obj.rules)
      ? obj.rules
      : obj.rule !== undefined
        ? [obj.rule]
        : [];
    if (children.length > 0 && depth + 1 > limit) return true;
    for (const child of children) stack.push({ node: child, depth: depth + 1 });
  }
  return false;
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (acc, key) => (typeof key === "number" ? `${acc}[${key}]` : `${acc}.${String(key)}`),
    "rules",
  );
}

// ---------- semantic validation ----------

function isNonEmptyUniqueArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length;
}

function isIntegerIn(spec: { min: number; max: number }, value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= spec.min && (value as number) <= spec.max;
}

const OPERATORS_BY_KIND: Record<FieldSpec["kind"], readonly Operator[]> = {
  boolean: ["is_true", "is_false"],
  enum: ["eq", "neq", "in", "not_in"],
  integer: ["eq", "neq", "in", "not_in", "gte", "lte", "between"],
  enum_set: ["in", "not_in"],
};

/** Returns a problem description, or null when the value fits the field and operator. */
function checkValue(spec: FieldSpec, op: Operator, value: unknown): string | null {
  switch (spec.kind) {
    case "boolean":
      return value === undefined ? null : `"${op}" takes no value`;
    case "enum":
    case "enum_set": {
      const allowed = (v: unknown) => typeof v === "string" && spec.values.includes(v);
      if (op === "eq" || op === "neq") {
        return allowed(value) ? null : `Value must be one of: ${spec.values.join(", ")}`;
      }
      return isNonEmptyUniqueArray(value) && value.every(allowed)
        ? null
        : `Value must be a non-empty list of distinct values from: ${spec.values.join(", ")}`;
    }
    case "integer": {
      const range = `${spec.min}–${spec.max}`;
      if (op === "between") {
        return Array.isArray(value) &&
          value.length === 2 &&
          isIntegerIn(spec, value[0]) &&
          isIntegerIn(spec, value[1]) &&
          value[0] <= value[1]
          ? null
          : `Value must be [min, max] integers within ${range}, with min ≤ max`;
      }
      if (op === "in" || op === "not_in") {
        return isNonEmptyUniqueArray(value) && value.every((v) => isIntegerIn(spec, v))
          ? null
          : `Value must be a non-empty list of distinct integers within ${range}`;
      }
      return isIntegerIn(spec, value) ? null : `Value must be an integer within ${range}`;
    }
  }
}

function validateSemantics(rule: RawRule, path: string, ids: Set<string>, issues: RuleIssue[]) {
  const claimId = (id: string) => {
    if (ids.has(id)) issues.push({ path, message: `Duplicate id "${id}"` });
    ids.add(id);
  };

  switch (rule.kind) {
    case "all":
    case "any":
      if (rule.rules.length === 0) {
        issues.push({ path, message: `"${rule.kind}" needs at least one rule` });
      }
      rule.rules.forEach((child, i) =>
        validateSemantics(child, `${path}.rules[${i}]`, ids, issues),
      );
      return;
    case "not":
      claimId(rule.id);
      validateSemantics(rule.rule, `${path}.rule`, ids, issues);
      return;
    case "criterion": {
      claimId(rule.id);
      if (!isProfileField(rule.field)) {
        issues.push({ path, message: `Unknown profile field "${rule.field}"` });
        return;
      }
      const spec: FieldSpec = FIELD_SPECS[rule.field];
      if (!OPERATORS_BY_KIND[spec.kind].includes(rule.op)) {
        issues.push({
          path,
          message: `Operator "${rule.op}" is not valid for ${spec.kind} field "${rule.field}"`,
        });
        return;
      }
      const problem = checkValue(spec, rule.op, rule.value);
      if (problem) issues.push({ path, message: `${rule.field}: ${problem}` });
    }
  }
}

export type ParseRulesResult = { ok: true; rules: Rule } | { ok: false; issues: RuleIssue[] };

/** Parses untrusted JSON into a validated rule tree, reporting every problem found. */
export function parseRules(input: unknown): ParseRulesResult {
  if (exceedsDepth(input, RULE_MAX_DEPTH)) {
    return {
      ok: false,
      issues: [{ path: "rules", message: `Rule tree is deeper than ${RULE_MAX_DEPTH} levels` }],
    };
  }

  const parsed = rawRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    };
  }

  const issues: RuleIssue[] = [];
  validateSemantics(parsed.data, "rules", new Set(), issues);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, rules: parsed.data as Rule };
}

/** Every profile field a rule tree depends on, in first-seen order. */
export function referencedFields(rule: Rule): ProfileField[] {
  const seen = new Set<ProfileField>();
  const visit = (node: Rule) => {
    if (node.kind === "criterion") seen.add(node.field);
    else if (node.kind === "not") visit(node.rule);
    else node.rules.forEach(visit);
  };
  visit(rule);
  return [...seen];
}

/** Every reason text in a tree, for translation-completeness checks at publish time. */
export function collectReasons(rule: Rule): { id: string; reason: I18nText }[] {
  if (rule.kind === "criterion") return [{ id: rule.id, reason: rule.reason }];
  if (rule.kind === "not")
    return [{ id: rule.id, reason: rule.reason }, ...collectReasons(rule.rule)];
  return rule.rules.flatMap(collectReasons);
}
