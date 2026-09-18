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

### [2026-09-17 23:25] [CI] — Sprint 4 partial, push e289a08: GREEN
- Specialist: DevOps, DevSecOps
- Summary: Run 35282039681 — Lint/types/format, Unit + integration (coverage gate), Security scans, Build + E2E all success. Follows the red run 35278528054 on 28115ee (Semgrep blocked the JSON-LD injection); see .logs/issues.md.
- Status: complete

### [2026-09-17 23:25] [ISSUE] — CI watch loops were silently doing nothing
- Specialist: DevOps
- Summary: `jq` is not installed in this environment, so the background CI watchers produced no events and exited cleanly — a green-looking no-op. Use `gh ... --jq` (gh's built-in filter) instead of piping to `jq`.
- Status: noted; CI status now confirmed directly before any claim of green

### [2026-09-18 00:20] [COMPLETED] — Sprint 4, story 4.7 (accessibility half)
- Specialist: UI Designer, Frontend Dev, Tester
- Summary: tests/unit/contrast.test.ts computes WCAG 2.1 contrast from the tokens actually shipped in app/globals.css, for light and dark, and asserts every ratio the UI foundation documents. e2e/a11y.spec.ts checks landmarks, single h1, heading order, accessible names, target size and focus visibility on all four public pages, plus lang/dir in FR and AR, on desktop and mobile.
- Found and fixed three real AA failures in the dark theme, none of which a light-mode axe run would have caught:
  1. --color-warning was never overridden for dark: #946100 on #12110e = 3.6:1. Now #E8B04B (9.7:1).
  2. --color-error was never overridden for dark: #B03A2E = 3.1:1. Now #F08A7E (7.8:1). This is the wizard error and the inline-question failure message.
  3. Every primary button used a hardcoded text-white: white on the dark-mode teal #3FA59E = 3.0:1. Buttons now use text-primary-fg, which flips to ink #12110E (6.4:1).
- Also enlarged navigation and standalone link targets to 44px (brand link, language switcher, back link, source link, restart link); links inside prose stay exempt under WCAG 2.5.8.
- docs/ui-da3m.md updated with the dark values and a pointer to the tests that enforce them.
- Status: complete
- Impact: high
- Still open on 4.7: a full axe sweep (@axe-core/playwright is blocked by the .npmrc minimum-release-age guard until ~21 Sept) and the native Arabic reader pass (user-owned).

### [2026-09-18 00:35] [CI] — Story 4.7 accessibility half, push 009e39f: GREEN
- Specialist: DevOps, DevSecOps
- Summary: Run 35302357411 — Lint/types/format, Unit + integration (coverage gate), Security scans, Build + E2E (94 tests incl. 44 accessibility assertions) all success.
- Status: complete

### [2026-09-18 00:55] [COMPLETED] — Verification worksheet for the 10 drafts
- Specialist: PM, Project Monitor
- Summary: docs/verification-worksheet.md, generated from data/programs/*.json. Per programme: identity and amounts, the official sources to check against, the eligibility rules rendered as the engine will apply them (rule tree walked into a readable outline with each criterion's French reason), the documents listed, the OFFICIAL claims as a tick list, the INTERPRETATION/OPEN items as explicit decisions, and the golden profiles that pin behaviour in CI. Plus the sign-off snippet and the commands to run. 18 decisions across 10 programmes; pret-amorcage has none. Checked all 11 source URLs: every one returns 200 as of today, so nothing has moved since they were consulted. Pointer added from docs/curation-guide.md.
- Status: complete
- Impact: high — this is the last gate before public beta, and it is now a list of answers rather than a research task.

### [2026-09-18 01:10] [CI] — Verification worksheet, push ea731a1: GREEN
- Specialist: DevOps
- Summary: Run 35310644575 — all four jobs success.
- Status: complete

### [2026-09-18 06:45] [COMPLETED] — Sprint 4, story 4.3 part 1: claiming anonymous data
- Specialist: Backend Dev, Security Engineer, Tester
- Summary: profiles.claimProfiles(actor, tokenHash) transfers the anonymous profile to the signed-in user in one UPDATE guarded by `owner_user_id IS NULL` — idempotent, and an already-owned profile can never be taken over by whoever holds the cookie. Reports reference the profile, not the token, so history follows without being copied. rotateAnonToken() issues a fresh token after a successful claim (security §3); rotation happens only on success, because a failed claim leaves the token as the only route back to the visitor's data. claimAnonymousData orchestrates the three steps with injected dependencies, in the resolve-actor style. reports.listReports restored (removed as YAGNI in Sprint 3, now has a real caller in /mon-espace).
- Tests: 9 unit (ordering, actor kinds, failure paths) + 3 rotation + 14 integration (ownership transfer, data and schema preserved, reports and history following, idempotency, cross-visitor isolation, already-owned refusal, actor-kind refusals).
- Status: complete
- Impact: high

### [2026-09-18 06:45] [BLOCKED] — Story 4.3 part 2: the /mon-espace route
- Specialist: Backend Dev, DevOps
- Summary: Wiring the claim into a visit needs Clerk middleware composed with next-intl middleware, a ClerkProvider layout and the /mon-espace page. Held deliberately: the middleware matcher covers every route, so a wrong composition turns the public wizard, results and catalogue into 500s, and without Clerk keys a working composition is indistinguishable from a broken one. The claim logic itself is finished and tested.
- Blocked on: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET. User is signing in to dashboard.clerk.com; not signed in as of 06:44.
- Status: blocked

### [2026-09-18 07:55] [COMPLETED] — Sprint 4, story 4.3 part 2: /mon-espace and the Clerk wiring
- Specialist: Backend Dev, Frontend Dev, DevOps, Security Engineer
- Summary: middleware composes Clerk with next-intl by branching rather than wrapping — clerkMiddleware is invoked only for /:locale/(mon-espace|cabinet|admin), so public routes never touch Clerk and keep working without credentials (ADR-7). lib/session holds the only Clerk import outside the webhook, kept out of lib/auth so importing the actor model on a public page cannot pull Clerk into the bundle. /mon-espace claims anonymous data on visit, shows the claim notice and the report history. ClerkProvider wraps the signed-in area only.
- Gap found and closed while wiring: claiming rotates the anonymous token, so a claimed report was no longer reachable through the public /resultats/[id]. Extracted ReportBody and added /mon-espace/resultats/[id], which reads the same report through the account. Same rendering, different door.
- Verified without Clerk keys: build passes; all 94 E2E pass with the middleware installed; /fr, /fr/eligibilite and /fr/programmes return 200 while /fr/mon-espace returns 500 purely because CLERK_SECRET_KEY is absent — the private route fails and the public surface does not, which is the property that mattered.
- Not verified: everything behind the sign-in — the claim firing on a real session, auth.protect() redirecting, and whether /[locale]/mon-espace is genuinely dynamic at runtime (the build marks it as prerendered despite force-dynamic, likely because the locale layout supplies params).
- Status: complete pending runtime verification
- Blocked on: CLERK_SECRET_KEY and CLERK_WEBHOOK_SIGNING_SECRET (both blocked from the agent's context by tooling; user must paste them).

### [2026-09-18 07:55] [COMPLETED] — Clerk dashboard set up
- Specialist: DevOps
- Summary: Created the da3m application (Organizations enabled) because the account held only "wassalha" — reusing it would have piped another product's users and orgs into Da3m's database through the sync webhook. Created the org:viewer role, so all three keys now match mapClerkRole. Publishable key written to .env.local.
- Outstanding in the dashboard: the webhook endpoint (https://da3m.ma/api/webhooks/clerk, six organization/organizationMembership events) — the Svix panel is a cross-origin iframe and the renderer became unresponsive, so the user creates it.
- Cost note: custom roles are a Clerk premium feature, free on development instances but requiring a paid plan in production. org:viewer therefore has a price attached before Sprint 5's Cabinet work.
- Status: complete

### [2026-09-18 08:05] [CI] — Story 4.3 wiring, push ec108c3: GREEN
- Specialist: DevOps, DevSecOps
- Summary: Run 35317448772 — all four jobs success. Confirms in CI what was measured locally: the Clerk middleware composition leaves the public surface working with no Clerk credentials present.
- Status: complete

### [2026-09-18 08:05] [COMPLETED] — Clerk webhook endpoint created
- Specialist: DevOps
- Summary: Endpoint 2Sdt0T → https://da3m.ma/api/webhooks/clerk, subscribed to exactly the six events the handler consumes (organization.created/deleted/updated, organizationMembership.created/deleted/updated). Deliveries will fail until the app is deployed at that host, which is expected — the endpoint exists so the signing secret does.
- Remaining: CLERK_SECRET_KEY and CLERK_WEBHOOK_SIGNING_SECRET. Both are withheld from the agent by the browser tooling's sensitive-key guard, so the user pastes them into .env.local. Everything else in the Clerk dashboard is configured.
- Status: complete

### [2026-09-18 08:20] [RESOLVED] — /mon-espace prerender concern was unfounded
- Specialist: DevOps
- Concern raised at commit ec108c3: the build table marks /[locale]/mon-espace as prerendered (●) despite force-dynamic, which would have served every visitor a stale 404.
- Evidence: the build emits HTML only for the genuinely static routes — {fr,ar,en}.html, {fr,ar,en}/eligibilite.html, {fr,ar,en}/programmes.html and _not-found.html. No mon-espace.html exists for any locale, and none for mon-espace/resultats/[id]. force-dynamic held; the ● marker groups the route under the locale because the parent layout supplies params, not because anything was prerendered.
- Status: resolved, no code change needed
- Still unverified (needs Clerk secrets): auth.protect() redirecting an anonymous visitor to sign-in, and the end-to-end claim on a real session.
