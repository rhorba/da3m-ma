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
