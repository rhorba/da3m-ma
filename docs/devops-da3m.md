# DevOps Foundation: Da3m.ma
**Architecture**: docs/architecture-da3m.md
**Security**: docs/security-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: DevOps/DevSecOps

## 1. Environment Strategy
| Environment | Purpose | Deploy Trigger | Database |
|---|---|---|---|
| local | Development | `pnpm dev` | Docker Postgres 16 (`docker compose up db`) or Neon `dev` branch |
| preview | Per-PR review | Automatic on PR | Neon branch per PR (Vercel ↔ Neon integration), dropped on close |
| production | Live | Manual promote of `main` | Neon primary |

Crons run **only in production** (guarded by `VERCEL_ENV === "production"`), so previews never email real users or crawl sources.

## 2. CI Pipeline (GitHub Actions)
```yaml
jobs:
  lint:        pnpm lint && pnpm typecheck        # incl. no-restricted-imports (raw db ban)
  unit:        pnpm test:unit --coverage          # lib/engine branches must be 100%
  integration: pnpm test:integration              # Testcontainers Postgres; isolation suite
  fixtures:    pnpm test:programs                 # golden profiles vs seeded rules
  security:    semgrep ci --config p/owasp-top-ten --config p/typescript
               trivy fs --severity CRITICAL,HIGH --exit-code 1 .
               gitleaks detect --source . --exit-code 1
  build:       pnpm build
  e2e:         playwright against the Vercel preview URL (needs: build)
```
Coverage thresholds live in `vitest.config.ts` (global 80, `lib/engine/**` 100 branches) so the tool fails the build itself.
**CTS rule 11**: CI red after a push → stop, fix, push, repeat until green. Every check logged to `.logs/activity.md`.

## 3. Infrastructure
- **Hosting**: Vercel (Next.js + Cron)
- **Database**: Neon Postgres 16, PITR
- **Auth**: Clerk (users + organisations; Svix webhooks for membership sync)
- **Email**: Resend — domain `da3m.ma` with SPF, DKIM, DMARC before any alert is sent
- **Rate limiting**: Upstash Redis
- **Monitoring**: Sentry (errors + cron monitors), PostHog (funnels), Better Stack (uptime)
- **Package manager**: pnpm; Node 22 LTS

## 4. Security Scanning Gates
| Scanner | Scan Type | Fail Threshold |
|---|---|---|
| Semgrep | SAST | Any critical |
| Trivy | SCA | Critical/High CVEs |
| Gitleaks | Secrets | Any finding |
| ESLint custom rule | Raw `db` outside repositories | Any occurrence |
| Dependabot | Dependency updates | Weekly PRs |

## 5. Environment Variables (CTS rule 10)
Written to `.env.example`. **Values needed from the user before Sprint 1 EXECUTE** are marked 🔑.

| Variable | Purpose | Needed by |
|---|---|---|
| 🔑 `DATABASE_URL` | Neon pooled connection | Sprint 1 |
| 🔑 `DATABASE_URL_UNPOOLED` | Migrations | Sprint 1 |
| 🔑 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client | Sprint 1 |
| 🔑 `CLERK_SECRET_KEY` | Clerk server | Sprint 1 |
| 🔑 `CLERK_WEBHOOK_SIGNING_SECRET` | Org/membership sync | Sprint 1 |
| `CRON_SECRET` | Cron auth (generated, not provided) | Sprint 2 |
| `WATCH_ALLOWED_HOSTS` | Watcher host allowlist | Sprint 2 |
| `WATCH_USER_AGENT` | `Da3mBot/1.0 (+https://da3m.ma/bot)` | Sprint 2 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limits | Sprint 3 |
| `RESEND_API_KEY` | Alerts + reminders | Sprint 4 |
| `EMAIL_FROM` | `Da3m.ma <alertes@da3m.ma>` | Sprint 4 |
| `NEXT_PUBLIC_SITE_URL` | Canonicals, sitemap, email links | Sprint 4 |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | Errors + source maps | Sprint 6 |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | Analytics | Sprint 6 |
| `CMI_CLIENT_ID` / `CMI_STORE_KEY` | Moroccan card billing | Sprint 6 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | International billing | Sprint 6 |

Sprint 1 can start with **local Docker Postgres** if Neon isn't provisioned yet; only Clerk keys are strictly blocking.

## 6. Scheduled Jobs
| Job | Schedule (Africa/Casablanca) | Behaviour | Monitor |
|---|---|---|---|
| `source-watch` | 02:00 daily | Robots-aware, allowlisted, ≤ 1 req/host/min; hash main text; open review task on change | Sentry cron: alert if no success in 48h |
| `reverify-due` | 02:30 daily | Open `reverify_due` task for programmes with `verified_at` > 30 days | Sentry cron |
| `deadlines` | 07:00 daily | J-7 / J-2 reminders; idempotent via `dossier_events` | Sentry cron |
| `alerts` | 08:00 daily | Digest per confirmed subscriber of programme changes | Sentry cron |
| `purge` | Sun 03:00 | Delete unclaimed anon profiles > 24 months | Sentry cron |

Vercel cron schedules are UTC in `vercel.json`; Morocco is UTC+1 year-round except during Ramadan (UTC+0), so a one-hour drift is accepted — none of these jobs is time-critical.

## 7. Monitoring Baseline
| Signal | Tool | Alert Threshold |
|---|---|---|
| Errors | Sentry | > 5/min, or any error in `lib/engine/` |
| Cron health | Sentry cron monitors | Missed run > 48h |
| Stale catalogue | Admin dashboard + email | Any published programme `verified_at` > 30 days |
| Wizard funnel | PostHog | Start → results < 50% over 7 days |
| Email deliverability | Resend | Bounce > 5% or complaint > 0.1% |
| Latency | Vercel Analytics | Engine action p99 > 200ms |
| Uptime | Better Stack | < 99.5% monthly |

## 8. Backup & Recovery
- Neon PITR (RPO 5 min). Monthly restore drill into a Neon branch, logged to `.logs/activity.md`.
- No separate catalogue export job (YAGNI): PITR plus append-only `program_versions` already preserve every published rule. Revisit if curation volume grows.
