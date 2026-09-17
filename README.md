# Da3m.ma — دعم

**Trouvez les aides publiques auxquelles votre projet a vraiment droit.**
_Find the public funding your business actually qualifies for._

Da3m.ma matches Moroccan entrepreneurs and SMEs against business-funding programmes —
Intelaka, Forsa, Tamwilcom's Innov range, Maroc PME and more — and tells them not only
where they are eligible, but **why they are not** everywhere else. **Da3m Cabinet** gives
consultants and accountants a workspace to run every client through every programme and
track the resulting dossiers to their deadlines.

> Da3m.ma is an **independent tool**. It is not a government platform and is not affiliated
> with any agency or programme operator. Results are indicative; approval is decided solely
> by each programme's operator.

## Status
**Foundation phase — no product code yet.** Ten CTS foundation documents are written;
Sprint 1 starts after they are approved.

| Sprint | Scope | Status |
|---|---|---|
| Foundation | 10 expert docs | ✅ Written — awaiting approval |
| 1 | Scaffold, schema, Clerk orgs, Actor repositories, i18n | Not started |
| 2 | Programme catalogue, rule DSL, curation console, source watcher | Not started |
| 3 | Eligibility engine + wizard + results | Not started |
| 4 | Programme pages, alerts, AR pass → **public beta** | Not started |
| ⛔ | Consultant validation gate | — |
| 5 | Cabinet workspace | Not started |
| 6 | Billing + launch | Not started |

## Documentation
| Doc | Owner |
|---|---|
| [PRD](docs/prd-da3m.md) | Project Manager |
| [System Design](docs/system-design-da3m.md) | System Designer |
| [Architecture](docs/architecture-da3m.md) | Software Architect |
| [Security Baseline](docs/security-da3m.md) | Security Engineer |
| [Database Design](docs/database-da3m.md) | DBA |
| [UX Foundation](docs/ux-da3m.md) | UX Designer |
| [UI Foundation](docs/ui-da3m.md) | UI Designer |
| [Test Strategy](docs/test-strategy-da3m.md) | Test Architect |
| [DevOps Foundation](docs/devops-da3m.md) | DevOps/DevSecOps |
| [Epics & Stories](docs/stories-da3m.md) | Scrum Master |

## Planned stack
Next.js 15 · TypeScript · Drizzle · Neon Postgres · Clerk (organisations) · Tailwind + shadcn/ui ·
next-intl (FR / AR-RTL / EN) · Zod · Vitest + Playwright · Upstash · Resend · Sentry + PostHog · Vercel

## Working method
Built with the [CTS framework](CLAUDE.md): six mandatory phases, specialist handoffs,
append-only logs in `.logs/`, document-first development.
