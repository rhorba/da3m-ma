import { collectReasons, type Rule } from "@/lib/engine";
import type { AppLocale } from "@/i18n/routing";

/**
 * "Who can benefit", built from the rule tree rather than written separately.
 *
 * Every criterion already carries a trilingual `reason` that a curator took from the
 * operator's own page and that CI pins with golden profiles, so the page cannot drift
 * from what the engine actually decides (ADR-8). It reads as a flat list on purpose:
 * the nesting is how the engine combines them, not something an applicant needs.
 */

type Props = {
  rules: Rule;
  locale: AppLocale;
  heading: string;
  hint?: string;
};

export function CriteriaList({ rules, locale, heading, hint }: Props) {
  const reasons = collectReasons(rules);
  if (reasons.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-text">{heading}</h2>
      {hint ? <p className="mt-1 text-sm text-text-muted">{hint}</p> : null}
      <ul className="mt-3 grid gap-2">
        {reasons.map((criterion) => (
          <li key={criterion.id} className="flex items-start gap-2.5 text-sm text-text">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
            {criterion.reason[locale] ?? criterion.reason.fr}
          </li>
        ))}
      </ul>
    </div>
  );
}
