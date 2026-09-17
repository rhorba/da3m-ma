import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { validateCatalogueFile } from "./file-schema";
import { loadCatalogue } from "./load";
import { exampleFile } from "../../tests/fixtures/catalogue";

const HOSTS = new Set(["www.tamwilcom.ma"]);
const TODAY = "2026-09-17";

const validate = (raw: unknown, fileName = "example-loan.json") =>
  validateCatalogueFile(raw, { fileName, today: TODAY, allowedHosts: HOSTS });

const messages = (raw: unknown, fileName?: string) => {
  const result = validate(raw, fileName);
  return result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`);
};

describe("validateCatalogueFile", () => {
  it("accepts a well-formed draft", () => {
    const result = validate(exampleFile());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.parsedRules.kind).toBe("criterion");
  });

  it("accepts a verified file with a verifier and date", () => {
    expect(
      validate(
        exampleFile({
          verification: { status: "verified", verifiedAt: "2026-09-16", verifiedBy: "rhorba" },
        }),
      ).ok,
    ).toBe(true);
  });

  it("rejects a verified file without a verifier", () => {
    expect(
      messages(
        exampleFile({
          verification: { status: "verified", verifiedAt: "2026-09-16", verifiedBy: null },
        }),
      ),
    ).toEqual(["verification: A verified programme needs verifiedAt and verifiedBy"]);
  });

  it("rejects a verification date in the future", () => {
    expect(
      messages(
        exampleFile({
          verification: { status: "verified", verifiedAt: "2026-10-01", verifiedBy: "rhorba" },
        }),
      ),
    ).toEqual(["version.verifiedAt: Verification date cannot be in the future"]);
  });

  it("requires the file name to match the slug", () => {
    expect(messages(exampleFile(), "other.json")).toEqual([
      "slug: File name must be example-loan.json",
    ]);
  });

  it("surfaces publish-validation issues under version.*", () => {
    const file = exampleFile();
    const bad = { ...file, version: { ...file.version, content: { fr: file.version.content.fr } } };
    expect(messages(bad).every((m) => m.startsWith("version.content"))).toBe(true);
  });

  it("requires golden profiles covering eligible, ineligible and needs_info", () => {
    const file = exampleFile();
    const onlyEligible = {
      ...file,
      goldenProfiles: [
        file.goldenProfiles[0],
        { ...file.goldenProfiles[0], name: "a" },
        { ...file.goldenProfiles[0], name: "b" },
      ],
    };
    expect(messages(onlyEligible)).toEqual([
      "goldenProfiles: Needs at least one golden profile expecting ineligible",
      "goldenProfiles: Needs at least one golden profile expecting needs_info",
    ]);
  });

  it("requires unique golden profile names", () => {
    const file = exampleFile();
    const dup = { ...file, goldenProfiles: [...file.goldenProfiles, file.goldenProfiles[0]] };
    expect(messages(dup)).toEqual(["goldenProfiles: Golden profile names must be unique"]);
  });

  it("fails when rules don't produce a golden profile's expected outcome", () => {
    const file = exampleFile();
    const wrong = {
      ...file,
      goldenProfiles: [
        { ...file.goldenProfiles[0], expected: "ineligible" },
        ...file.goldenProfiles.slice(1),
      ],
    };
    expect(messages(wrong)).toEqual([
      "goldenProfiles: Needs at least one golden profile expecting eligible",
      "goldenProfiles[young]: expected ineligible, got eligible",
    ]);
  });

  it("rejects watches outside the allowlist and a sourceUrl not listed in sources", () => {
    const file = exampleFile();
    expect(
      messages({ ...file, watches: [{ url: "https://example.org/x", cssSelector: null }] }),
    ).toEqual(["watches.0.url: Host not in WATCH_ALLOWED_HOSTS: example.org"]);
    expect(
      messages({
        ...file,
        sources: [{ url: "https://www.tamwilcom.ma/other", consultedAt: "2026-09-17" }],
      }),
    ).toEqual(["version.sourceUrl: sourceUrl must be one of the listed sources"]);
  });

  it("rejects unknown keys and malformed structure", () => {
    expect(validate(exampleFile({ extra: true })).ok).toBe(false);
    expect(validate({}).ok).toBe(false);
    expect(validate(exampleFile({ sources: [] })).ok).toBe(false);
  });
});

describe("loadCatalogue", () => {
  const dirs: string[] = [];
  afterAll(async () => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

  it("separates valid files from invalid JSON and invalid content", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "catalogue-"));
    dirs.push(dir);
    await writeFile(path.join(dir, "example-loan.json"), JSON.stringify(exampleFile()));
    await writeFile(path.join(dir, "broken.json"), "{ nope");
    await writeFile(path.join(dir, "wrong-name.json"), JSON.stringify(exampleFile()));
    await writeFile(path.join(dir, "notes.txt"), "ignored");

    const result = await loadCatalogue({ dir, today: TODAY, allowedHosts: HOSTS });
    expect(result.valid.map((f) => f.slug)).toEqual(["example-loan"]);
    expect(result.invalid.map((f) => f.fileName).sort()).toEqual([
      "broken.json",
      "wrong-name.json",
    ]);
    expect(result.invalid.find((f) => f.fileName === "broken.json")!.issues[0]!.message).toMatch(
      /Invalid JSON/,
    );
  });
});
