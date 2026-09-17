"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  saveStep,
  submitWizard,
  type WizardActionResult,
} from "@/app/[locale]/eligibilite/actions";
import type { ProfileData, ProfileField } from "@/lib/engine";
import {
  optionsFor,
  pruneSkipped,
  resolveStepIndex,
  visibleSteps,
  type Question,
} from "@/lib/wizard";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { Button } from "../ui/button";
import { RadioCards } from "./radio-cards";
import { WizardStepper } from "./wizard-stepper";

/**
 * The five-step wizard (Story 3.4). Answers live in client state so steps change
 * instantly (UX §states); the step id is in the URL so Back, forward and refresh behave;
 * every step is also written to the anonymous profile so nothing is lost with the tab.
 */

const STORAGE_KEY = "da3m.wizard.answers";
const STEP_PARAM = "etape";

/**
 * Answers survive a closed tab, and a returning visitor resumes where they stopped.
 * Storage can be unavailable or full, which is not fatal: the profile row is the durable
 * copy and the wizard still works without it.
 */
function readStored(): ProfileData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProfileData) : {};
  } catch {
    return {};
  }
}

function store(answers: ProfileData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // Private mode or a full quota: the server copy is the durable one.
  }
}

type ErrorKey = "invalid" | "rateLimited" | "unexpected";

export function Wizard({ locale }: { locale: AppLocale }) {
  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();

  const [answers, setAnswers] = useState<ProfileData>({});
  const [error, setError] = useState<ErrorKey | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Restored after mount: the page is statically rendered, so the server has no answers.
  useEffect(() => setAnswers(readStored()), []);

  const steps = visibleSteps(answers);
  const index = resolveStepIndex(answers, params.get(STEP_PARAM) ?? undefined);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  function goTo(stepIndex: number) {
    const target = steps[stepIndex];
    if (!target) return;
    router.replace(`/eligibilite?${STEP_PARAM}=${target.id}`, { scroll: false });
  }

  function answer(field: ProfileField, value: unknown) {
    setAnswers((previous) => {
      // Values come from FIELD_SPECS, and the server revalidates with Zod before saving.
      const next = { ...previous, [field]: value } as ProfileData;
      if (value === undefined) delete next[field];
      const pruned = pruneSkipped(next);
      store(pruned);
      return pruned;
    });
    setError(null);
  }

  function handleResult(result: WizardActionResult) {
    if (!result.ok) setError(result.error === "rate_limited" ? "rateLimited" : "invalid");
  }

  function next() {
    // Saved in the background: a slow write must not hold up the next question.
    void saveStep(answers).catch(() => undefined);
    goTo(index + 1);
  }

  function submit() {
    setError(null);
    startSubmit(async () => {
      try {
        // A successful submit redirects, so only failures return.
        handleResult(await submitWizard(locale, answers));
      } catch (cause) {
        // Next signals the redirect by throwing; anything else is a real failure.
        if (cause instanceof Error && cause.message.includes("NEXT_REDIRECT")) throw cause;
        setError("unexpected");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <WizardStepper
        label={t("stepperLabel")}
        current={index + 1}
        total={steps.length}
        progressText={t("progress", { current: index + 1, total: steps.length })}
      />

      <div key={step.id} className="flex flex-col gap-8">
        <h2 className="sr-only">{t(`steps.${step.id}`)}</h2>
        {step.questions.map((question) => (
          <QuestionField
            key={question.field}
            question={question}
            value={answers[question.field]}
            onAnswer={answer}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-error px-4 py-3 text-sm text-error">
          {t(`errors.${error}`)}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
          {t("back")}
        </Button>
        {isLast ? (
          <Button size="lg" onClick={submit} disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        ) : (
          <Button size="lg" onClick={next}>
            {t("next")}
          </Button>
        )}
      </div>

      <p className="text-xs text-text-muted">{tCommon("nonAffiliation")}</p>
    </div>
  );
}

type QuestionProps = {
  question: Question;
  value: unknown;
  onAnswer: (field: ProfileField, value: unknown) => void;
};

function QuestionField({ question, value, onAnswer }: QuestionProps) {
  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const { field } = question;
  const legend = t(`fields.${field}.label`);
  const help = t(`fields.${field}.help`);

  const clear =
    value === undefined ? null : (
      <Button variant="ghost" onClick={() => onAnswer(field, undefined)}>
        {t("skip")}
      </Button>
    );

  if (question.kind === "months") {
    return (
      <div>
        <label htmlFor={field} className="block text-lg font-semibold text-text">
          {legend}
        </label>
        <p id={`${field}-help`} className="mt-1 text-sm text-text-muted">
          {help}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input
            id={field}
            name={field}
            type="number"
            inputMode="numeric"
            min={0}
            max={question.max}
            value={typeof value === "number" ? value : ""}
            aria-describedby={`${field}-help`}
            onChange={(event) => {
              const raw = event.target.valueAsNumber;
              onAnswer(field, Number.isFinite(raw) ? Math.trunc(raw) : undefined);
            }}
            className="min-h-13 w-32 rounded-md border border-border bg-surface px-4 text-base text-text"
          />
          <span className="text-base text-text-muted">{t("monthsSuffix")}</span>
        </div>
      </div>
    );
  }

  if (question.kind === "boolean") {
    return (
      <RadioCards
        name={field}
        legend={legend}
        help={help}
        options={[
          { value: "true", label: tCommon("yes") },
          { value: "false", label: tCommon("no") },
        ]}
        value={typeof value === "boolean" ? String(value) : undefined}
        onChange={(picked) => onAnswer(field, picked === "true")}
        footer={clear}
      />
    );
  }

  return (
    <RadioCards
      name={field}
      legend={legend}
      help={help}
      multiple={question.multiple}
      options={optionsFor(field).map((option) => ({
        value: option,
        label: t(`options.${field}.${option}`),
      }))}
      value={Array.isArray(value) || typeof value === "string" ? value : undefined}
      onChange={(picked) => onAnswer(field, picked)}
      footer={clear}
    />
  );
}
