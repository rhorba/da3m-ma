import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");
const DOWN_DIR = path.join(MIGRATIONS_DIR, "down");

export async function migrateUp(url: string): Promise<void> {
  const handle = createDatabase(url, { max: 1 });
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await handle.close();
  }
}

/**
 * Drizzle Kit generates up-migrations only. Every up-migration has a hand-written
 * counterpart in drizzle/down/ with the same file name; this applies them newest-first
 * and clears Drizzle's journal so migrateUp() can run again.
 */
export async function migrateDownAll(url: string): Promise<void> {
  const files = (await readdir(DOWN_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  const handle = createDatabase(url, { max: 1 });
  try {
    for (const file of files) {
      const statements = await readFile(path.join(DOWN_DIR, file), "utf8");
      await handle.db.execute(statements);
    }
    await handle.db.execute("DROP SCHEMA IF EXISTS drizzle CASCADE");
  } finally {
    await handle.close();
  }
}
