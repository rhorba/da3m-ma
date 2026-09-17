import { createCatalogueSyncRepository, loadCatalogue } from "../lib/catalog";
import { createCurationJobsRepository, parseAllowedHosts } from "../lib/curation";
import { createDatabase } from "../lib/db/client";

/**
 * Catalogue-as-code commands (ADR-8).
 *   pnpm catalogue:validate            validate every data/programs/*.json
 *   pnpm catalogue:sync                validate, then publish verified files as new versions
 *   pnpm catalogue:tasks               list open review tasks from the source watcher
 *   pnpm catalogue:resolve <id> changed|no-change --by <name>
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides env directly.
}

const [command, ...args] = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);
const allowedHosts = parseAllowedHosts(process.env.WATCH_ALLOWED_HOSTS);

function database() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  return createDatabase(url, { max: 1 });
}

async function validate() {
  const catalogue = await loadCatalogue({ today, allowedHosts });
  for (const file of catalogue.valid) {
    const status = file.verification.status === "verified" ? "verified" : "DRAFT   ";
    console.log(`✓ ${status} ${file.slug}`);
  }
  for (const { fileName, issues } of catalogue.invalid) {
    console.log(`✗ ${fileName}`);
    for (const issue of issues) console.log(`    ${issue.path}: ${issue.message}`);
  }
  return catalogue;
}

switch (command) {
  case "validate": {
    const catalogue = await validate();
    process.exit(catalogue.invalid.length > 0 ? 1 : 0);
  }
  case "sync": {
    const catalogue = await validate();
    if (catalogue.invalid.length > 0) {
      console.error("Refusing to sync: fix the invalid files first.");
      process.exit(1);
    }
    const handle = database();
    try {
      const summary = await createCatalogueSyncRepository(handle.db).sync(catalogue.valid);
      console.log(JSON.stringify(summary, null, 2));
    } finally {
      await handle.close();
    }
    break;
  }
  case "tasks": {
    const handle = database();
    try {
      const tasks = await createCurationJobsRepository(handle.db).listOpenTasks();
      if (tasks.length === 0) console.log("No open review tasks.");
      for (const task of tasks) {
        console.log(`\n[${task.kind}] ${task.slug}  ${task.id}`);
        if (task.url) console.log(`  ${task.url}`);
        if (task.diffExcerpt) console.log(task.diffExcerpt.replace(/^/gm, "  "));
      }
    } finally {
      await handle.close();
    }
    break;
  }
  case "resolve": {
    const [id, outcome] = args;
    const byIndex = args.indexOf("--by");
    const by = byIndex >= 0 ? args[byIndex + 1] : undefined;
    if (!id || (outcome !== "changed" && outcome !== "no-change") || !by) {
      console.error("Usage: pnpm catalogue:resolve <task-id> changed|no-change --by <name>");
      process.exit(1);
    }
    const handle = database();
    try {
      const resolution = outcome === "changed" ? "resolved_changed" : "resolved_no_change";
      const ok = await createCurationJobsRepository(handle.db).resolveTask(id, resolution, by);
      console.log(ok ? "Resolved." : "No open task with that id.");
      process.exitCode = ok ? 0 : 1;
    } finally {
      await handle.close();
    }
    break;
  }
  default:
    console.error("Usage: tsx scripts/catalogue.ts validate|sync|tasks|resolve");
    process.exit(1);
}
