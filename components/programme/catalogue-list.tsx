"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * The catalogue with its filters (Story 4.2). Filtering happens in the browser over a
 * list the server already rendered: at this catalogue's size the whole thing is a few
 * kilobytes, so the page stays cacheable and crawlable while filtering stays instant.
 *
 * If the catalogue ever grows past a few hundred programmes this should move to the
 * server with the filters in the query string.
 */

export type CatalogueEntry = {
  slug: string;
  title: string;
  summary: string;
  operator: string;
  kind: string;
  status: string;
  amount: string | null;
};

type Filters = { kind: string; status: string; operator: string };

const ANY = "";

export function CatalogueList({ entries }: { entries: CatalogueEntry[] }) {
  const t = useTranslations("catalogue");
  const tResults = useTranslations("results");
  const [filters, setFilters] = useState<Filters>({ kind: ANY, status: ANY, operator: ANY });

  const kinds = useMemo(() => unique(entries.map((e) => e.kind)), [entries]);
  const statuses = useMemo(() => unique(entries.map((e) => e.status)), [entries]);
  const operators = useMemo(() => unique(entries.map((e) => e.operator)), [entries]);

  const shown = entries.filter(
    (entry) =>
      (filters.kind === ANY || entry.kind === filters.kind) &&
      (filters.status === ANY || entry.status === filters.status) &&
      (filters.operator === ANY || entry.operator === filters.operator),
  );

  const filtered = filters.kind !== ANY || filters.status !== ANY || filters.operator !== ANY;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label={t("filterKind")}
          value={filters.kind}
          options={kinds.map((kind) => ({ value: kind, label: tResults(`kind.${kind}`) }))}
          anyLabel={t("filterAll")}
          onChange={(kind) => setFilters((f) => ({ ...f, kind }))}
        />
        <Select
          label={t("filterStatus")}
          value={filters.status}
          options={statuses.map((status) => ({
            value: status,
            label: tResults(`status.${status}`),
          }))}
          anyLabel={t("filterAll")}
          onChange={(status) => setFilters((f) => ({ ...f, status }))}
        />
        <Select
          label={t("filterOperator")}
          value={filters.operator}
          options={operators.map((operator) => ({ value: operator, label: operator }))}
          anyLabel={t("filterAll")}
          onChange={(operator) => setFilters((f) => ({ ...f, operator }))}
        />
        {filtered ? (
          <button
            type="button"
            onClick={() => setFilters({ kind: ANY, status: ANY, operator: ANY })}
            className="min-h-11 text-sm font-medium text-primary underline underline-offset-4"
          >
            {t("reset")}
          </button>
        ) : null}
      </div>

      <p className="text-sm text-text-muted" aria-live="polite">
        {t("count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-text-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((entry) => (
            <li key={entry.slug}>
              <Link
                href={`/programmes/${entry.slug}`}
                className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary sm:p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-lg font-semibold text-text">{entry.title}</h2>
                  <span className="text-sm text-text-muted">{entry.operator}</span>
                </div>
                <p className="mt-2 text-sm text-text-muted">{entry.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                  <span>{tResults(`kind.${entry.kind}`)}</span>
                  <span>{tResults(`status.${entry.status}`)}</span>
                  {entry.amount ? (
                    <span className="font-medium text-text">
                      <bdi>{entry.amount}</bdi>
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

type SelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  anyLabel: string;
  onChange: (value: string) => void;
};

function Select({ label, value, options, anyLabel, onChange }: SelectProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-md border border-border bg-surface px-3 text-base text-text"
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
