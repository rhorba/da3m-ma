# Stories: Da3m.ma
**PRD**: docs/prd-da3m.md · **Architecture**: docs/architecture-da3m.md · **Test Strategy**: docs/test-strategy-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: Scrum Master + Test Architect

---

## Epic 1: Foundation (Sprint 1)
A running, multi-tenant, CI-green skeleton with the security-critical data layer in place.

### Story 1.1: Scaffold + CI
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev + DevOps
```gherkin
Given a fresh clone with .env.local filled from .env.example
When I run pnpm install, lint, typecheck, test and build
Then all pass locally, and the same stages run in GitHub Actions on every PR
```
**Technical Notes**: Next.js 15 App Router, React 19, TS strict (no `any`), pnpm, Tailwind + shadcn/ui, Vitest (coverage thresholds per devops §2), Playwright, Prettier + ESLint with the raw-`db` import ban, Semgrep/Trivy/Gitleaks jobs, `docker-compose.yml` with Postgres 16.
**Dependencies**: none

### Story 1.2: Schema migrations 0001–0006
**Priority**: Must | **Size**: M | **Specialist**: DBA
```gherkin
Given an empty database
When I run migrations up then down then up
Then every table, enum, constraint and index from docs/database-da3m.md exists
And the down migrations leave an empty schema
```
**Technical Notes**: Drizzle schema mirrors database doc §3–§5 exactly. CHECK constraints on `profiles` and `eligibility_reports` included.
**Dependencies**: 1.1

### Story 1.3: Clerk users + organisations + webhook sync
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
```gherkin
Given a user creates a firm organisation in Clerk
When the organization.created and organizationMembership.created webhooks arrive
Then an organizations row and an owner memberships row exist
And a webhook with an invalid Svix signature is rejected with 400
```
**Technical Notes**: Clerk role keys mapped to `owner / consultant / viewer`. `platform_admin` read from Clerk **private** metadata. Idempotent upserts.
**Dependencies**: 1.2

### Story 1.4: `Actor` model + repository layer + isolation suite
**Priority**: Must | **Size**: L | **Specialist**: Backend Dev + Security Engineer
```gherkin
Given firm A has a client with a known id
And I am a consultant in firm B
When I request that client by id through the repository
Then the result is not found

Given an anonymous profile created with token T1
When a request carrying token T2 reads it
Then the result is not found

Given I am a platform_admin who is not a member of firm A
When I list firm A's clients
Then the result is empty
```
**Technical Notes**: `resolveActor()` from Clerk session + anon cookie; every repository function takes `Actor` first. Isolation suite runs on Testcontainers and is CI-blocking from this story on (ADR-5, security §4).
**Dependencies**: 1.2, 1.3

### Story 1.5: i18n routing skeleton FR / AR / EN
**Priority**: Must | **Size**: S | **Specialist**: Frontend Dev
```gherkin
Given I visit /ar
Then <html> has lang="ar" and dir="rtl"
And switching to /fr keeps me on the equivalent page with dir="ltr"
```
**Technical Notes**: next-intl with `[locale]` segment; FR default. Message files exist for all three locales from day one so no string ships hardcoded (Bina lesson).
**Dependencies**: 1.1

---

## Epic 2: Programme Catalogue & Curation (Sprint 2)

### Story 2.1: Profile schema (ADR-6)
**Priority**: Must | **Size**: S | **Specialist**: Backend Dev
**Notes**: One Zod schema → `ProfileField` union. Bands for age/revenue/employees (security §5). Versioned via `schema_version`.

### Story 2.2: Rule DSL schema + publish-time validation
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
```gherkin
Given a draft version whose rule references field "turnover_eur"
When the curator publishes it
Then publishing is rejected with the unknown field named
```
**Notes**: ADR-2 DSL in Zod; max depth 10; operator/value type pairs validated.

### Story 2.3: Curation console — versions, editor, preview, publish
**Priority**: Must | **Size**: L | **Specialist**: Frontend Dev + Backend Dev
**Notes**: Draft from current version; structured rule editor (form, not raw JSON); RuleDiffPreview runs golden profiles and shows outcome deltas; publish revalidates programme page and flags affected alert subscribers. `platform_admin` only, MFA.

### Story 2.4: Source watcher + review queue
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev + Security Engineer
```gherkin
Given a watched source page whose main text changed
When the source-watch cron runs
Then an open review task with a diff excerpt exists
And the published programme version is unchanged
```
**Notes**: robots.txt respected, honest UA, host allowlist + private-IP block (SSRF), ≤ 1 req/host/min, main-content extraction + normalisation.

