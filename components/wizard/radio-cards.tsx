"use client";

import { useId } from "react";
import { cn } from "../ui/cn";

/**
 * A question rendered as full-width selectable cards (UI foundation §3). These are real
 * radio and checkbox inputs inside a fieldset, so keyboard, screen reader and RTL
 * behaviour come from the browser rather than from us.
 */

export type CardOption = { value: string; label: string };

type Props = {
  name: string;
  legend: string;
  help?: string;
  options: readonly CardOption[];
  /** A string for a single answer, an array when several may be picked, undefined when unanswered. */
  value: string | string[] | undefined;
  multiple?: boolean;
  onChange: (value: string | string[] | undefined) => void;
  /** Rendered under the options; used for the "I don't know" affordance. */
  footer?: React.ReactNode;
};

function isSelected(value: Props["value"], option: string): boolean {
  return Array.isArray(value) ? value.includes(option) : value === option;
}

export function RadioCards({
  name,
  legend,
  help,
  options,
  value,
  multiple = false,
  onChange,
  footer,
}: Props) {
  const helpId = useId();

  function toggle(option: string, checked: boolean) {
    if (!multiple) {
      onChange(option);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    const next = checked ? [...current, option] : current.filter((v) => v !== option);
    onChange(next.length > 0 ? next : undefined);
  }

  return (
    <fieldset aria-describedby={help ? helpId : undefined}>
      <legend className="text-lg font-semibold text-text">{legend}</legend>
      {help ? (
        <p id={helpId} className="mt-1 text-sm text-text-muted">
          {help}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        {options.map((option) => {
          const selected = isSelected(value, option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-13 cursor-pointer items-center gap-3 rounded-md border bg-surface px-4 py-3",
                "transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                "has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={option.value}
                checked={selected}
                onChange={(event) => toggle(option.value, event.target.checked)}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="text-base text-text">{option.label}</span>
            </label>
          );
        })}
      </div>

      {footer ? <div className="mt-2">{footer}</div> : null}
    </fieldset>
  );
}
