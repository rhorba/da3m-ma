# Architecture: Da3m.ma
**PRD Reference**: docs/prd-da3m.md
**System Design**: docs/system-design-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: Software Architect + Tech Lead

## 1. Overview
One Next.js 15 App Router application on Vercel with Neon Postgres. The eligibility engine is a pure module evaluating a typed rule DSL against a profile; everything else — public wizard, saved profiles, the Cabinet workspace and the curation console — is persistence and workflow around that one function.

## 2. Architecture Decision Records

### ADR-1: Modular monolith with enforced boundaries
- **Context**: Five concerns — catalogue, engine, profiles, cabinet, curation.
- **Decision**: One deployment. Modules `lib/catalog/`, `lib/engine/`, `lib/profiles/`, `lib/cabinet/`, `lib/curation/`, each exposing only `index.ts`. ESLint `no-restricted-imports` enforces it; raw `db` access is allowed only in `lib/*/repository.ts`.
- **Alternatives**: services — rejected at this scale for one operator.
- **Consequences**: Clear seams if Cabinet ever needs to split out.

### ADR-2: Eligibility rules as a typed JSON DSL, not code and not json-logic
- **Context**: Rules must be versioned in the database, edited by a curator, evaluated deterministically, and must explain *why* each fails.
- **Decision**: A small Zod-validated DSL. A programme's rules are a tree:
  ```ts
  type Rule =
    | { kind: "all"; rules: Rule[] }
    | { kind: "any"; rules: Rule[] }
    | { kind: "not"; rule: Rule }
    | { kind: "criterion"; id: string; field: ProfileField;
        op: "eq" | "neq" | "in" | "not_in" | "gte" | "lte" | "between" | "is_true" | "is_false";
        value?: unknown; reason: I18nText };
  ```
  Each `criterion` carries its own FR/AR/EN failure reason.
- **Alternatives**: json-logic — rejected: no per-criterion reasons and no notion of "unknown". Rules in TypeScript code — rejected: every rule change would need a deploy and couldn't be versioned per programme.
- **Consequences**: We own a ~150-line evaluator — which is exactly the code we test to 100%.

### ADR-3: Three-valued (Kleene) logic
- **Context**: Profiles are incomplete by design (short wizard). Guessing on missing data produces wrong answers.
- **Decision**: Each criterion evaluates to `pass | fail | unknown` (unknown when the field is absent). `all` → fail if any fail, else unknown if any unknown, else pass. `any` → pass if any pass, else unknown if any unknown, else fail. `not` swaps pass/fail, keeps unknown. Programme result: pass → `eligible`, unknown → `needs_info` (with the missing fields), fail → `ineligible` (with failing criteria reasons).
- **Alternatives**: treat missing as fail — rejected: tells people they're ineligible when we simply didn't ask.
- **Consequences**: The wizard can be adaptive later: ask only fields that turn `unknown` into a decision.

### ADR-4: Programme versions are append-only; reports pin versions
- **Context**: FR-5 reproducibility; rules change often.
- **Decision**: `program_versions` rows are immutable once published. An `eligibility_reports` row stores the input profile snapshot, `engine_version`, and for each programme the `program_version_id` and full result.
- **Alternatives**: mutable programmes — rejected: a consultant could not explain to a client why last month's report said "eligible".

### ADR-5: Tenancy — Clerk organisations for firms, user ownership for B2C
- **Context**: Two ownership models in one app.
- **Decision**: Cabinet tables carry `org_id NOT NULL`; B2C tables carry `owner_user_id` or `anon_token`. Repositories take an explicit `Actor` (`{ kind: "anon", token } | { kind: "user", userId } | { kind: "member", userId, orgId, role } | { kind: "admin", userId }`) and derive every predicate from it. Multi-tenant from migration 0001.
- **Alternatives**: single-tenant first — rejected (Moqawil lesson).
- **Consequences**: No repository function exists without an `Actor` parameter.

### ADR-6: Profile schema is a versioned, typed contract
- **Context**: Rules reference profile fields; renaming a field silently breaks rules.
- **Decision**: `ProfileField` is a TypeScript union generated from one Zod schema (`lib/engine/profile-schema.ts`). Publishing a programme version validates that every referenced field exists. Adding a field is backwards compatible; removing one requires a migration of affected rules.

