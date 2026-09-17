import { createHash } from "node:crypto";
import { parse } from "node-html-parser";

/**
 * Turns a page into stable, comparable text: only the main content, with scripts, styles
 * and page chrome removed and whitespace normalised. A change in this text is what the
 * watcher reports; a change anywhere else on the page is noise.
 */

const CHROME = "nav, header, footer, aside, form, iframe, svg, template, [aria-hidden=true]";
const MAIN_CANDIDATES = ["main", "article", "[role=main]", "body"];

export type ExtractResult = { ok: true; text: string } | { ok: false; reason: string };

export function normaliseText(text: string): string {
  return text
    .replace(/[  -​  　]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function extractMainText(html: string, cssSelector?: string | null): ExtractResult {
  const root = parse(html, {
    blockTextElements: { script: false, style: false, noscript: false, pre: true },
  });

  let container;
  if (cssSelector) {
    try {
      container = root.querySelector(cssSelector);
    } catch {
      return { ok: false, reason: `Invalid CSS selector: ${cssSelector}` };
    }
    if (!container) return { ok: false, reason: `Selector matched nothing: ${cssSelector}` };
  } else {
    container = MAIN_CANDIDATES.map((s) => root.querySelector(s)).find(Boolean) ?? root;
  }

  container.querySelectorAll(CHROME).forEach((node) => node.remove());
  const text = normaliseText(container.structuredText);
  return text ? { ok: true, text } : { ok: false, reason: "Page has no readable text" };
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
