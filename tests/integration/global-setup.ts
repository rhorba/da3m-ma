import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { migrateUp } from "../../lib/db/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();
  await migrateUp(url);
  project.provide("databaseUrl", url);

  return async () => {
    await container.stop();
  };
}
