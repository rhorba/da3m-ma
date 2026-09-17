import { FIELD_SPECS, type ProfileData, type ProfileField } from "@/lib/engine";

/**
 * The five wizard steps (UX flow §2). Deliberately short: the engine answers
 * "needs_info" rather than guessing, and the results page asks for whatever else a
 * specific programme needs (Story 3.5). Adding a field here makes the wizard longer for
 * everyone, so a field earns its place only if most programmes reference it.
 *
 * Every question names a field from FIELD_SPECS; parity is asserted at compile time
 * below and in steps.test.ts, so a renamed field breaks the build rather than the form.
 */

export type Question =
  | { field: ProfileField; kind: "choice"; multiple?: false }
  | { field: ProfileField; kind: "choice"; multiple: true }
  | { field: ProfileField; kind: "boolean" }
  | { field: ProfileField; kind: "months"; max: number };

export type WizardStep = {
  id: string;
  questions: Question[];
  /** Steps that make no sense for the answers given so far are skipped entirely. */
  skipWhen?: (profile: ProfileData) => boolean;
};

/** A project that does not exist yet has no age, headcount or revenue (UX flow §2). */
const NOT_REGISTERED_YET = (profile: ProfileData) => profile.legal_form === "none";

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "situation",
    questions: [{ field: "legal_form", kind: "choice" }],
  },
  {
    id: "project",
    questions: [
      { field: "sector", kind: "choice" },
      { field: "region", kind: "choice" },
    ],
  },
  {
    id: "you",
    questions: [
      { field: "founder_age_band", kind: "choice" },
      { field: "is_mre", kind: "boolean" },
    ],
  },
  {
    id: "size",
    skipWhen: NOT_REGISTERED_YET,
    questions: [
      { field: "company_age_months", kind: "months", max: 1200 },
      { field: "employees_band", kind: "choice" },
      { field: "revenue_band", kind: "choice" },
    ],
  },
  {
    id: "need",
    questions: [
      { field: "need_amount_band", kind: "choice" },
      { field: "need_purposes", kind: "choice", multiple: true },
    ],
  },
];

export const STEP_IDS = WIZARD_STEPS.map((step) => step.id);

/** The fields this step collects; used to clear answers when a step becomes skipped. */
export function fieldsOf(step: WizardStep): ProfileField[] {
  return step.questions.map((q) => q.field);
}

/** The steps this profile actually has to answer, in order. */
export function visibleSteps(profile: ProfileData): WizardStep[] {
  return WIZARD_STEPS.filter((step) => !step.skipWhen?.(profile));
}

/**
 * Where a visitor lands for a given step id, clamped into the steps they can see.
 * An unknown or skipped id resolves to the first step rather than 404ing: a stale
 * bookmark should resume the wizard, not break it.
 */
export function resolveStepIndex(profile: ProfileData, stepId: string | undefined): number {
  const steps = visibleSteps(profile);
  const index = steps.findIndex((step) => step.id === stepId);
  return index === -1 ? 0 : index;
}

/**
 * Drops answers belonging to steps the profile no longer sees. Without this, someone who
 * fills in the company step and then goes back to say "not registered yet" would still be
 * evaluated against a headcount they no longer claim.
 */
export function pruneSkipped(profile: ProfileData): ProfileData {
  const pruned: ProfileData = { ...profile };
  for (const step of WIZARD_STEPS) {
    if (!step.skipWhen?.(profile)) continue;
    for (const field of fieldsOf(step)) delete pruned[field];
  }
  return pruned;
}

/** The options a choice question offers, straight from the profile contract. */
export function optionsFor(field: ProfileField): readonly string[] {
  const spec = FIELD_SPECS[field];
  return spec.kind === "enum" || spec.kind === "enum_set" ? spec.values : [];
}

// Compile-time proof that every question names a real profile field.
type QuestionField = (typeof WIZARD_STEPS)[number]["questions"][number]["field"];
type FieldsAreReal = Exclude<QuestionField, ProfileField> extends never ? true : never;
export const WIZARD_FIELDS_ARE_REAL: FieldsAreReal = true;