### ADR-7: Clerk only on signed-in routes; public pages stay Clerk-free
*Added 2026-09-17 during Sprint 1.*
- **Context**: Clerk middleware and `ClerkProvider` need keys at runtime and turn pages dynamic. The public wizard, results and programme pages are the SEO and acquisition surface (SDR-2, SDR-4).
- **Decision**: Public routes run only next-intl middleware and are statically generated. Clerk middleware and `ClerkProvider` wrap only `/[locale]/mon-espace`, `/[locale]/cabinet` and `/[locale]/admin`, added when those routes are built. The public wizard always stores results against the anonymous token; a signed-in visitor's anonymous data is claimed on their next visit to `/mon-espace` (Story 4.3).
- **Alternatives**: Clerk on every route — rejected: every public page becomes dynamic, CI builds and E2E need real Clerk keys, and first load gets heavier for anonymous users who are the majority.
- **Consequences**: A signed-in user doesn't see personalised state on public pages. Accepted: nothing on those pages is personal. Verified in Sprint 1 — `next build` prerenders `/fr`, `/ar`, `/en` as static HTML with no Clerk keys present.

## 3. System Design
```
[Wizard submit] --server action--> profiles.upsert(actor, input)
                                   catalog.getPublished()        (cached per catalog_version)
                                   engine.evaluate(profile, catalog)   [pure]
                                   reports.create(actor, snapshot, results)
                                   -> redirect /resultats/[reportId]

[Cabinet: run client] -> same path with actor = member, client profile

[Admin publish] -> curation.publish(version) -> revalidatePath(program page)
                -> alerts.enqueueForAffectedProfiles(programId)   (row flag, picked by cron)

[Cron source-watch] -> fetch(url, robots-aware) -> extract text -> sha256
                    -> changed? review_tasks.create(diff)
```

## 4. Data Model
```
programs --1:N--> program_versions (append-only; one published at a time)
programs --1:N--> source_watches --1:N--> review_tasks

profiles (anon_token | owner_user_id) --1:N--> eligibility_reports
profiles --1:N--> alert_subscriptions

organizations --1:N--> memberships
organizations --1:N--> clients --1:1--> client profile (JSONB)
clients --1:N--> eligibility_reports (org_id set)
clients --1:N--> dossiers --N:1--> programs
dossiers --1:N--> dossier_events (audit trail)
```

## 5. API Design
Server Actions by default; Route Handlers only for webhooks, cron and exports.

| Method | Endpoint / Action | Description | Auth |
|---|---|---|---|
| action | `submitWizard` | Upsert profile, run engine, store report | Anyone (rate-limited) |
| GET | `/resultats/[id]` | View report | Owner (anon token or user) / firm member |
| action | `saveProfile`, `subscribeAlerts` | Claim anon profile, alerts | Signed-in user |
| GET | `/programmes/[slug]` | Programme page (static) | Public |
| action | `createClient`, `updateClient`, `runClientEligibility` | Cabinet clients | Member (consultant+) |
| action | `createDossier`, `moveDossier`, `setDeadline` | Dossier pipeline | Member (consultant+) |
| GET | `/api/v1/cabinet/clients/[id]/report.pdf` | Client report export | Member |
| action | `saveProgramVersion`, `publishProgramVersion`, `resolveReviewTask` | Curation | platform_admin |
| POST | `/api/cron/source-watch`, `/deadlines`, `/alerts`, `/purge` | Cron jobs | `CRON_SECRET` |
| POST | `/api/webhooks/billing` | CMI / Stripe events | Signature |
| POST | `/api/webhooks/clerk` | Org/membership sync | Svix signature |

## 6. Security Considerations
Full baseline in `docs/security-da3m.md`.
- AuthN: Clerk; AuthZ: `Actor`-based repositories + role checks per action.
- Personal data about entrepreneurs (age range, region, revenue band, MRE status) — minimised, isolated, never exported outside the owning firm.
- Admin-authored programme content is rendered from sanitised Markdown.
- Watcher fetches only allowlisted https domains (SSRF guard).

## 7. Infrastructure
- Hosting: Vercel (app + cron) · Database: Neon Postgres · Rate limiting: Upstash Redis · Email: Resend · Auth: Clerk · Monitoring: Sentry + PostHog · CI: GitHub Actions

## 8. Technical Risks
| Risk | Mitigation | Owner |
|---|---|---|
| Rule DSL can't express a real criterion | Model it as a `needs_info` boolean question ("Is your project located in a rural commune?") rather than bending the DSL | Tech Lead |
| Profile field rename breaks published rules | ADR-6 publish-time validation | Backend Dev |
| Cross-firm client leak | `Actor` repositories + isolation test suite, CI-blocking | Security Engineer |
| Anonymous report URLs guessed | UUIDv4 ids + anon token must match; no enumeration | Security Engineer |
| Watcher noise (dates, cookie banners change the hash) | Main-content extraction + normalisation; per-watch CSS selector override | Backend Dev |
