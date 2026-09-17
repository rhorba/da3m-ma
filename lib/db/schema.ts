import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Source of truth: docs/database-da3m.md §3–§4.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export type I18nText = { fr: string; ar?: string; en?: string };

// ===== Enums =====
export const programKind = pgEnum("program_kind", [
  "grant",
  "loan",
  "guarantee",
  "equity",
  "advance",
  "support",
]);
export const programStatus = pgEnum("program_status", ["open", "closed", "upcoming", "rolling"]);
export const reviewStatus = pgEnum("review_status", [
  "open",
  "resolved_changed",
  "resolved_no_change",
]);
export const dossierStage = pgEnum("dossier_stage", [
  "to_prepare",
  "documents_collected",
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);

export const MEMBERSHIP_ROLES = ["owner", "consultant", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

// ===== Catalogue (platform-owned, not tenant-scoped) =====
export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  operator: text("operator").notNull(),
  kind: programKind("kind").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const programVersions = pgTable(
  "program_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: programStatus("status").notNull(),
    opensAt: date("opens_at"),
    closesAt: date("closes_at"),
    amountMinMad: numeric("amount_min_mad", { precision: 14, scale: 2 }),
    amountMaxMad: numeric("amount_max_mad", { precision: 14, scale: 2 }),
    rules: jsonb("rules").$type<unknown>().notNull(),
    documents: jsonb("documents")
      .$type<{ id: string; label: I18nText }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    sourceUrl: text("source_url").notNull(),
    applicationUrl: text("application_url"),
    verifiedAt: date("verified_at").notNull(),
    verifiedBy: text("verified_by").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("program_versions_program_version_uq").on(t.programId, t.version),
    index("idx_pv_current")
      .on(t.programId, t.version.desc())
      .where(sql`${t.publishedAt} IS NOT NULL`),
  ],
);

export const sourceWatches = pgTable(
  "source_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    cssSelector: text("css_selector"),
    lastHash: text("last_hash"),
    lastText: text("last_text"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [unique("source_watches_program_url_uq").on(t.programId, t.url)],
);

export const reviewTasks = pgTable(
  "review_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    watchId: uuid("watch_id").references(() => sourceWatches.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    diffExcerpt: text("diff_excerpt"),
    status: reviewStatus("status").notNull().default("open"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "review_tasks_kind_chk",
      sql`${t.kind} IN ('source_changed', 'reverify_due', 'fetch_failing')`,
    ),
    index("idx_review_open")
      .on(t.status, t.createdAt)
      .where(sql`${t.status} = 'open'`),
  ],
);

// ===== B2C =====
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonTokenHash: text("anon_token_hash").unique(),
    ownerUserId: text("owner_user_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    schemaVersion: integer("schema_version").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "profiles_owner_chk",
      sql`${t.anonTokenHash} IS NOT NULL OR ${t.ownerUserId} IS NOT NULL`,
    ),
    index("idx_profiles_owner").on(t.ownerUserId),
  ],
);

export const alertSubscriptions = pgTable(
  "alert_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("alert_subscriptions_profile_email_uq").on(t.profileId, t.email),
    index("idx_alerts_active")
      .on(t.profileId)
      .where(sql`${t.confirmedAt} IS NOT NULL AND ${t.unsubscribedAt} IS NULL`),
  ],
);

// ===== Cabinet (tenant-scoped) =====
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"),
  planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: text("role").$type<MembershipRole>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("memberships_org_user_uq").on(t.orgId, t.clerkUserId),
    check("memberships_role_chk", sql`${t.role} IN ('owner', 'consultant', 'viewer')`),
    index("idx_memberships_user").on(t.clerkUserId),
  ],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    profile: jsonb("profile")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    schemaVersion: integer("schema_version").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_clients_org").on(t.orgId, t.archivedAt, t.displayName)],
);

// ===== Reports (shared by B2C and Cabinet; immutable — no updated_at, ADR-4) =====
export const eligibilityReports = pgTable(
  "eligibility_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    engineVersion: text("engine_version").notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull(),
    results: jsonb("results").$type<unknown[]>().notNull(),
    eligibleCount: integer("eligible_count").notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "eligibility_reports_owner_chk",
      sql`(${t.profileId} IS NOT NULL AND ${t.orgId} IS NULL AND ${t.clientId} IS NULL)
       OR (${t.profileId} IS NULL AND ${t.orgId} IS NOT NULL AND ${t.clientId} IS NOT NULL)`,
    ),
    index("idx_reports_profile").on(t.profileId, t.createdAt.desc()),
    index("idx_reports_client").on(t.orgId, t.clientId, t.createdAt.desc()),
  ],
);

export const dossiers = pgTable(
  "dossiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id),
    sourceReportId: uuid("source_report_id").references(() => eligibilityReports.id, {
      onDelete: "set null",
    }),
    stage: dossierStage("stage").notNull().default("to_prepare"),
    ownerUserId: text("owner_user_id").notNull(),
    deadline: date("deadline"),
    checklist: jsonb("checklist")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_dossiers_board").on(t.orgId, t.stage, t.deadline),
    index("idx_dossiers_deadline")
      .on(t.deadline)
      .where(sql`${t.stage} NOT IN ('approved', 'rejected')`),
  ],
);

export const dossierEvents = pgTable(
  "dossier_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dossierId: uuid("dossier_id")
      .notNull()
      .references(() => dossiers.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_events_dossier").on(t.dossierId, t.createdAt)],
);
