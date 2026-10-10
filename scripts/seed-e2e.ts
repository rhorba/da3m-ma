import path from "node:path";
import { createCatalogueSyncRepository, loadCatalogue } from "../lib/catalog";
import { createDatabase } from "../lib/db/client";
import { alertSubscriptions, profiles } from "../lib/db/schema";
import { E2E_ALERTS } from "../e2e/fixtures/alerts";

/**
 * Publishes the end-to-end fixture programmes (`pnpm e2e:seed`).
 *
 * They go through the same validation and sync path as the real catalogue, so the suite
 * exercises production code rather than hand-inserted rows. They live in e2e/fixtures so
 * they never mix with data/programs, and they are deliberately synthetic: the real
 * programmes are drafts until a human verifies them (ADR-8).
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides env directly.
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const dir = path.resolve(process.cwd(), "e2e", "fixtures", "programs");
const catalogue = await loadCatalogue({
  dir,
  today: new Date().toISOString().slice(0, 10),
  allowedHosts: new Set(["www.tamwilcom.ma"]),
});

if (catalogue.invalid.length > 0) {
  for (const { fileName, issues } of catalogue.invalid) {
    console.error(`✗ ${fileName}`);
    for (const issue of issues) console.error(`    ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}

const handle = createDatabase(url, { max: 1 });
try {
  const summary = await createCatalogueSyncRepository(handle.db).sync(catalogue.valid);
  console.log(
    `Seeded: ${summary.published.length} published, ${summary.unchanged.length} unchanged.`,
  );

  // Two alert subscriptions in known states, so the email-link pages can be driven end
  // to end without sending anything.
  const [profile] = await handle.db
    .insert(profiles)
    .values({ ownerUserId: E2E_ALERTS.userId, data: { legal_form: "sarl" }, schemaVersion: 1 })
    .returning({ id: profiles.id });
  for (const [id, confirmedAt] of [
    [E2E_ALERTS.pendingId, null],
    [E2E_ALERTS.activeId, new Date()],
  ] as const) {
    await handle.db
      .insert(alertSubscriptions)
      .values({ id, profileId: profile!.id, email: `${id}@example.com`, confirmedAt })
      .onConflictDoUpdate({
        target: alertSubscriptions.id,
        set: { confirmedAt, unsubscribedAt: null },
      });
  }
  console.log("Seeded: 2 alert subscriptions.");
} finally {
  await handle.close();
}
