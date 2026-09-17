# Activity Log
<!-- Tracks completed tasks, milestones, and deliverables -->
<!-- Format: ### [YYYY-MM-DD HH:MM] COMPLETED/MILESTONE — Title -->


### [2026-09-17 11:12] [PLAN] — Da3m.ma sprint plan
- Tasks: Foundation docs; S1 foundation; S2 catalogue + curation + watcher; S3 engine + wizard; S4 B2C surface -> public beta; consultant gate; S5 Cabinet; S6 billing + launch
- Estimated: ~42h
- Status: approved by user (docs first, then Sprint 1)

### [2026-09-17 12:00] [MILESTONE] — 10 foundation docs written
- Specialist: PM, System Designer, Software Architect, Security Engineer, DBA, UX, UI, Test Architect, DevOps, Scrum Master
- Summary: prd, system-design, architecture, security, database, ux, ui, test-strategy, devops, stories for Da3m.ma. UI contrast ratios computed rather than asserted; warning and ineligible tokens failed AA and were darkened. No product code.
- Status: awaiting user approval
- Impact: high

### [2026-09-17 12:10] [PUSH] — Foundation docs pushed
- Specialist: DevOps
- Summary: Public repo rhorba/da3m-ma created; commit 08d6d5c pushed to main. No CI workflow exists yet (Story 1.1), so there is no CI status to monitor.
- Status: complete

### [2026-09-17 12:20] [MILESTONE] — Foundation docs approved
- Specialist: Orchestrator
- Summary: User approved all 10 Da3m.ma foundation docs. Database for Sprint 1: local Docker Postgres. Sprint 1 EXECUTE started (stories 1.1-1.5).
- Status: complete

### [2026-09-17 14:15] [COMPLETED] — Sprint 1 stories 1.1–1.5
- Specialist: Backend Dev, DBA, Frontend Dev, Security Engineer, DevOps, Tester
- Summary: 1.1 Next.js 15.5 + TS strict + pnpm scaffold, ESLint (raw-db ban + module boundaries), Prettier, Vitest projects, Playwright, CI (quality, test, security, e2e). 1.2 full schema + migration + reverse + round-trip test. 1.3 Clerk org/membership webhook sync (idempotent, out-of-order safe, signature-verified). 1.4 Actor model + scoped repositories (cabinet, profiles, auth) + isolation suite. 1.5 next-intl FR/AR/EN, RTL, message-parity tests, tokens from UI doc, security headers.
- Status: complete
- Impact: high

### [2026-09-17 14:45] [CI] — Sprint 1 push afcf459: GREEN
- Specialist: DevOps
- Summary: Run 35207767753 — Lint/types/format success; Unit + integration (coverage gate) success; Security scans (Semgrep, Trivy, Gitleaks) success; Build + E2E success. Sprint 1 SHIP complete.
- Status: complete

### [2026-09-17 15:00] [PLAN] — Sprint 2 started
- Specialist: Orchestrator
- Summary: User said "start". Clerk keys still empty in .env.local, so Clerk-dependent parts (admin actor resolution against real Clerk, curation console UI run + E2E) go last; 2.1, 2.2, 2.4 and curation back end proceed first.
- Status: in-progress

### [2026-09-17 16:40] [COMPLETED] — Sprint 2 checkpoint: stories 2.1, 2.2, 3.1, 2.4
- Specialist: Backend Dev, Security Engineer, Test Architect
- Summary: 2.1 profile contract (12 fields, bands, compile-time parity with FIELD_SPECS). 2.2 rule DSL parser + semantic validator with paths (unknown field named; operator/value per field kind; depth, duplicate ids, empty groups). 3.1 three-valued evaluator: full truth tables, every operator, property tests (monotonicity, completeness, determinism, explanation invariants). 2.4 source watcher: SSRF guard (https, allowlist, public-address check on every redirect hop), robots.txt per RFC 9309, main-text extraction + normalisation, change diff, one fetch_failing task per watch, reverify tasks, cron endpoint with constant-time secret check.
- Status: complete

### [2026-09-17 17:10] [CI] — Sprint 2 checkpoint 9384240: GREEN
- Specialist: DevOps
- Summary: Run 35209663695 — lint/types/format, unit+integration (coverage gate incl. lib/engine 100%), security scans, build+E2E all success.
- Status: complete

### [2026-09-17 19:20] [COMPLETED] — Sprint 2 stories 2.3 (revised) and 2.5 (drafts)
- Specialist: Backend Dev, PM, Test Architect
- Summary: Catalogue-as-code tooling (file schema, loader, validator with golden profiles, idempotent sync to immutable versions, watch reconciliation, review-task CLI). 10 draft programmes researched from official pages only (Tamwilcom, Tamwilcom Startups, Ministry of Finance, Bank Al-Maghrib), each with sources, OFFICIAL / INTERPRETATION / OPEN notes and golden profiles; all pass validation in CI. Curation guide written. Status: drafts awaiting user verification.
- Status: complete
- Impact: high

### [2026-09-17 19:45] [CI] — Sprint 2 push ebdd50d: GREEN
- Specialist: DevOps
- Summary: Run 35212210013 — lint/types/format, unit+integration (coverage gate incl. lib/engine 100%, catalogue files test), security scans, build+E2E all success. Sprint 2 SHIP complete.
- Status: complete

