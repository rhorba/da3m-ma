import type { I18nText } from "@/lib/db/schema";
import type { AppLocale } from "@/i18n/routing";

/**
 * The pieces an applicant has to gather (Story 4.5). Shown on the programme page and on
 * eligible result cards — the moment a visitor learns they qualify is the moment the
 * list is worth reading.
 *
 * Deliberately not checkboxes yet: ticking one would have to persist somewhere, and
 * nothing asked for that. It is a list to read and print.
 */

type Props = {
  documents: { id: string; label: I18nText }[];
  locale: AppLocale;
  heading: string;
  hint?: string;
  empty?: string;
};

export function DocumentChecklist({ documents, locale, heading, hint, empty }: Props) {
  if (documents.length === 0) {
    return empty ? <p className="text-sm text-text-muted">{empty}</p> : null;
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-text">{heading}</h3>
      {hint ? <p className="mt-1 text-sm text-text-muted">{hint}</p> : null}
      <ul className="mt-3 grid gap-2">
        {documents.map((document) => (
          <li key={document.id} className="flex items-start gap-2.5 text-sm text-text">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-text-muted"
            />
            {document.label[locale] ?? document.label.fr}
          </li>
        ))}
      </ul>
    </div>
  );
}
