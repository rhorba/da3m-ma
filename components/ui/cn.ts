/**
 * Joins class names, dropping anything falsy. Deliberately not `clsx` + `tailwind-merge`:
 * these primitives are small and owned here, so no caller overrides a utility that would
 * need merging. Revisit if this grows into a real component library.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