### Story 2.5: Curate first 10 programmes with golden profiles
**Priority**: Must | **Size**: L | **Specialist**: Curator (user) + Backend Dev
**Notes**: Criteria taken **only from the operator's official page**, with `source_url`; each programme ships ≥ 3 golden profiles (test strategy §5). Candidates: Intelaka, Forsa, Istitmar, Moussanada, Imtiaz, Tatwir, Innov Idea, Innov Start, Innov Risk, Innov Invest. Final list confirmed at curation time — some may have closed or been renamed.

---

## Epic 3: Engine & Wizard (Sprint 3)

### Story 3.1: Three-valued evaluator
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
```gherkin
Given a programme requiring "legal_form in [SARL, SA, AE]" and "company_age_months <= 60"
And a profile with legal_form "SARL" and no company_age_months
When the engine evaluates the profile
Then the outcome is "needs_info" with missing fields ["company_age_months"]
```
**Notes**: Pure, zero I/O (SDR-3/ADR-3). Truth tables + property tests. **100% branches, CI-enforced.**

### Story 3.2: Result ranking + "closest programmes"
**Priority**: Must | **Size**: S | **Specialist**: Backend Dev
**Notes**: Order: eligible (open first, then amount max desc) → needs_info (fewest missing) → ineligible (fewest failing). Zero-match profiles get the 3 closest with what would change.

### Story 3.3: Immutable reports + anonymous token
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
```gherkin
Given a report created against programme version 3
When version 4 is published with a stricter criterion
Then the original report still shows its version 3 outcome
```
**Notes**: ADR-4; anon token hashed at rest; cookie flags per security §3.

### Story 3.4: Wizard UI
**Priority**: Must | **Size**: L | **Specialist**: Frontend Dev + UX
**Notes**: WizardStepper + RadioCards; adaptive skip of size step for "idea"; progress persisted per step; mobile-first; FR copy + AR/EN keys.

### Story 3.5: Results UI + inline questions
**Priority**: Must | **Size**: L | **Specialist**: Frontend Dev
```gherkin
Given my results show "Intelaka" as "needs_info" asking whether my project is rural
When I answer "Oui"
Then a new report is created and "Intelaka" moves to "eligible" without leaving the page
```
**Notes**: ResultGroup, ProgramResultCard, ReasonList, StatusDot, FreshnessStamp, NonAffiliationNote.

### Story 3.6: Wizard rate limiting
**Priority**: Must | **Size**: S | **Specialist**: Backend Dev
**Notes**: Upstash sliding window per IP + token; no report rows past the limit.

---

## Epic 4: Public Surface → Public Beta (Sprint 4)

### Story 4.1: Programme pages (SEO)
**Priority**: Must | **Size**: M | **Specialist**: Frontend Dev + Content Marketer
**Notes**: ISR revalidated on publish; sanitised Markdown; JSON-LD; sitemap; `hreflang` FR/AR/EN; canonical URLs.

### Story 4.2: Catalogue page with filters
**Priority**: Should | **Size**: S | **Specialist**: Frontend Dev

### Story 4.3: Sign-up claims anonymous data
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
```gherkin
Given I completed the wizard anonymously
When I sign up from the results page
Then my profile and report are owned by my account and the anonymous token is rotated
```

### Story 4.4: Alerts — double opt-in + daily digest cron
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
**Notes**: Resend; SPF/DKIM/DMARC configured first; unsubscribe link in every email; per-address daily cap.

### Story 4.5: Document checklists on results and programme pages
**Priority**: Should | **Size**: S | **Specialist**: Frontend Dev

### Story 4.6: Curate remaining ~15 programmes
**Priority**: Must | **Size**: L | **Specialist**: Curator (user) + Backend Dev
**Notes**: Same rules as 2.5. Candidates: Pacte TPME, Go Siyaha, Mowakaba, MDM Invest, INDH (business strand), regional investment centre schemes — confirmed at curation.

### Story 4.7: Arabic translation pass + a11y audit → public beta
**Priority**: Must | **Size**: M | **Specialist**: Copywriter + Tester
**Notes**: Native-reader review of all AR copy; axe zero serious/critical in FR and AR. Public beta ships at the end of this story.

---

## ⛔ Gate: Consultant validation (before Epic 5)
**Owner**: user · **Due**: by end of Sprint 4
- [ ] ≥ 3 conversations with consultants / accountants (prospects: ECA Partners, Clevdeep, TargetUp, Auditia, Nexora Expertise)
- [ ] Record: how they match clients today, how many clients, how they track deadlines, what they'd pay, reaction to 290 / 990 MAD/month
- [ ] Log outcome to `.logs/decisions.md`

If fewer than 2 of 3 see clear value → re-enter BRAINSTORM for Epic 5 scope before building it.

---

## Epic 5: Cabinet Workspace (Sprint 5)

### Story 5.1: Clients — create, edit, archive
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev + Frontend Dev

