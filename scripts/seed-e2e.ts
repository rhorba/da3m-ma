import path from "node:path";
import { createCatalogueSyncRepository, loadCatalogue } from "../lib/catalog";
import { createDatabase } from "../lib/db/client";

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
} finally {
  await handle.close();
}
