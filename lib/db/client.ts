import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export type DatabaseHandle = {
  db: Database;
  close: () => Promise<void>;
};

export function createDatabase(url: string, options: { max?: number } = {}): DatabaseHandle {
  // prepare: false keeps us compatible with Neon's pooled (PgBouncer) endpoint.
  const client = postgres(url, { max: options.max ?? 10, prepare: false });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}

let shared: DatabaseHandle | undefined;

/** Process-wide handle for the running app. Tests create their own with createDatabase(). */
export function getDatabase(): Database {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    shared = createDatabase(url);
  }
  return shared.db;
}
