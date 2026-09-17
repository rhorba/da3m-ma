import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadCatalogue } from "@/lib/catalog";
import { parseAllowedHosts } from "@/lib/curation";

// Every curated programme in data/programs must be publishable and pass its golden
// profiles. This is the CI gate for catalogue-as-code (ADR-8, test strategy §5).

function documentedAllowlist(): Set<string> {
  const line = readFileSync(".env.example", "utf8")
    .split("\n")
    .find((l) => l.startsWith("WATCH_ALLOWED_HOSTS="));
  return parseAllowedHosts(line?.slice("WATCH_ALLOWED_HOSTS=".length));
}

describe("curated catalogue", async () => {
  const catalogue = await loadCatalogue({
    today: new Date().toISOString().slice(0, 10),
    allowedHosts: documentedAllowlist(),
  });

  it("has no invalid programme files", () => {
    expect(catalogue.invalid).toEqual([]);
  });

  it("contains at least one programme", () => {
    expect(catalogue.valid.length).toBeGreaterThan(0);
  });
});