### [2026-09-17 21:05] [COMPLETED] — Sprint 3 Batch 1: stories 3.2, 3.6, 3.3
- Specialist: Backend Dev, Security Engineer, Tech Lead, Tester
- Summary: 3.2 lib/engine/rank.ts — pure, generic ranking (eligible by openness then amount desc; needs_info by fewest missing; ineligible by fewest failing; deterministic id tie-break) plus the 3 closest misses when nothing is actionable. 3.6 lib/rate-limit — RateLimiter interface + in-process sliding-window log, multi-key (IP + anon token), injectable clock, idle-key sweep, clientIpFrom; ADR-9 records the Upstash swap. 3.3 lib/reports — pure buildReport snapshotting every version fact the results page renders (ADR-4), write-once repository scoped by profile ownership, lib/catalog read repository for the published catalogue, lib/auth/anon-session cookie helpers (HttpOnly, SameSite=Lax, 24 months).
- Status: complete
- Impact: high

### [2026-09-17 21:40] [COMPLETED] — Sprint 3 Batch 2: story 3.4 wizard UI
- Specialist: UX Designer, UI Designer, Frontend Dev, Copywriter, Tester
- Summary: lib/wizard/steps.ts — five steps derived from FIELD_SPECS with compile-time field parity, adaptive skip of the company step for "idée", pruneSkipped so dropped steps do not leak stale answers. components/ui (cn, Button) + components/wizard (RadioCards on native radio/checkbox inputs in a fieldset, WizardStepper, Wizard client component). Step id in the query string; answers in localStorage (guarded) and written to the anon profile after every step. Server actions saveStep + submitWizard with rate limiting charged before any write. Trilingual copy: 5 steps, 10 questions, 66 options in FR/AR/EN; home page now links to the wizard.
- Status: complete
- Impact: high
- Verified: build prerenders /fr /ar /en/eligibilite statically (ADR-7 holds); Playwright screenshots confirm step transition, ?etape= in the URL, and correct RTL mirroring in Arabic.

### [2026-09-17 21:58] [COMPLETED] — Sprint 3 Batch 3: stories 3.5 and 3.2 empty state
- Specialist: Frontend Dev, Backend Dev, Test Architect, DevOps
- Summary: /[locale]/resultats/[id] renders only from the stored report (ADR-4), force-dynamic and noindex, 404 for anyone but the owner. ResultGroup (ineligible collapsed in a native <details>), ProgramResultCard (StatusDot, kind, amount via pure amountLabel/formatMad, freshness stamp, official source), InlineQuestion answering one missing field. answerQuestion action writes a new report and the page swaps to it in place. Zero-match state shows the 3 closest with what would change. E2E fixtures published through the real loader + sync path (pnpm e2e:seed); CI e2e job now runs a Postgres service, migrate and seed.
- Status: complete
- Impact: high

### [2026-09-17 22:00] [VIDEO_RECORDED] — Sprint 3 user-facing flows
- Specialist: Tester
- File: .recordings/v0.3-sprint3-2026-09-17.webm (mobile viewport, 412x915)
- Scenarios: landing → wizard CTA; five steps (forme juridique, secteur + région, âge + MRE, ancienneté + effectif + CA, montant + objet); submit → ranked results; inline "milieu rural" question moving Prêt rural into the eligible group; collapsed "Non éligible" group expanded; the same report re-opened in Arabic (RTL).
- Status: complete

### [2026-09-17 22:05] [CI] — Sprint 3 push 333d13a: GREEN
- Specialist: DevOps, DevSecOps, Deployment
- Summary: Run 35274036321 — Lint/types/format, Unit + integration (coverage gate incl. lib/engine 100%), Security scans (Semgrep, Trivy, Gitleaks), Build + E2E (new Postgres service, migrate, seed, 12 tests desktop + mobile) all success. Sprint 3 SHIP complete.
- Status: complete

### [2026-09-17 22:40] [COMPLETED] — Sprint 4 Batch 1: stories 4.1 and 4.5
- Specialist: Backend Dev, Frontend Dev, Copywriter, Tester
- Summary: catalogue read gains findPublishedBySlug (shared column set, row type derived from the tables). /[locale]/programmes/[slug] renders on demand with revalidate 3600, so the build needs no database; canonical + hreflang FR/AR/EN + x-default from the pure lib/seo helpers; GovernmentService JSON-LD. CriteriaList builds "Qui peut en bénéficier" from the rule tree's verified reason strings via collectReasons, so the page cannot promise what the engine would refuse. DocumentChecklist (4.5) on the programme page and on eligible result cards; reports now snapshot documents too (ADR-4). Result card titles link to the programme page. Trilingual copy for both new surfaces.
- Status: complete
- Impact: high

### [2026-09-17 22:55] [COMPLETED] — Sprint 4 Batch 2: story 4.2 and the crawl surface
- Specialist: Frontend Dev, DevOps, Tester
- Summary: /[locale]/programmes prerendered per locale with 1h ISR; CatalogueList filters by type, status and operator in the browser over a list the server already rendered, with a count, a reset and two distinct empty states (nothing published vs nothing matching). Only view-model fields cross to the client; rule trees stay on the server. app/sitemap.ts lists the static paths and every published programme in all three locales with hreflang alternates; app/robots.ts keeps crawlers out of /[locale]/resultats/ and /api/. Home page links to the catalogue.
- Status: complete
- Impact: medium

### [2026-09-17 22:55] [DECISION] — The production build now needs DATABASE_URL
- Specialist: DevOps
- Summary: /[locale]/programmes and /sitemap.xml are prerendered at build with hourly revalidation, so `next build` reads the published catalogue. CI's Build + E2E job already provides DATABASE_URL, and Vercel has it. Programme detail pages stay render-on-demand and need nothing at build.
- Status: complete
