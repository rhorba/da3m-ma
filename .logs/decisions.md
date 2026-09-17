# Decision Log
<!-- Tracks architecture decisions, approach selections, tool choices -->
<!-- Format: ### [YYYY-MM-DD HH:MM] ARCHITECTURE/APPROACH/TOOL — Title -->


### [2026-09-17 11:05] [BRAINSTORM] — Da3m.ma scope
- Options presented: SIMPLE one-vertical engine / BALANCED engine + dossier builder + SEO / COMPREHENSIVE B2B2C with consultant workspace
- Selected: COMPREHENSIVE (recommendation was BALANCED)
- Rationale: user decision; consultants are the clearest revenue. Mitigation: engine and B2C ship first; Epic 5 gated on >= 3 consultant conversations.
- Status: resolved

### [2026-09-17 11:10] [DECISION] — Name kept as Da3m.ma
- Specialist: PM
- Summary: Ahliya.ma and Minha.ma were checked and found collision-free; user kept Da3m.ma. Mitigated via business-only scope, non-affiliation disclaimer (FR-13), non-governmental visual identity.
- Status: resolved

### [2026-09-17 11:50] [ARCHITECTURE] — Foundation decisions
- Specialist: System Designer + Software Architect + DBA + Security Engineer
- Summary: SDR-1 watcher detects change, humans change rules; SDR-2 static programme pages; SDR-3 one engine for B2C and Cabinet; SDR-4 anonymous-first wizard. ADR-1 modular monolith; ADR-2 typed JSON rule DSL with per-criterion reasons; ADR-3 three-valued logic (unknown -> needs_info); ADR-4 append-only programme versions, reports pin versions; ADR-5 Actor-based repositories, multi-tenant from 0001; ADR-6 versioned profile schema validated at publish.
- Status: resolved
- Impact: high

### [2026-09-17 14:20] [ARCHITECTURE] — ADR-7 Clerk only on signed-in routes
- Specialist: Software Architect + Security Engineer
- Summary: Public routes run next-intl middleware only and are statically generated; Clerk middleware/provider wrap /mon-espace, /cabinet, /admin when built. Public wizard always stores against the anonymous token; claimed on next /mon-espace visit (Story 4.3). Verified: build prerenders /fr /ar /en with no Clerk keys.
- Status: resolved
- Impact: medium

### [2026-09-17 14:20] [DECISION] — Clerk role mapping
- Specialist: Backend Dev
- Summary: org:admin/org:owner -> owner; org:member/org:consultant -> consultant; org:viewer -> viewer; unknown -> viewer (least privilege). An org:viewer custom role must be created in the Clerk dashboard. Firm access is resolved from our memberships table, never from the session org claim alone.
- Status: resolved

### [2026-09-17 16:40] [ARCHITECTURE] — ADR-2 amendment and watcher cadence
- Specialist: Software Architect + DevOps
- Summary: not() nodes carry id + reason; enum_set fields use in/not_in as overlap tests; operators restricted per field kind; depth checked before parsing. Source watcher moved from nightly to hourly with one request per host per run (NFR-6 without in-function sleeps).
- Status: resolved
