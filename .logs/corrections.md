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
