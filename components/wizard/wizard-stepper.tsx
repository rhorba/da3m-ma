"use client";

import { cn } from "../ui/cn";

/**
 * Step dots plus "Step 2 of 5" (UI foundation §3). The text carries the meaning; the
 * dots are decorative, so a screen reader hears the count once rather than five times.
 */
type Props = {
  label: string;
  current: number;
  total: number;
  /** Localised "Step {current} of {total}". */
  progressText: string;
};

export function WizardStepper({ label, current, total, progressText }: Props) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center justify-between gap-4 border-b border-border pb-4"
    >
      <p className="text-sm font-medium text-text-muted" aria-live="polite">
        {progressText}
      </p>
      <ol className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i < current ? "w-6 bg-primary" : "w-3 bg-border",
            )}
          />
        ))}
      </ol>
    </div>
  );
}
