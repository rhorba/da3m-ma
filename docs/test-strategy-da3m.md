# Test Strategy: Da3m.ma
**Stories Reference**: docs/stories-da3m.md
**Architecture**: docs/architecture-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: Test Architect

## 1. Risk Assessment
| Component | Impact | Frequency | Complexity | Test Level |
|---|---|---|---|---|
| **Eligibility engine** (`lib/engine/`) | H | H | M | **Maximum** — 100% branch coverage + truth tables + property tests |
| **Firm isolation** (Cabinet repositories) | H | H | M | **Maximum** — isolation suite, CI-blocking, never waived |
| **Anon/user ownership** (B2C) | H | H | L | **High** |
| Rule DSL validation + publish checks | H | M | M | **High** |
| Programme fixtures vs. published rules | H | M | M | **High** — golden profiles per programme |
| Source watcher (hash, normalise, SSRF guard) | M | M | M | High |
| Dossier pipeline + reminders | M | M | M | Standard |
| Alerts (double opt-in, fan-out) | M | L | M | Standard |
| Billing webhooks | M | L | M | Standard |
| Programme pages / marketing | L | H | L | Minimal — smoke + a11y scan |

## 2. Test Pyramid Targets
| Layer | Coverage Target | Tooling |
|---|---|---|
| Unit | ≥ 60% of business logic; **100% branches in `lib/engine/`** | Vitest (+ fast-check for property tests) |
| Integration | ≥ 40% of repositories + server actions | Vitest + Testcontainers (Postgres 16) |
| E2E | Critical journeys only | Playwright (+ axe for a11y) |
| **Combined gate** | **≥ 80%** — non-negotiable | CI blocks merge |

## 3. Engine Truth Tables (unit, exhaustive)
Three-valued logic (ADR-3) is tested as full truth tables, not examples:

| `all(a,b)` | pass | unknown | fail |
|---|---|---|---|
| **pass** | pass | unknown | fail |
| **unknown** | unknown | unknown | fail |
| **fail** | fail | fail | fail |

| `any(a,b)` | pass | unknown | fail |
|---|---|---|---|
| **pass** | pass | pass | pass |
| **unknown** | pass | unknown | unknown |
| **fail** | pass | unknown | fail |

`not`: pass↔fail, unknown→unknown. Plus every operator × {value present and matching, present and not matching, absent}.

**Property tests** (fast-check):
- Adding information never turns `eligible` into `needs_info` (monotonicity of unknown resolution).
- A profile with every field filled never yields `needs_info`.
- `evaluate` is deterministic: same inputs → deep-equal output.
- Every `ineligible` result has ≥ 1 failing reason; every `needs_info` has ≥ 1 missing field.

## 4. ATDD Acceptance Scenarios
```gherkin
Feature: Eligibility results

  Scenario: Missing information is a question, not a rejection
    Given a programme requiring "legal_form in [SARL, SA, AE]" and "company_age_months <= 60"
    And a profile with legal_form "SARL" and no company_age_months
    When the engine evaluates the profile
    Then the outcome is "needs_info"
    And the missing fields are ["company_age_months"]

  Scenario: Ineligible results name their reason
    Given a programme requiring "project_stage = registered"
    And a profile with project_stage "idea"
    When the engine evaluates the profile
    Then the outcome is "ineligible"
    And the failing reason is the criterion's localised reason text

  Scenario: Answering an inline question updates the result in place
    Given my results show "Intelaka" as "needs_info" asking whether my project is rural
    When I answer "Oui"
    Then a new report is created
    And "Intelaka" moves to "eligible" without leaving the page

  Scenario: Reports are reproducible after a rule change
    Given a report created against programme version 3
    When version 4 is published with a stricter criterion
    Then the original report still shows its version 3 outcome
    And re-running the profile creates a new report against version 4

Feature: Firm isolation

  Scenario: A consultant cannot read another firm's client
    Given firm A has a client with a known id
    And I am a consultant in firm B
    When I request that client, its reports, or its dossiers by id
    Then every response is 404 and reveals nothing

  Scenario: A viewer cannot mutate
    Given I am a viewer in firm A
    When I attempt to create a client, run eligibility, or move a dossier
    Then each action is rejected server-side

  Scenario: A platform admin cannot read firm data
    Given I am a platform_admin who is not a member of firm A
    When I request firm A's clients
    Then the response is 404

Feature: Anonymous ownership

  Scenario: An anonymous report is private to its token
    Given an anonymous report created with token T1
    When a browser with token T2 opens the report URL
    Then the response is 404

  Scenario: Signing up claims anonymous data
    Given I completed the wizard anonymously
    When I sign up from the results page
    Then my profile and report are owned by my account
    And the anonymous token is rotated

Feature: Curation safety

  Scenario: Publishing a rule referencing an unknown profile field fails
    Given a draft version whose rule references field "turnover_eur"
    When the curator publishes it
    Then publishing is rejected with the unknown field named

  Scenario: Source change raises a review task, never edits rules
    Given a watched source page whose main text changed
    When the source-watch cron runs
    Then an open review task with a diff excerpt exists
    And the published programme version is unchanged

  Scenario: Watcher refuses non-allowlisted hosts
    Given a source watch URL on a host not in WATCH_ALLOWED_HOSTS
    When the watcher runs
    Then no request is made and a "fetch_failing" task records why

Feature: Dossier deadlines

  Scenario: Reminder at J-7
    Given an open dossier with a deadline 7 days from today
    When the deadlines cron runs
    Then the dossier owner receives one reminder email
    And a "reminder_sent" event is recorded
    And running the cron again the same day sends nothing
```

## 5. Golden Profiles per Programme
Each curated programme ships with ≥ 3 fixture profiles in `tests/fixtures/programs/<slug>.json` — one expected `eligible`, one `ineligible` (with expected reason ids), one `needs_info` (with expected missing fields). CI runs every published rule set against its fixtures. The admin **RuleDiffPreview** runs the same fixtures before publish, so curation and CI share one source of truth.

## 6. Adversarial Checklist
**Engine / DSL**
- [ ] Deeply nested rule trees (depth 50) — no stack issues, bounded depth enforced by schema
- [ ] `between` with inverted bounds; `in` with empty list; wrong value types rejected by Zod at publish
- [ ] Profile JSON with extra/unknown keys ignored, not evaluated

**Isolation**
- [ ] Every Cabinet route and action × {anonymous, other-firm member, viewer, platform_admin}
- [ ] Org switch in Clerk mid-session: stale `org_id` must not grant access
- [ ] `source_report_id` on a dossier pointing at another firm's report is rejected

**Public surface**
- [ ] Wizard spam: rate limit triggers; no report rows created past the limit
- [ ] Alert subscription with someone else's email: nothing sent until confirmation link clicked
- [ ] XSS payloads in admin Markdown content are sanitised on programme pages

**Watcher**
- [ ] Redirect to a private IP / non-allowlisted host blocked
- [ ] 200 with a cookie-wall page doesn't register as a content change (normalisation)
- [ ] Timeouts recorded as `fetch_failing`, not as change

## 7. Release Gate Criteria
- [ ] All acceptance scenarios pass
- [ ] Coverage ≥ 80% combined; `lib/engine/` 100% branches
- [ ] Firm isolation suite green — never waived
- [ ] Every published programme passes its golden profiles
- [ ] axe: zero serious/critical violations on wizard, results, programme page, board (FR and AR)
- [ ] No critical/high findings from Semgrep, Trivy, Gitleaks
- [ ] E2E journeys pass and are recorded to `.recordings/` (CTS rule 9)
