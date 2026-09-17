import type { ProgramStatus } from "@/lib/engine";
import { cn } from "../ui/cn";

/**
 * Whether a programme is taking applications. Colour never carries this alone — the
 * label is always rendered next to the dot (UI foundation §6).
 */
const TONE: Record<ProgramStatus, string> = {
  open: "bg-primary",
  rolling: "bg-primary",
  upcoming: "bg-accent",
  closed: "bg-ineligible",
};

export function StatusDot({ status, label }: { status: ProgramStatus; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
      <span className={cn("size-2 rounded-full", TONE[status])} aria-hidden="true" />
      {label}
    </span>
  );
}
