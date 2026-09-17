CREATE TYPE "public"."dossier_stage" AS ENUM('to_prepare', 'documents_collected', 'submitted', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."program_kind" AS ENUM('grant', 'loan', 'guarantee', 'equity', 'advance', 'support');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('open', 'closed', 'upcoming', 'rolling');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('open', 'resolved_changed', 'resolved_no_change');--> statement-breakpoint
CREATE TABLE "alert_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"email" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_subscriptions_profile_email_uq" UNIQUE("profile_id","email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossier_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"dossier_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"source_report_id" uuid,
	"stage" "dossier_stage" DEFAULT 'to_prepare' NOT NULL,
	"owner_user_id" text NOT NULL,
	"deadline" date,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"org_id" uuid,
	"client_id" uuid,
	"engine_version" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"eligible_count" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eligibility_reports_owner_chk" CHECK (("eligibility_reports"."profile_id" IS NOT NULL AND "eligibility_reports"."org_id" IS NULL AND "eligibility_reports"."client_id" IS NULL)
       OR ("eligibility_reports"."profile_id" IS NULL AND "eligibility_reports"."org_id" IS NOT NULL AND "eligibility_reports"."client_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_user_uq" UNIQUE("org_id","clerk_user_id"),
	CONSTRAINT "memberships_role_chk" CHECK ("memberships"."role" IN ('owner', 'consultant', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"plan_renews_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_token_hash" text,
	"owner_user_id" text,
	"data" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_anon_token_hash_unique" UNIQUE("anon_token_hash"),
	CONSTRAINT "profiles_owner_chk" CHECK ("profiles"."anon_token_hash" IS NOT NULL OR "profiles"."owner_user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "program_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "program_status" NOT NULL,
	"opens_at" date,
	"closes_at" date,
	"amount_min_mad" numeric(14, 2),
	"amount_max_mad" numeric(14, 2),
	"rules" jsonb NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"source_url" text NOT NULL,
	"application_url" text,
	"verified_at" date NOT NULL,
	"verified_by" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_versions_program_version_uq" UNIQUE("program_id","version")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"operator" text NOT NULL,
	"kind" "program_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"watch_id" uuid,
	"kind" text NOT NULL,
	"diff_excerpt" text,
	"status" "review_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_tasks_kind_chk" CHECK ("review_tasks"."kind" IN ('source_changed', 'reverify_due', 'fetch_failing'))
);
--> statement-breakpoint
CREATE TABLE "source_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"url" text NOT NULL,
	"css_selector" text,
	"last_hash" text,
	"last_text" text,
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "source_watches_program_url_uq" UNIQUE("program_id","url")
);
--> statement-breakpoint
ALTER TABLE "alert_subscriptions" ADD CONSTRAINT "alert_subscriptions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_events" ADD CONSTRAINT "dossier_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_events" ADD CONSTRAINT "dossier_events_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_source_report_id_eligibility_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."eligibility_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_reports" ADD CONSTRAINT "eligibility_reports_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_reports" ADD CONSTRAINT "eligibility_reports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_reports" ADD CONSTRAINT "eligibility_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_watch_id_source_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."source_watches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_watches" ADD CONSTRAINT "source_watches_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alerts_active" ON "alert_subscriptions" USING btree ("profile_id") WHERE "alert_subscriptions"."confirmed_at" IS NOT NULL AND "alert_subscriptions"."unsubscribed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_clients_org" ON "clients" USING btree ("org_id","archived_at","display_name");--> statement-breakpoint
CREATE INDEX "idx_events_dossier" ON "dossier_events" USING btree ("dossier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dossiers_board" ON "dossiers" USING btree ("org_id","stage","deadline");--> statement-breakpoint
CREATE INDEX "idx_dossiers_deadline" ON "dossiers" USING btree ("deadline") WHERE "dossiers"."stage" NOT IN ('approved', 'rejected');--> statement-breakpoint
CREATE INDEX "idx_reports_profile" ON "eligibility_reports" USING btree ("profile_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reports_client" ON "eligibility_reports" USING btree ("org_id","client_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_memberships_user" ON "memberships" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_owner" ON "profiles" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_pv_current" ON "program_versions" USING btree ("program_id","version" DESC NULLS LAST) WHERE "program_versions"."published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_review_open" ON "review_tasks" USING btree ("status","created_at") WHERE "review_tasks"."status" = 'open';