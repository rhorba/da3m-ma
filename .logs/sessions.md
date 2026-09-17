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
