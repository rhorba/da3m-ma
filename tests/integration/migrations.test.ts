import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import postgres from "postgres";
import { migrateDownAll, migrateUp } from "@/lib/db/migrate";

// Story 1.2: migrations run up → down → up on an isolated database.

const EXPECTED_TABLES = [
  "alert_subscriptions",
  "clients",
  "dossier_events",
  "dossiers",
  "eligibility_reports",
  "memberships",
  "organizations",
  "profiles",
  "program_versions",
  "programs",
  "review_tasks",
  "source_watches",
];

const EXPECTED_INDEXES = [
  "idx_alerts_active",
  "idx_clients_org",
  "idx_dossiers_board",
  "idx_dossiers_deadline",
  "idx_events_dossier",
  "idx_memberships_user",
  "idx_profiles_owner",
  "idx_pv_current",
  "idx_reports_client",
  "idx_reports_profile",
  "idx_review_open",
];

const EXPECTED_ENUMS = ["dossier_stage", "program_kind", "program_status", "review_status"];

let admin: postgres.Sql;
let url: string;

async function publicObjects(sql: postgres.Sql) {
  const tables = await sql<{ name: string }[]>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY 1`;
  const indexes = await sql<{ name: string }[]>`
    SELECT indexname AS name FROM pg_indexes
    WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY 1`;
  const enums = await sql<{ name: string }[]>`
    SELECT t.typname AS name FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e' ORDER BY 1`;
  return {
    tables: tables.map((r) => r.name),
    indexes: indexes.map((r) => r.name),
    enums: enums.map((r) => r.name),
  };
}

beforeAll(async () => {
  const base = new URL(inject("databaseUrl"));
  admin = postgres(base.toString(), { max: 1 });
  await admin.unsafe("DROP DATABASE IF EXISTS migration_roundtrip");
  await admin.unsafe("CREATE DATABASE migration_roundtrip");
  base.pathname = "/migration_roundtrip";
  url = base.toString();
});

afterAll(async () => {
  await admin.unsafe("DROP DATABASE IF EXISTS migration_roundtrip WITH (FORCE)");
  await admin.end();
});

describe("migrations", () => {
  it("apply up, roll back to an empty schema, and apply up again", async () => {
    const sql = postgres(url, { max: 1 });
    try {
      await migrateUp(url);
      expect(await publicObjects(sql)).toEqual({
        tables: EXPECTED_TABLES,
        indexes: EXPECTED_INDEXES,
        enums: EXPECTED_ENUMS,
      });

      await migrateDownAll(url);
      expect(await publicObjects(sql)).toEqual({ tables: [], indexes: [], enums: [] });

      await migrateUp(url);
      expect((await publicObjects(sql)).tables).toEqual(EXPECTED_TABLES);
    } finally {
      await sql.end();
    }
  });

  it("enforces the report ownership check constraint", async () => {
    const sql = postgres(url, { max: 1 });
    try {
      await expect(
        sql`INSERT INTO eligibility_reports (engine_version, input_snapshot, results, eligible_count)
            VALUES ('test', '{}', '[]', 0)`,
      ).rejects.toThrow(/eligibility_reports_owner_chk/);
    } finally {
      await sql.end();
    }
  });

  it("rejects a membership role outside owner/consultant/viewer", async () => {
    const sql = postgres(url, { max: 1 });
    try {
      const [org] = await sql<{ id: string }[]>`
        INSERT INTO organizations (clerk_org_id, name) VALUES ('org_chk', 'Check') RETURNING id`;
      await expect(
        sql`INSERT INTO memberships (org_id, clerk_user_id, role) VALUES (${org!.id}, 'user_x', 'admin')`,
      ).rejects.toThrow(/memberships_role_chk/);
    } finally {
      await sql.end();
    }
  });
});
