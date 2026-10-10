-- Reverses drizzle/0001_alerts.sql.
ALTER TABLE "alert_subscriptions" DROP COLUMN IF EXISTS "last_digest_at";
ALTER TABLE "alert_subscriptions" DROP COLUMN IF EXISTS "confirmation_sent_at";
ALTER TABLE "alert_subscriptions" DROP COLUMN IF EXISTS "locale";
