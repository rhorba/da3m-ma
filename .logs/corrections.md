# Corrections & Plan Changes
<!-- Tracks scope changes, pivots, plan adjustments -->
<!-- Format: ### [YYYY-MM-DD HH:MM] SCOPE_CHANGE/PIVOT/REPLAN — Title -->


### [2026-09-17 14:25] [CORRECTION] — Sprint 1 implementation deviations from the docs
- Specialist: Tech Lead
- Summary:
  1. Migrations: one generated 0000_initial.sql instead of seven planned files (Drizzle Kit generates from the full schema); reversibility kept via hand-written drizzle/down/ + round-trip test. No pgcrypto (native on PG16).
  2. shadcn/ui init deferred to the first story that needs a component (Story 3.4) — YAGNI.
  3. CSP ships as frame-ancestors only; full nonce-based CSP moves to Story 6.3. Other security headers shipped.
  4. Anonymous profiles: one per token by schema design; saveProfile upserts (was a raw unique-violation error).
  5. Local Docker Postgres on port 5433, not 5432, to avoid clashing with a host Postgres.
  6. resolveAdminActor (platform_admin from Clerk private metadata) moves to Sprint 2 with the curation console; Actor type already includes admin.
  7. Vitest coverage threshold for lib/engine at 100% branches added in Story 3.1 with the engine.
- Status: resolved

### [2026-09-17 15:00] [CORRECTION] — Story 3.1 (engine) pulled into Sprint 2
- Specialist: Scrum Master
- Summary: Story 2.3 (RuleDiffPreview) and 2.5 (golden profiles in CI) both depend on the evaluator. Dependency order in the stories doc was wrong; the pure engine ships in Sprint 2. Sprint 3 keeps 3.2-3.6.
- Status: resolved

### [2026-09-17 17:20] [CORRECTION] — Story 2.3 scope replaced by ADR-8
- Specialist: Scrum Master
- Summary: Curation console (form editor, preview UI, publish UI) replaced by catalogue-as-code tooling. Page revalidation and alert flagging on publish move to Stories 4.1 / 4.4.
- Status: resolved

### [2026-09-17 19:10] [CORRECTION] — Story 2.5 candidate list was stale
- Specialist: PM
- Summary: Innov Idea / Innov Start no longer exist (current: Tech Start, Tech Boost, Innov Risk, Innov Dev). Innov Risk dropped (criteria too vague to encode honestly). Maroc PME and Forsa programmes moved to Story 4.6 (not machine-readable, see issues). Final 10 drafts are all Tamwilcom.
- Status: resolved

### [2026-09-17 21:40] [SCOPE] — Wizard asks 10 fields, not all 20
- Change: Sprint 2's closing note said the wizard must also ask innovation_stage, has_partner_support, exports_to_africa, has_intelaka_loan and the other narrow fields. The wizard asks only the 10 fields in the UX five-step flow.
- Reason: those fields are referenced by one or two programmes each. Asking everyone about them lengthens the wizard for the many to serve the few, and the engine already returns needs_info for them — Story 3.5 asks them inline, on the results page, only when a programme actually depends on the answer ("unknown is a question, not a no", UX §principles).
- Impact: none on coverage of the catalogue; the same answers are collected, later and only when they matter.

### [2026-09-17 21:40] [DECISION] — shadcn pattern without the Radix dependency
- Change: "shadcn/ui, scoped" was approved at the BRAINSTORM gate. Implemented as shadcn's structure (components/ui, cn(), token-mapped primitives) with native radio/checkbox inputs and no Radix packages.
- Reason: the approved UI foundation (§6) requires RadioCards to be real radio inputs; Radix RadioGroup renders buttons with ARIA roles instead. clsx + tailwind-merge could not be installed either — `pnpm add` re-resolves and trips the .npmrc minimum-release-age guard on a transitive nan@2.29.0.
- Impact: no new dependencies. Swapping in real shadcn later is mechanical.
