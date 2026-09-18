import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Button variants from the UI foundation (docs/ui-da3m.md §2). */
const VARIANTS = {
  primary: "bg-primary text-primary-fg hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-border bg-surface text-text hover:border-primary disabled:opacity-50 disabled:hover:border-border",
  ghost: "text-text-muted hover:text-text underline underline-offset-4",
} as const;

const SIZES = {
  md: "min-h-11 px-4 text-base",
  lg: "min-h-13 px-6 text-base",
} as const;

type Props = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-opacity disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
