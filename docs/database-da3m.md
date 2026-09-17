# Database Design: Da3m.ma
**Architecture Reference**: docs/architecture-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: DBA

## 1. Database Selection
- **Engine**: PostgreSQL 16 (Neon). JSONB for rule trees, profiles and report results.
- **Rationale**: YAGNI default; relational core (firms, clients, dossiers) + document-shaped rules fit Postgres cleanly. No pgvector needed.
- **ORM**: Drizzle; migrations generated and committed.

## 2. Entity-Relationship Model
```
programs --1:N--> program_versions
programs --1:N--> source_watches --1:N--> review_tasks

profiles --1:N--> eligibility_reports
profiles --1:N--> alert_subscriptions

organizations --1:N--> memberships
organizations --1:N--> clients --1:N--> eligibility_reports
organizations --1:N--> dossiers  (client_id, program_id)
dossiers --1:N--> dossier_events
```

## 3. Schema Design
```sql
-- ===== Catalogue (platform-owned, not tenant-scoped) =====
CREATE TYPE program_kind   AS ENUM ('grant','loan','guarantee','equity','advance','support');
CREATE TYPE program_status AS ENUM ('open','closed','upcoming','rolling');

CREATE TABLE programs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,              -- 'intelaka', 'forsa'
  operator      TEXT NOT NULL,                     -- 'Tamwilcom', 'Maroc PME'
  kind          program_kind NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE program_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  status          program_status NOT NULL,
  opens_at        DATE,
  closes_at       DATE,
  amount_min_mad  NUMERIC(14,2),
  amount_max_mad  NUMERIC(14,2),
  rules           JSONB NOT NULL,                  -- ADR-2 rule tree
  documents       JSONB NOT NULL DEFAULT '[]',     -- [{id, label: {fr,ar,en}}]
  content         JSONB NOT NULL,                  -- {fr:{title,summary_md}, ar:{...}, en:{...}}
  source_url      TEXT NOT NULL,
  application_url TEXT,
  verified_at     DATE NOT NULL,
  verified_by     TEXT NOT NULL,                   -- clerk user id of curator
  published_at    TIMESTAMPTZ,                     -- NULL = draft
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, version)
);
-- exactly one published "current" version per programme is resolved as
-- max(version) WHERE published_at IS NOT NULL

CREATE TABLE source_watches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  css_selector    TEXT,                            -- main-content override
  last_hash       TEXT,
  last_text       TEXT,                            -- for diffing
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  last_error      TEXT,
  UNIQUE (program_id, url)
);

CREATE TYPE review_status AS ENUM ('open','resolved_changed','resolved_no_change');
CREATE TABLE review_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  watch_id      UUID REFERENCES source_watches(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,                     -- 'source_changed' | 'reverify_due' | 'fetch_failing'
  diff_excerpt  TEXT,
  status        review_status NOT NULL DEFAULT 'open',
  resolved_by   TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== B2C =====
CREATE TABLE profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_token_hash TEXT UNIQUE,                     -- sha256 of cookie token; never the raw token
  owner_user_id  TEXT,                             -- set when claimed
  data           JSONB NOT NULL,                   -- validated by profile schema (ADR-6)
  schema_version INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (anon_token_hash IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE TABLE alert_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,                        -- double opt-in
  unsubscribed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, email)
);

-- ===== Cabinet (tenant-scoped) =====
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id  TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'trial',     -- 'trial' | 'solo' | 'cabinet'
  plan_renews_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  clerk_user_id  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('owner','consultant','viewer')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, clerk_user_id)
);

CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  profile       JSONB NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL,
  archived_at   TIMESTAMPTZ,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Reports (shared by B2C and Cabinet; immutable) =====
CREATE TABLE eligibility_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  engine_version  TEXT NOT NULL,
  input_snapshot  JSONB NOT NULL,
  results         JSONB NOT NULL,   -- [{program_id, program_version_id, outcome, failing:[..], missing:[..]}]
  eligible_count  INTEGER NOT NULL,
  created_by      TEXT,             -- null for anonymous
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ( (profile_id IS NOT NULL AND org_id IS NULL AND client_id IS NULL)
       OR (profile_id IS NULL AND org_id IS NOT NULL AND client_id IS NOT NULL) )
  -- no updated_at: reports are immutable (ADR-4)
);

CREATE TYPE dossier_stage AS ENUM
  ('to_prepare','documents_collected','submitted','under_review','approved','rejected');

CREATE TABLE dossiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES programs(id),
  source_report_id UUID REFERENCES eligibility_reports(id) ON DELETE SET NULL,
  stage           dossier_stage NOT NULL DEFAULT 'to_prepare',
  owner_user_id   TEXT NOT NULL,
  deadline        DATE,
  checklist       JSONB NOT NULL DEFAULT '{}',     -- {document_id: true|false}
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dossier_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id  UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  type        TEXT NOT NULL,               -- 'stage_changed' | 'deadline_set' | 'checklist_updated' | 'reminder_sent'
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
`dossier_events.org_id` is denormalised on purpose: every tenant table carries `org_id` so the isolation predicate never needs a join.

## 4. Index Strategy
| Table | Index Name | Columns | Query Pattern |
|---|---|---|---|
| program_versions | idx_pv_current | (program_id, version DESC) WHERE published_at IS NOT NULL | Resolve current published version |
| review_tasks | idx_review_open | (status, created_at) WHERE status = 'open' | Curation queue |
| profiles | idx_profiles_owner | (owner_user_id) | Signed-in user's profiles |
| alert_subscriptions | idx_alerts_active | (profile_id) WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL | Alert fan-out |
| memberships | idx_memberships_user | (clerk_user_id) | Resolve actor's firms |
| clients | idx_clients_org | (org_id, archived_at, display_name) | Client list |
| eligibility_reports | idx_reports_profile | (profile_id, created_at DESC) | B2C history |
| eligibility_reports | idx_reports_client | (org_id, client_id, created_at DESC) | Client report history |
| dossiers | idx_dossiers_board | (org_id, stage, deadline) | Pipeline board |
| dossiers | idx_dossiers_deadline | (deadline) WHERE stage NOT IN ('approved','rejected') | Reminder cron |
| dossier_events | idx_events_dossier | (dossier_id, created_at) | Audit timeline |

## 5. Migration Plan
| Migration File | Description | Reversible |
|---|---|---|
| 0001_extensions_enums | pgcrypto, enums | Yes |
| 0002_catalog | programs, program_versions, source_watches, review_tasks | Yes |
| 0003_b2c | profiles, alert_subscriptions | Yes |
| 0004_cabinet | organizations, memberships, clients, dossiers, dossier_events | Yes |
| 0005_reports | eligibility_reports | Yes |
| 0006_indexes | Section 4 | Yes |
| 0007_seed_programs | first curated programmes (Sprint 2) | Yes |

## 6. Access Patterns
| Use Case | Query Pattern | Index Coverage |
|---|---|---|
| Load published catalogue | latest published version per programme | idx_pv_current |
| Show my B2C results | reports by profile | idx_reports_profile |
| Firm client list | clients by org, not archived | idx_clients_org |
| Pipeline board | dossiers by org grouped by stage | idx_dossiers_board |
| Deadline reminders | open dossiers with deadline in J-7/J-2 | idx_dossiers_deadline |
| Alert fan-out after publish | confirmed subscriptions for profiles whose latest report included the programme | idx_alerts_active + idx_reports_profile |

## 7. Sensitive Data
- **Personal data**: `profiles.data`, `clients.profile`, `clients.display_name/contact_*`, `alert_subscriptions.email`. Bands, not raw values, per security baseline §5.
- **Anon token**: stored only as SHA-256 hash.
- **Row-level security**: not enabled in Postgres (identity lives in Clerk); isolation enforced by `Actor` repositories + CI isolation suite. The trade-off is deliberate and makes the repository layer security-critical.
- **Purge**: weekly cron deletes profiles with `owner_user_id IS NULL AND updated_at < now() - interval '24 months'` (cascades to reports and alerts).