### Story 5.2: Run eligibility per client + history + PDF export
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
**Notes**: Same engine and report model (SDR-3); PDF branded with firm name, includes non-affiliation note and version dates.

### Story 5.3: Dossiers + pipeline board
**Priority**: Must | **Size**: L | **Specialist**: Frontend Dev + Backend Dev
```gherkin
Given I am a viewer in firm A
When I attempt to move a dossier
Then the action is rejected server-side
```
**Notes**: Create from eligible result (deadline prefilled from `closes_at`); dnd-kit with keyboard sensor; `dossier_events` on every change; `source_report_id` must belong to same firm.

### Story 5.4: Deadline reminders cron
**Priority**: Must | **Size**: S | **Specialist**: Backend Dev
```gherkin
Given an open dossier with a deadline 7 days from today
When the deadlines cron runs twice the same day
Then exactly one reminder is sent and one "reminder_sent" event recorded
```

### Story 5.5: Cabinet dashboard (Tableau)
**Priority**: Should | **Size**: S | **Specialist**: Frontend Dev

### Story 5.6: Members & roles UI
**Priority**: Must | **Size**: S | **Specialist**: Frontend Dev
**Notes**: Clerk `OrganizationProfile` restyled; role labels localised.

---

## Epic 6: Billing & Launch (Sprint 6)

### Story 6.1: Billing — CMI + Stripe, plan gating
**Priority**: Must | **Size**: L | **Specialist**: Backend Dev
**Notes**: Trial 14 days; `solo` limits 1 seat; webhook signature + idempotency; Cabinet routes gated by plan.

### Story 6.2: Monitoring — Sentry (+ cron monitors), PostHog, uptime
**Priority**: Must | **Size**: M | **Specialist**: DevOps

### Story 6.3: Security review + scan gates green
**Priority**: Must | **Size**: M | **Specialist**: Security Engineer + DevSecOps
**Notes**: STRIDE table TODO → Done; adversarial checklist executed.

### Story 6.4: E2E journeys + recorded walkthrough
**Priority**: Must | **Size**: M | **Specialist**: Tester
**Notes**: Wizard → results → save; consultant client → dossier → move; curator publish. Record to `.recordings/v1.0-[date].webm`.

### Story 6.5: Legal — ToS, DPA clause, non-affiliation page, CNDP
**Priority**: Must | **Size**: M | **Specialist**: PM + Copywriter
**Notes**: CNDP declaration is an administrative task for the user (security §7).

---

## Sprint Allocation
| Sprint | Stories | Estimated Effort |
|---|---|---|
| Foundation docs | 10 docs | ~2h ✅ |
| **Sprint 1** | 1.1, 1.2, 1.3, 1.4, 1.5 | ~5h |
| Sprint 2 | 2.1, 2.2, 2.3, 2.4, 2.5, **3.1** (moved: 2.3 and 2.5 depend on the engine) | ~9h |
| Sprint 3 | 3.2, 3.3, 3.4, 3.5, 3.6 | ~5h |
| Sprint 4 | 4.1–4.7 → **public beta** | ~7h |
| ⛔ Gate | Consultant validation (user) | — |
| Sprint 5 | 5.1–5.6 | ~8h |
| Sprint 6 | 6.1–6.5 | ~6h |
| | **Total** | **~42h** |

## Traceability
| PRD Req | Decision | Story | Test |
|---|---|---|---|
| FR-1 | SDR-4 | 3.3, 3.4 | anonymous ownership scenarios |
| FR-2 | ADR-2, ADR-3 | 3.1 | truth tables + "missing info is a question" |
| FR-3 | ADR-3 | 3.1, 3.5 | "ineligible results name their reason" |
| FR-4 | — | 3.5 | FreshnessStamp on results |
| FR-5 | ADR-4 | 3.3 | "reports are reproducible after a rule change" |
| FR-6 | — | 4.3, 4.4 | claim + alerts scenarios |
| FR-7 | SDR-2 | 4.1 | programme page smoke + a11y |
| FR-8 | SDR-3 | 5.1, 5.2 | firm isolation suite |
| FR-9 | — | 5.3, 5.4 | "reminder at J-7" |
| FR-10 | ADR-5 | 1.3, 1.4, 5.6 | "viewer cannot mutate", isolation |
| FR-11 | ADR-4, ADR-6 | 2.2, 2.3 | "unknown profile field fails publish" |
| FR-12 | SDR-1 | 2.4 | "source change raises a review task" |
| FR-13 | PRD §7 | 3.5, 4.1, 6.5 | NonAffiliationNote present (E2E) |
| NFR-4 | ADR-3 | 3.1 | 100% branch gate |
| NFR-6 | SDR-1 | 2.4 | watcher adversarial checks |
