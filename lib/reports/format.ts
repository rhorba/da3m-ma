/**
 * Presentation helpers for a stored report. Pure, so the amount and date rules are
 * tested once instead of being re-derived in every card.
 */

export type AmountLabel =
  | { key: "amountRange"; min: number; max: number }
  | { key: "amountUpTo"; amount: number }
  | { key: "amountFrom"; amount: number }
  | null;

/**
 * What a programme's published bounds should say. A programme with neither bound
 * promises nothing measurable, so it says nothing rather than "0 MAD".
 */
export function amountLabel(min: number | null, max: number | null): AmountLabel {
  if (min !== null && max !== null) return { key: "amountRange", min, max };
  if (max !== null) return { key: "amountUpTo", amount: max };
  if (min !== null) return { key: "amountFrom", amount: min };
  return null;
}

/**
 * Amounts in dirhams. Arabic keeps Latin digits, which is the convention on Moroccan
 * official documents (UI foundation §5), and drops centimes: these are ceilings, not
 * invoices.
 */
export function formatMad(locale: string, amount: number): string {
  const tag = locale === "ar" ? "ar-MA-u-nu-latn" : locale === "fr" ? "fr-MA" : "en-MA";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** An ISO date as the visitor's locale writes it. */
export function formatDate(locale: string, iso: string): string {
  const tag = locale === "ar" ? "ar-MA-u-nu-latn" : locale === "fr" ? "fr-MA" : "en-GB";
  // Formatted in UTC so the date never slips a day west of Greenwich.
  return new Intl.DateTimeFormat(tag, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
