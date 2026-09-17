"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { answerQuestion } from "@/app/[locale]/resultats/actions";
import { FIELD_SPECS, type ProfileField } from "@/lib/engine";
import { optionsFor } from "@/lib/wizard";
import { useRouter } from "@/i18n/navigation";
import { RadioCards } from "../wizard/radio-cards";

/**
 * One question asked where the answer matters (Story 3.5). Answering writes a new
 * report and swaps this page to it — same screen, no navigation away, the card simply
 * moves into its new group.
 */
export function InlineQuestion({ reportId, field }: { reportId: string; field: ProfileField }) {
  const t = useTranslations("wizard");
  const tResults = useTranslations("results");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const spec = FIELD_SPECS[field];
  const options =
    spec.kind === "boolean"
      ? [
          { value: "true", label: tCommon("yes") },
          { value: "false", label: tCommon("no") },
        ]
      : optionsFor(field).map((option) => ({
          value: option,
          label: t(`options.${field}.${option}`),
        }));

  // An integer field has no options to offer inline; the wizard is where it is asked.
  if (options.length === 0) return null;

  function submit(choice: string | string[] | undefined) {
    if (typeof choice !== "string") return;
    const value = spec.kind === "boolean" ? choice === "true" : choice;

    // Shown as chosen straight away; the new report replaces this card a moment later.
    setPicked(choice);
    setFailed(false);
    startTransition(async () => {
      const result = await answerQuestion(reportId, field, value);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.replace(`/resultats/${result.reportId}`, { scroll: false });
    });
  }

  return (
    <div className="mt-4 rounded-md border border-accent bg-accent/10 p-4">
      <RadioCards
        name={`${reportId}-${field}`}
        legend={t(`fields.${field}.label`)}
        help={tResults("answerToKnow")}
        options={options}
        value={picked}
        onChange={submit}
      />
      {pending ? (
        <p className="mt-2 text-sm text-text-muted" aria-live="polite">
          {tResults("answering")}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {tResults("answerFailed")}
        </p>
      ) : null}
    </div>
  );
}
