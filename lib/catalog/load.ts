import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RuleIssue } from "@/lib/engine";
import { validateCatalogueFile, type ValidCatalogueFile } from "./file-schema";

export const CATALOGUE_DIR = path.resolve(process.cwd(), "data", "programs");

export type LoadedCatalogue = {
  valid: ValidCatalogueFile[];
  invalid: { fileName: string; issues: RuleIssue[] }[];
};

export async function loadCatalogue(options: {
  dir?: string;
  today: string;
  allowedHosts: ReadonlySet<string>;
}): Promise<LoadedCatalogue> {
  const dir = options.dir ?? CATALOGUE_DIR;
  const fileNames = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const result: LoadedCatalogue = { valid: [], invalid: [] };

  for (const fileName of fileNames) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path.join(dir, fileName), "utf8"));
    } catch (error) {
      result.invalid.push({
        fileName,
        issues: [{ path: "(file)", message: `Invalid JSON: ${(error as Error).message}` }],
      });
      continue;
    }
    const validation = validateCatalogueFile(raw, { ...options, fileName });
    if (validation.ok) result.valid.push(validation.file);
    else result.invalid.push({ fileName, issues: validation.issues });
  }

  const slugs = result.valid.map((f) => f.slug);
  for (const slug of new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))) {
    result.invalid.push({
      fileName: `${slug}.json`,
      issues: [{ path: "slug", message: "Duplicate slug" }],
    });
  }
  return result;
}
