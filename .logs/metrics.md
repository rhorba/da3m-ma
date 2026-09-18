# Project Metrics
<!-- KPI snapshots over time -->
<!-- Format: ### [YYYY-MM-DD HH:MM] SPRINT_SNAPSHOT/DAILY_SNAPSHOT — Title -->


### [2026-09-17 14:15] [METRICS] — Sprint 1 verify
- Unit + integration: 46 passed / 46 (6 files)
- Coverage (combined): statements 89.51%, branches 86.48%, functions 85.71%, lines 93.75% — gate 80% PASS
- E2E: 14 passed / 14 (desktop + mobile Chromium)
- Security: Semgrep 0, Trivy 0 CRITICAL/HIGH, Gitleaks 0 in repo
- Lint / typecheck / format: clean
- Build: /fr /ar /en statically prerendered

### [2026-09-17 16:40] [METRICS] — Sprint 2 checkpoint
- Tests: 206 passed / 206 (11 files)
- Coverage (combined): statements 96.67%, branches 95.49%, functions 92.85%, lines 98.09%
- lib/engine: 100% statements / branches / functions / lines (CI-enforced)

### [2026-09-17 19:20] [METRICS] — Sprint 2 verify
- Tests: 249 passed / 249 (15 files)
- Coverage (combined): statements 97.23%, branches 96.26%, functions 93.98%, lines 98.24%; lib/engine 100%
- E2E: 14 / 14
- Security: Semgrep 0, Trivy 0 HIGH/CRITICAL
- Catalogue: 10 drafts, 10 valid, 0 verified

### [2026-09-17 21:58] [METRICS] — Sprint 3 verify
- Tests: 343 passed / 343 (23 files)
- Coverage (combined): statements 97.37%, branches 96.14%, functions 94.68%, lines 98.40% — gate 80% PASS
- lib/engine: 100% statements / branches / functions / lines (CI-enforced, rank.ts included)
- E2E: 12 / 12 (desktop + mobile Chromium) — wizard, adaptive skip, resumption, results grouping, inline question, report isolation
- Lint / typecheck / format: clean
- Build: /fr /ar /en and /eligibilite prerendered static; /resultats/[id] dynamic (ADR-7 holds)
- Security review: reports scoped to profile owner (404 otherwise), results noindex + force-dynamic, rate limit charged before any write, anon cookie HttpOnly/SameSite=Lax/hashed at rest, catalogue URLs https-validated at publish (publish-validation.ts:93,99) before reaching an href

### [2026-09-17 22:55] [METRICS] — Sprint 4 partial (4.1, 4.2, 4.5) verify
- Tests: 353 passed / 353 (24 files)
- Coverage (combined): statements 97.16%, branches 95.80%, functions 94.35%, lines 98.14% — gate 80% PASS
- lib/engine: 100% (CI-enforced)
- E2E: 50 / 50 (desktop + mobile Chromium) — wizard, results, programme pages, catalogue filters, sitemap, robots
- Lint / typecheck / format: clean
- Build: /programmes prerendered per locale (1h ISR), /programmes/[slug] on demand (1h), sitemap + robots static

### [2026-09-18 00:20] [METRICS] — Story 4.7 accessibility half
- Tests: 381 passed / 381 (26 files)
- Coverage (combined): statements 97.18%, branches 95.80%, functions 94.41%, lines 98.16%
- E2E: 94 / 94 (desktop + mobile Chromium), of which 44 accessibility assertions
- Contrast: every documented ratio asserted for both themes; 3 dark-mode AA failures found and fixed
- Semgrep (run locally before push): 0 findings on 152 targets
