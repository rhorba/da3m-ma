# System Design: Da3m.ma
**PRD Reference**: docs/prd-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: System Designer

## 1. Non-Functional Requirements
| Attribute | Target | Notes |
|---|---|---|
| Availability | 99.5% SLA | Advisory tool; no transactional criticality |
| Latency (p99) | 200ms engine run; programme pages served from CDN | ~25 programmes × ~10 criteria is trivial CPU |
| Throughput | 50 RPS peak (B2C), 5 RPS (Cabinet) | B2C spikes on media coverage and programme launches |
| Data Volume | < 2 GB in year one | Profiles and reports are small JSON rows |
| Retention | Reports: indefinite for Cabinet, 24 months for anonymous B2C | Anonymous data purged (privacy) |
| Recovery (RTO) | 4 hours | |
| Recovery (RPO) | 5 minutes | Neon PITR |

## 2. Component Topology
```
[Browser: FR / AR-RTL / EN]
        | HTTPS
        v
[Vercel CDN] --- static programme pages (ISR, revalidated on publish)
        |
        v
[Next.js 15 App Router on Vercel]
   |
   +-- (public)   wizard, results, programme pages
   +-- (account)  saved profile, alerts
   +-- (cabinet)  clients, dossiers, deadlines        <- Clerk org required
   +-- (admin)    programme versions, review queue    <- platform_admin only
   |
   +--> [Clerk] users + organisations (firms)
   +--> [Eligibility Engine] pure TS module, no I/O
   +--> [Repositories] --> [Neon Postgres]
   +--> [Upstash Redis] rate limit on public wizard
   +--> [Resend] alert + deadline emails

[Vercel Cron]
   +-- 02:00  source-watch   fetch source pages -> hash -> review_tasks
   +-- 07:00  deadlines      dossier reminders (J-7, J-2)
   +-- 08:00  alerts         programme changes -> subscribed profiles
   +-- 03:00 (weekly) purge  anonymous profiles > 24 months

[Observability: Sentry + PostHog]
```

## 3. Integration Patterns
| Integration | Pattern | Reason |
|---|---|---|
| Programme source sites | Scheduled polite fetch + content hash | Detect change only; never auto-edit rules from scraped text |
| Clerk | Users + Organisations, JWT with `org_id` and `org_role` | Firms map natively to Clerk orgs |
| Resend | Transactional email from cron jobs | Low volume; no queue needed |
| CMI / Stripe | Webhook → subscription state on the organisation | CMI for Moroccan cards |
| Search engines | Static programme pages + sitemap + hreflang | SEO is the B2C acquisition channel |

## 4. Scalability Strategy
- **Scaling approach**: serverless on Vercel. Programme pages are static, so B2C traffic spikes land on the CDN, not on functions.
- **Cache strategy**: the published programme catalogue is loaded once per function instance and keyed by `catalog_version`; invalidated on publish. No Redis cache needed for it.
- **Queue strategy**: none. Four cron jobs; each finishes in seconds at this data size (YAGNI).

## 5. System Design Decision Records

### SDR-1: The watcher detects change; humans change rules
- **NFR Driver**: result trustworthiness (PRD goal "results are trusted").
- **Decision**: The nightly watcher extracts main text, normalises it, hashes it, and raises a `review_task` with a text diff when the hash changes. It never modifies a rule.
- **Alternatives**: LLM extraction of criteria straight into published rules — rejected: an unreviewed hallucinated criterion would mislead real applicants. An LLM *summary of the diff* for the curator is allowed later (v1.1).
- **Re-evaluate when**: programme count exceeds what one curator can review (~150).

### SDR-2: Static programme pages, dynamic engine
- **NFR Driver**: 50 RPS spikes, SEO.
- **Decision**: Programme pages use ISR, revalidated on publish. Only the wizard submit and account/cabinet routes run functions.
- **Alternatives**: fully dynamic SSR — rejected: pays function cost on SEO traffic for content that changes weekly at most.

### SDR-3: One engine, two products
- **NFR Driver**: correctness (NFR-4), solo operator.
- **Decision**: B2C and Cabinet call the same `evaluate(profile, catalog)` function. Cabinet adds persistence and workflow around it, never different logic.
- **Alternatives**: separate "pro" engine with extra criteria — rejected: two sources of truth for eligibility.

### SDR-4: Anonymous-first B2C
- **NFR Driver**: wizard conversion (≥ 60%).
- **Decision**: Anonymous profile keyed by an HttpOnly random token cookie; claimed into the user's account on sign-up.
- **Alternatives**: require sign-up before results — rejected: kills the funnel and the SEO value.
- **Re-evaluate when**: abuse appears (then add Turnstile before results).
