# PRD: Da3m.ma (دعم)
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: PM | **Status**: Draft

## 1. Problem Statement
Moroccan entrepreneurs and SMEs routinely miss public funding they qualify for. More than 50 public and semi-public programmes exist — Intelaka, Tamwilcom's Innov range, Maroc PME's Forsa / Istitmar / Moussanada / Imtiaz, INDH, Go Siyaha, and others — each on its own portal, with its own criteria, opening windows and document lists. Nobody offers a single place to answer *"which of these do I actually qualify for, and why not the others?"* The ones who can answer are consultants and accountants, who do the matching by hand, client by client, and have no tool to manage the resulting dossiers.

## 2. Product Shape
Two products on one eligibility engine:

| | **Da3m Public** (B2C, free) | **Da3m Cabinet** (B2B, paid) |
|---|---|---|
| Who | Project holders, TPE/SME owners | Consultants, accountants, advisory firms |
| Job | "What am I eligible for?" | "Run every client through every programme, and track the dossiers" |
| Revenue | Acquisition + SEO + consultant referrals | Subscription per firm |

## 3. Goals & Success Metrics
| Goal | Metric | Target |
|---|---|---|
| The engine is useful | Completed profiles showing ≥ 1 eligible or likely-eligible programme | ≥ 70% |
| The wizard doesn't lose people | Wizard start → results | ≥ 60% |
| Results are trusted | Every rule with a `verified_at` ≤ 30 days old | 100% of published programmes |
| Source changes are caught | Source page change → review task raised | ≤ 24h |
| B2C builds an audience | Results → saved profile with alerts | ≥ 20% |
| B2B pays | Paying consultant firms, 90 days after Cabinet launch | ≥ 10 |
| B2B retains | Dossiers moved per paying firm per month | ≥ 8 |

## 4. User Stories
- [ ] As a **project holder**, I want to answer a short questionnaire and see which programmes I qualify for, so that I stop reading 20 different portals.
- [ ] As a **project holder**, I want to see *why* I'm not eligible for a programme, so that I know whether I could become eligible (e.g. "register your company first").
- [ ] As an **SME owner**, I want to be alerted when a programme opens or its rules change, so that I don't miss an application window.
- [ ] As an **SME owner**, I want the document checklist for a programme, so that I can prepare the application before the window closes.
- [ ] As a **consultant**, I want to add a client once and run them against every programme, so that matching takes seconds instead of an afternoon.
- [ ] As a **consultant**, I want a pipeline of dossiers by stage with deadlines, so that nothing slips across my 40 clients.
- [ ] As a **firm owner**, I want my team to share clients with role-based access, so that the firm works from one view.
- [ ] As the **platform curator**, I want to be told when a programme's source page changes, so that published rules never silently go stale.

## 5. Scope
### In Scope (v1.0)
- ~25 **business-funding** programmes, curated with machine-readable eligibility rules
- Eligibility wizard, tri-state results (eligible / needs more info / not eligible) with named reasons
- Per-programme SEO pages (FR/AR/EN)
- Document checklists per programme
- Saved profile + email alerts on programme open/close/rule change
- Consultant firm workspace: clients, per-client eligibility runs, dossier pipeline, deadlines and reminders, roles
- Internal curation console: programme versions, source-change review queue
- Subscription billing for Cabinet

### Out of Scope (v1.0)
- **Submitting applications** to any agency on anyone's behalf
- **Household / social aid** — Daam Sakane, ASD, etc. ANSS runs its own official simulator; we stay business-only. This also limits confusion with the government "Daam" programmes.
- Bank loan rate comparison (wafir.ma's lane — we link out, we don't compete)
- Private VC / angel matching
- Guaranteeing or predicting approval
- Document upload / storage for dossiers (v1.1 — checklist state only in v1)
- Mobile native apps (responsive web only)

