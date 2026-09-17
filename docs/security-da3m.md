# Security Baseline: Da3m.ma
**Architecture Reference**: docs/architecture-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: Security Engineer

## 1. Threat Model (5-Minute)
- **What are we building?** A public eligibility engine plus a multi-firm workspace where consultants store profiles of their entrepreneur clients.
- **Who would attack it?** (1) A **competing consultancy** wanting another firm's client list and pipeline. (2) **Scrapers** copying our curated programme catalogue — that is our main asset. (3) Spammers abusing the free wizard and email alerts. (4) Phishers **impersonating a government "Daam" programme** using our brand.
- **Worst outcome?** A firm's client list (names, revenue bands, funding pipeline) exposed to another firm. Second worst: Da3m.ma used in a phishing scheme that collects fees or ID documents from people who believe it is a government aid portal.

## 2. STRIDE Analysis (top risks only)
| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Spoofing | Brand / phishing | We never ask for CIN, bank details or payment from B2C users; stated in the footer and on every results page; no government imagery | TODO |
| Spoofing | Cron + webhooks | `CRON_SECRET` constant-time check; Stripe/CMI/Svix signature verification | TODO |
| Tampering | Published rules | `program_versions` immutable once published; only `platform_admin` can publish; publish is audited | TODO |
| Tampering | Eligibility reports | Immutable rows; no update path exists in the repository | TODO |
| Repudiation | Dossier pipeline | `dossier_events` records who moved what and when | TODO |
| **Info Disclosure** | **Cabinet clients / dossiers** | **`Actor`-scoped repositories; `org_id` predicate on every query; isolation test suite CI-blocking** | TODO |
| Info Disclosure | Anonymous reports | Report readable only if the `anon_token` cookie matches; 404 (not 403) otherwise | TODO |
| Info Disclosure | Catalogue scraping | Rate limit on wizard and search; programme pages are public by design (SEO) — the moat is freshness and the Cabinet, not secrecy | Accepted |
| DoS | Wizard submit | Upstash rate limit per IP + anon token; Turnstile if abused | TODO |
| DoS | Alert emails | Double opt-in; per-address daily cap | TODO |
| Elevation of Privilege | Firm roles | `viewer` cannot mutate; `consultant` cannot manage members/billing; checked server-side per action | TODO |
| Elevation of Privilege | Admin console | `platform_admin` from Clerk private metadata only (not public/unsafe metadata); MFA required | TODO |
| **SSRF** | **Source watcher** | Fetch only `https` URLs whose host is on `WATCH_ALLOWED_HOSTS`; block private IP ranges after DNS resolution; no redirects off-allowlist | TODO |
| Stored XSS | Admin-authored programme content | Markdown rendered with sanitisation (`rehype-sanitize`); no raw HTML | TODO |

## 3. Authentication Strategy
- **Type**: Clerk-hosted sessions; organisations for firms.
- **MFA**: required for firm `owner` and `platform_admin`; optional otherwise.
- **Session management**: Clerk defaults (HttpOnly, Secure, SameSite=Lax). Not self-hosted Auth.js, so the Bina secure-cookie-prefix issue does not apply.
- **Anonymous B2C**: random 256-bit `anon_token` in an HttpOnly, Secure, SameSite=Lax cookie; 24-month expiry; rotated when claimed into an account.

## 4. Authorization Model
- **Pattern**: RBAC + ownership, expressed through a single `Actor` type (ADR-5).
- **Roles**:
  | Role | Scope | Can |
  |---|---|---|
  | anonymous | own `anon_token` | wizard, view own reports |
  | user | own profile | save profile, alerts, claim anon data |
  | firm `owner` | firm | everything in firm + members + billing |
  | firm `consultant` | firm | clients, reports, dossiers |
  | firm `viewer` | firm | read + export |
  | `platform_admin` | platform | curation console only — **no access to firm data** |
- **Resource-level checks**: yes, on every read and write. Note that `platform_admin` deliberately does **not** bypass firm isolation; support access, if ever needed, is a separate audited feature.

## 5. Data Protection
- **Personal data collected** (data minimisation, NFR-3):
  | Field | Stored as | Why |
  |---|---|---|
  | Founder age | **band** (18–25, 26–35, 36–45, 46+) | programme criteria use ranges |
  | Region | region code | regional programmes |
  | MRE status | boolean | MRE-specific programmes |
  | Revenue / employees | **bands** | size criteria |
  | Legal form, sector, company age | enums / months | criteria |
  | Client name + contact (Cabinet only) | text | the consultant's own client record |
- **Never collected**: CIN, date of birth, bank details, documents.
- **Encryption at rest**: Neon default. In transit: HTTPS + HSTS.
- **Secrets**: Vercel env vars; `.env.example` only in git; Gitleaks in CI.
- **Retention**: anonymous profiles/reports purged after 24 months; firm data deleted within 30 days of org deletion; users can delete their account and data (Law 09-08 right of deletion).
- **Sentry**: `beforeSend` scrubs profile payloads and client names.

## 6. Security Requirements for Dev Team
- [ ] Every server action validates input with Zod and resolves an `Actor` before touching data
- [ ] No repository function without an `Actor` parameter; no raw `db` outside repositories (lint-enforced)
- [ ] Missing / foreign resources return 404, never 403
- [ ] Programme content rendered through sanitised Markdown only
- [ ] Watcher enforces host allowlist + private-IP block + robots.txt
- [ ] Rate limits on wizard submit and alert subscription before public beta
- [ ] Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors 'none'
- [ ] Semgrep, Trivy, Gitleaks in CI

## 7. Legal / Compliance Posture
- **Law 09-08 / CNDP**: we process personal data about entrepreneurs (and, via Cabinet, consultants process their clients' data on our platform — we are a processor for that part). CNDP declaration required before public beta. **Administrative task for the user.**
- **Cabinet terms** must include a data-processing clause (firm = controller, Da3m = processor).
- **Non-affiliation**: independent tool, not a government platform, not affiliated with ANSS, Tamwilcom, Maroc PME or any agency; results are indicative and approval is decided solely by the operator of each programme.
