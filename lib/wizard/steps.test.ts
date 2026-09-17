import { describe, expect, it } from "vitest";
import fr from "@/messages/fr.json";
import { FIELD_SPECS, isProfileField, type ProfileData } from "@/lib/engine";
import {
  fieldsOf,
  optionsFor,
  pruneSkipped,
  resolveStepIndex,
  STEP_IDS,
  visibleSteps,
  WIZARD_STEPS,
} from "./steps";

const IDEA: ProfileData = { legal_form: "none" };
const REGISTERED: ProfileData = { legal_form: "sarl" };

describe("wizard shape", () => {
  it("asks five steps, in the order the UX flow defines", () => {
    expect(STEP_IDS).toEqual(["situation", "project", "you", "size", "need"]);
  });

  it("only asks about fields the profile contract declares", () => {
    const fields = WIZARD_STEPS.flatMap(fieldsOf);
    expect(fields.every(isProfileField)).toBe(true);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("matches each question kind to the field it collects", () => {
    for (const step of WIZARD_STEPS) {
      for (const question of step.questions) {
        const spec = FIELD_SPECS[question.field];
        const expected =
          spec.kind === "boolean" ? "boolean" : spec.kind === "integer" ? "months" : "choice";
        expect([question.field, question.kind]).toEqual([question.field, expected]);
      }
    }
  });

  it("asks for several answers only where the field holds a set", () => {
    for (const step of WIZARD_STEPS) {
      for (const question of step.questions) {
        const multiple = question.kind === "choice" && question.multiple === true;
        expect([question.field, multiple]).toEqual([
          question.field,
          FIELD_SPECS[question.field].kind === "enum_set",
        ]);
      }
    }
  });
});

describe("adaptive steps", () => {
  it("skips the company step for a project that does not exist yet", () => {
    expect(visibleSteps(IDEA).map((s) => s.id)).toEqual(["situation", "project", "you", "need"]);
  });

  it("asks every step once a company is registered", () => {
    expect(visibleSteps(REGISTERED).map((s) => s.id)).toEqual(STEP_IDS);
  });

  it("asks every step before the situation is known", () => {
    expect(visibleSteps({}).map((s) => s.id)).toEqual(STEP_IDS);
  });
});

describe("pruneSkipped", () => {
  it("drops answers to a step that no longer applies", () => {
    const answers: ProfileData = {
      legal_form: "none",
      company_age_months: 12,
      employees_band: "1_9",
      revenue_band: "lt_1m",
      sector: "digital",
    };

    expect(pruneSkipped(answers)).toEqual({ legal_form: "none", sector: "digital" });
  });

  it("leaves a profile alone when every step applies", () => {
    const answers: ProfileData = { legal_form: "sarl", company_age_months: 12 };
    expect(pruneSkipped(answers)).toEqual(answers);
  });

  it("does not mutate what it is given", () => {
    const answers: ProfileData = { legal_form: "none", company_age_months: 12 };
    pruneSkipped(answers);
    expect(answers.company_age_months).toBe(12);
  });
});

describe("resolveStepIndex", () => {
  it("finds a step by its id", () => {
    expect(resolveStepIndex(REGISTERED, "you")).toBe(2);
  });

  it("resumes at the first step for an unknown id", () => {
    expect(resolveStepIndex(REGISTERED, "nonsense")).toBe(0);
    expect(resolveStepIndex(REGISTERED, undefined)).toBe(0);
  });

  it("resumes at the first step when the bookmarked step is now skipped", () => {
    expect(resolveStepIndex(IDEA, "size")).toBe(0);
  });

  it("counts positions among visible steps only", () => {
    expect(resolveStepIndex(IDEA, "need")).toBe(3);
    expect(resolveStepIndex(REGISTERED, "need")).toBe(4);
  });
});

describe("optionsFor", () => {
  it("offers exactly the values the contract allows", () => {
    expect(optionsFor("legal_form")).toEqual(FIELD_SPECS.legal_form.values);
    expect(optionsFor("need_purposes")).toEqual(FIELD_SPECS.need_purposes.values);
  });

  it("offers no options for fields that are not a choice", () => {
    expect(optionsFor("company_age_months")).toEqual([]);
    expect(optionsFor("is_mre")).toEqual([]);
  });
});

describe("copy", () => {
  const wizard = fr.wizard as unknown as {
    steps: Record<string, string>;
    fields: Record<string, { label: string; help: string }>;
    options: Record<string, Record<string, string>>;
  };

  it("has a title for every step", () => {
    for (const id of STEP_IDS) expect(wizard.steps[id]).toBeTruthy();
  });

  it("has a label and help text for every question", () => {
    for (const step of WIZARD_STEPS) {
      for (const field of fieldsOf(step)) {
        expect([field, Boolean(wizard.fields[field]?.label)]).toEqual([field, true]);
        expect([field, Boolean(wizard.fields[field]?.help)]).toEqual([field, true]);
      }
    }
  });

  it("has a label for every option a question offers", () => {
    for (const step of WIZARD_STEPS) {
      for (const field of fieldsOf(step)) {
        for (const option of optionsFor(field)) {
          expect([field, option, Boolean(wizard.options[field]?.[option])]).toEqual([
            field,
            option,
            true,
          ]);
        }
      }
    }
  });
});