## 6. Requirements
### Functional
- FR-1: A visitor can complete the eligibility wizard without an account.
- FR-2: The engine evaluates the profile against every published programme and returns each as `eligible`, `needs_info`, or `ineligible`.
- FR-3: Every `ineligible` result names the failing criteria; every `needs_info` result names the missing profile fields.
- FR-4: Every result shows the programme's source link and `verified_at` date.
- FR-5: Every eligibility report is stored immutably with the engine version and the programme version used, and is reproducible.
- FR-6: A signed-in user can save a profile and subscribe to alerts; alerts fire on programme open/close and on publication of a new rule version affecting a saved result.
- FR-7: Each programme has a public page with summary, amounts, criteria, documents, and official link, in FR/AR/EN.
- FR-8: A firm can create clients, run the engine per client, and create a dossier from any result.
- FR-9: Dossiers move through stages (`to_prepare → documents_collected → submitted → under_review → approved | rejected`), with a deadline and an owner; reminders are emailed before deadlines.
- FR-10: Firms have `owner / consultant / viewer` roles; firm data is isolated per firm.
- FR-11: A platform admin can edit programme versions, publish them, and resolve source-change review tasks.
- FR-12: A nightly watcher fetches each programme's source page, detects changes, and raises a review task.
- FR-13: Every results surface carries the disclaimer: independent tool, not a government platform, not affiliated with any agency, verify with the official source.

### Non-Functional
- NFR-1: Performance — full engine run across all programmes p99 < 200ms server-side; programme pages statically generated.
- NFR-2: Security — firm isolation enforced at the query layer; B2C profiles readable only by their owner.
- NFR-3: Privacy — data minimisation: no CIN, no bank details, no document files in v1. Law 09-08 compliant; CNDP declaration before public launch.
- NFR-4: Correctness — the engine is a pure module; 100% branch coverage.
- NFR-5: Accessibility — WCAG 2.1 AA; Arabic is fully translated copy with RTL, not mirrored French.
- NFR-6: Respectful crawling — the source watcher identifies itself honestly, obeys robots.txt, and fetches at most one page per host per minute.

## 7. Constraints & Assumptions
- **Name**: the user has chosen "Da3m.ma" knowing it overlaps with government programme names (Daam Sakane, etc.). Mitigation is product-side: business-only scope, explicit non-affiliation disclaimer (FR-13), no government colours, crests or logos.
- Programme data is **curated by hand** and assisted by the change watcher — there is no official API. Source sites probed 2026-09-17 (tamwilcom.ma, marocpme.gov.ma apex) are crawlable and not WAF-protected.
- Rules are modelled from published criteria; ambiguous criteria become `needs_info` questions rather than guesses.
- Solo developer: everything must be operable by one person.
- **Cabinet revenue is a hypothesis.** Pricing hypothesis to test: *Solo* 290 MAD/month (1 seat), *Cabinet* 990 MAD/month (5 seats). Reference point: tariq-ai.com charges 2,400 DH/yr per individual in the adjacent customs space.

## 8. Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Consultants won't pay for the workspace | M | High | ≥ 3 consultant conversations required before Epic 5 starts (gate); B2C ships independently of it |
| Programme rules change and results go stale | H | High | Versioned rules, `verified_at` on every result, nightly source watcher, 30-day re-verification SLA |
| Wrong eligibility result misleads a user | M | Medium | Tri-state logic (never guess — ask), named reasons, source link, disclaimer, no approval promises |
| wafir.ma builds a real eligibility engine | M | Medium | Move fast; Cabinet workspace is not in their bank-referral model |
| Users confuse Da3m.ma with a government "Daam" programme | M | Medium | Business-only scope, non-affiliation disclaimer, visual identity clearly non-governmental |
| Source sites block the watcher | L | Medium | Honest UA + robots.txt + low rate; degrade to manual re-verification reminders |
| Personal data exposure (revenue, age, MRE status of entrepreneurs) | L | High | Data minimisation, firm isolation, CNDP declaration, no files in v1 |

## 9. Timeline
| Milestone | Target Date |
|---|---|
| Foundation docs approved | 2026-09-18 |
| Sprint 1 — foundation | 2026-09-22 |
| Sprint 2 — programme data + watcher | 2026-09-29 |
| Sprint 3 — engine + wizard | 2026-10-06 |
| Sprint 4 — B2C surface → **public beta** | 2026-10-13 |
| Consultant validation gate (≥ 3 conversations) | 2026-10-13 |
| Sprint 5 — Cabinet workspace | 2026-10-24 |
| Sprint 6 — billing + launch | 2026-11-03 |
