# Session Log
<!-- Tracks session starts and ends for resumption -->
<!-- Format: ### [YYYY-MM-DD HH:MM] SESSION_START/SESSION_END -->


### [2026-09-17 10:50] SESSION_START
- Focus: Da3m.ma foundation docs (pivot from Diwana)

### [2026-09-17 14:50] SESSION_END
- Completed: Da3m.ma foundation docs (approved); Sprint 1 stories 1.1–1.5 shipped, CI green (afcf459).
- In progress: nothing.
- Blocked: Sprint 2 curation console + admin actor need Clerk keys in .env.local (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET) and an org:viewer custom role in the Clerk dashboard.
- Next: Sprint 2 (2.1 profile schema, 2.2 rule DSL, 2.3 curation console, 2.4 source watcher, 2.5 curate first 10 programmes with the user as curator). User-owned: consultant conversations before Sprint 5; CNDP before public beta.

### [2026-09-17 19:50] SESSION_END
- Completed: Sprint 2 — engine (3.1 pulled forward), profile contract, rule DSL + publish validation, source watcher + cron, catalogue as code (ADR-8, replaces the admin console), 10 draft programmes from official sources. CI green (ebdd50d).
- In progress: nothing in code.
- Blocked on user: verify the 10 drafts in data/programs/ (docs/curation-guide.md); Clerk keys still empty (needed from Sprint 4 /mon-espace onward, not Sprint 3); decide on Bourse de vie (3 extra personal fields).
- Next: Sprint 3 — 3.2 ranking, 3.3 immutable reports + anon token, 3.4 wizard UI (shadcn init), 3.5 results + inline questions, 3.6 rate limiting. Wizard must ask the new profile fields (innovation_stage, has_partner_support, exports_to_africa, has_intelaka_loan...).
- Open issues: marocpme.gov.ma TLS chain (NODE_EXTRA_CA_CERTS), forsa.ma 403, hourly cron needs Vercel Pro.

### [2026-09-17 20:05] SESSION_START
- Focus: resumption after Sprint 2 SHIP (ebdd50d, CI green). Candidate: Sprint 3 — 3.2 ranking, 3.3 immutable reports + anon token, 3.4 wizard UI, 3.5 results + inline questions, 3.6 rate limiting.
- Carried blockers (user-owned): verify 10 catalogue drafts; Bourse de vie decision; Clerk keys (not needed until Sprint 4).

### [2026-09-17 23:30] SESSION_END
- Completed: Sprint 3 in full (3.2 ranking, 3.3 immutable reports + anon token, 3.4 wizard UI, 3.5 results + inline questions, 3.6 rate limiting) — CI green 333d13a. Sprint 4 partial (4.1 programme pages + SEO, 4.2 catalogue with filters, 4.5 document checklists) — CI red on 28115ee (Semgrep: JSON-LD injection), fixed and green on e289a08.
- State: 358 tests, 97.2% statements / 95.8% branches, lib/engine 100%. 50 E2E on desktop + mobile. Public surface complete: home → wizard → results → programme pages → catalogue, in FR/AR/EN with sitemap and robots.
- Blocked on user (unchanged, now the only thing between here and public beta):
  1. Verify the 10 catalogue drafts in data/programs/ (docs/curation-guide.md). Until then the live catalogue page correctly shows "aucun programme publié".
  2. Clerk keys — needed for 4.3 (sign-up claims anonymous data).
  3. Resend key + SPF/DKIM/DMARC on da3m.ma — needed for 4.4 (alerts).
  4. Curate the remaining ~15 programmes (4.6) and a native Arabic reader pass (4.7).
  5. Upstash before public beta — swap the in-process limiter (ADR-9).
- Next session: 4.3/4.4 once keys exist, or 4.7's a11y half (needs @axe-core/playwright, blocked by .npmrc minimum-release-age until ~21 Sept).
- Local environment notes: throwaway postgres container `da3m-dev-db` on port 5435 (compose still says 5433, taken by restoledger); .env.local points at 5435. `rm -rf .next` before each build under OneDrive. `jq` is absent — use `gh --jq`.
