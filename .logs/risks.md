# Risk Log
<!-- Tracks risks identified and their mitigations -->
<!-- Format: ### [YYYY-MM-DD HH:MM] SECURITY/PERFORMANCE/DEPENDENCY — Title -->


### [2026-09-17 11:50] [RISK] — Consultants may not pay for Cabinet
- Specialist: PM
- Summary: B2B revenue is an untested hypothesis (290 / 990 MAD per month).
- Status: open
- Impact: high
- Mitigation: Epic 5 gated on >= 3 consultant conversations; B2C ships independently.

### [2026-09-17 11:50] [RISK] — Programme rules go stale
- Specialist: Backend Dev
- Summary: Operators change criteria and application windows without notice.
- Status: open
- Impact: high
- Mitigation: versioned rules, verified_at on results, nightly source watcher, 30-day reverify tasks, golden profiles.

### [2026-09-17 11:50] [RISK] — Brand confused with government Daam programmes
- Specialist: PM
- Summary: Name overlaps Daam Sakane and similar; phishing impersonation possible.
- Status: open
- Impact: medium
- Mitigation: business-only scope, non-affiliation note on results, never collect CIN/bank/payment from B2C users, non-governmental identity.

### [2026-09-17 11:50] [RISK] — wafir.ma builds an eligibility engine
- Specialist: Creative Intelligence
- Summary: Existing SEO incumbent with a bank lead-gen model.
- Status: open
- Impact: medium
- Mitigation: ship the engine fast; the Cabinet workspace sits outside their model.
