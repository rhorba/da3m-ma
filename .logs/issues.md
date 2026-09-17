# Issue Log
<!-- Tracks bugs, errors, blockers with status -->
<!-- Format: ### [YYYY-MM-DD HH:MM] BUG/BLOCKER/ERROR — Title -->


### [2026-09-17 13:10] [ISSUE] — pnpm 10 does not hoist ESLint plugins
- Specialist: DevOps
- Summary: eslint-config-next could not load eslint-plugin-react-hooks. Fixed with public-hoist-pattern for *eslint* and *prettier* in .npmrc.
- Status: resolved
- Impact: low

### [2026-09-17 13:10] [ISSUE] — @clerk/nextjs verifyWebhook typed for NextRequest
- Specialist: Backend Dev
- Summary: Worked at runtime with a standard Request but failed typecheck. Switched to @clerk/backend/webhooks pinned to 3.18.1 (the version @clerk/nextjs already uses).
- Status: resolved
- Impact: low

### [2026-09-17 13:40] [ISSUE] — E2E assumed root always redirects to French
- Specialist: Tester
- Summary: next-intl negotiates Accept-Language; Playwright defaults to en-US. Behaviour is correct; tests now cover the French fallback (de-DE browser) and Arabic negotiation (ar-MA browser).
- Status: resolved
- Impact: low

### [2026-09-17 14:00] [SECURITY] — postcss 8.4.31 HIGH CVEs (CVE-2026-45623, CVE-2026-73646)
- Specialist: DevSecOps
- Summary: Pulled in by Next.js 15.5.25's exact pin. pnpm override postcss@<8.5.18 -> ^8.5.18; resolves to 8.5.28. Build, tests and E2E re-verified. Trivy clean.
- Status: resolved
- Impact: high

### [2026-09-17 14:10] [SECURITY] — Semgrep: 11 mutable action tags + missing npm release-age
- Specialist: DevSecOps
- Summary: All GitHub Actions pinned to commit SHAs; scanner Docker images pinned by digest (semgrep 1.176.1, trivy 0.74.0, gitleaks 8.30.1); .npmrc now delays resolution of versions published in the last 7 days. Semgrep 0 findings.
- Status: resolved
- Impact: medium

### [2026-09-17 14:05] [SECURITY] — Local Gitleaks flagged 9 items in .next/
- Specialist: DevSecOps
- Summary: All in gitignored Next.js build output (per-build preview/server-action keys). Not committed, not a leak. CI scans git only.
- Status: resolved (false positive for the repo)
- Impact: low

### [2026-09-17 15:20] [ISSUE] — minimumReleaseAge blocks every pnpm add
- Specialist: DevOps
- Summary: The 7-day release-age rule (Sprint 1 hardening) rejects re-resolution of 54 packages locked in Sprint 1 before the rule existed (zod, vitest, next-intl, vite, nan, @napi-rs/wasm-runtime...). Resolution: install new packages once with --config.minimum-release-age=0, each pinned to a version older than 7 days (fast-check 4.9.0, node-html-parser 9.0.4, robots-parser 3.0.1, diff 9.0.0), then re-scan the lockfile against the npm registry: 54 immature before, 54 after, zero newly introduced. The rule stays on; the Sprint 1 set matures by ~2026-09-24.
- Status: resolved (workaround)
- Impact: medium

### [2026-09-17 16:30] [BUG] — Watcher diff showed unchanged last line as removed/added
- Specialist: Backend Dev
- Summary: Normalised text has no trailing newline, so jsdiff treated the previous last line as changed when a line was appended. Caught by unit test; fixed by diffing with a trailing newline on both sides.
- Status: resolved
- Impact: low

### [2026-09-17 18:40] [ISSUE] — marocpme.gov.ma serves an incomplete TLS certificate chain
- Specialist: DevSecOps
- Summary: Node fetch fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE (curl on Windows succeeds because schannel fetches intermediates). Any watch on marocpme.gov.ma will raise fetch_failing.
- Status: open
- Impact: medium
- Fix path: supply the missing intermediate CA via NODE_EXTRA_CA_CERTS in the deployment. Do NOT disable TLS verification.

### [2026-09-17 18:40] [ISSUE] — forsa.ma returns 403 to the Da3m bot user agent
- Specialist: DevOps
- Summary: The site blocks our honestly identified crawler. We will not disguise the user agent.
- Status: open (accepted)
- Impact: low
- Consequence: Forsa must be curated manually; it cannot be watched automatically.

### [2026-09-17 18:50] [ISSUE] — Tamwilcom product detail URLs indexed by search engines return 404
- Specialist: PM
- Summary: tamwilcom.ma/fr/votre-projet/* pages (Damane Intelak, Programme Intelaka) no longer exist after a site restructuring; the current pages give summaries without thresholds. Intelaka thresholds were taken from official Ministry of Finance documents (2020) and Bank Al-Maghrib's Charte TPE (Dec 2025), and flagged as dated in each draft's notes.
- Status: resolved (documented in drafts)
- Impact: medium
