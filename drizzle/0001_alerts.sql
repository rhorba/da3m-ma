ALTER TABLE "alert_subscriptions" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_subscriptions" ADD COLUMN "confirmation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_subscriptions" ADD COLUMN "last_digest_at" timestamp with time zone;