import { migrateDownAll, migrateUp } from "../lib/db/migrate";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI provides env directly).
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required");
  process.exit(1);
}

const direction = process.argv[2] ?? "up";

if (direction === "up") {
  await migrateUp(url);
  console.log("Migrations applied.");
} else if (direction === "down") {
  await migrateDownAll(url);
  console.log("All migrations rolled back.");
} else {
  console.error(`Unknown direction "${direction}". Use "up" or "down".`);
  process.exit(1);
}
