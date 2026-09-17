import { diffLines } from "diff";
import robotsParser from "robots-parser";
import { extractMainText, hashText } from "./extract";
import { guardUrl, type ResolveAll } from "./fetch-guard";

/**
 * Checks one watched source page (SDR-1, Story 2.4). It detects change and reports it;
 * it never modifies programme rules. Network access goes through the SSRF guard on
 * every hop, honours robots.txt, and identifies itself honestly.
 */

export const MAX_REDIRECTS = 3;
export const MAX_BYTES = 2_000_000;
export const TIMEOUT_MS = 20_000;
export const DIFF_EXCERPT_MAX = 4_000;

export type WatcherDeps = {
  fetch: typeof fetch;
  resolveAll: ResolveAll;
  allowedHosts: ReadonlySet<string>;
  userAgent: string;
};

export type WatchInput = {
  url: string;
  cssSelector: string | null;
  lastHash: string | null;
  lastText: string | null;
};

export type WatchOutcome =
  | { kind: "baseline"; hash: string; text: string }
  | { kind: "unchanged"; hash: string }
  | { kind: "changed"; hash: string; text: string; diffExcerpt: string }
  /** We chose not to fetch (allowlist, SSRF guard, robots.txt). */
  | { kind: "blocked"; reason: string }
  /** We tried and it didn't work (network, HTTP status, content). */
  | { kind: "error"; reason: string };

type FailedOutcome = Extract<WatchOutcome, { kind: "blocked" | "error" }>;

type FetchResult =
  { ok: true; body: string; contentType: string } | { ok: false; outcome: FailedOutcome };

async function readCapped(response: Response): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** GET with manual redirects, re-guarding every hop. */
async function guardedGet(rawUrl: string, deps: WatcherDeps, accept: string): Promise<FetchResult> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = await guardUrl(current, deps.allowedHosts, deps.resolveAll);
    if (!guard.ok) return { ok: false, outcome: { kind: "blocked", reason: guard.reason } };

    let response: Response;
    try {
      response = await deps.fetch(guard.url, {
        redirect: "manual",
        headers: { "user-agent": deps.userAgent, accept },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError" ? "Timed out" : "Network error";
      return { ok: false, outcome: { kind: "error", reason: `${reason} fetching ${current}` } };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location)
        return {
          ok: false,
          outcome: { kind: "error", reason: `Redirect without Location from ${current}` },
        };
      current = new URL(location, guard.url).toString();
      continue;
    }

    const body = await readCapped(response);
    if (body === null) {
      return {
        ok: false,
        outcome: { kind: "error", reason: `Response larger than ${MAX_BYTES} bytes` },
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        outcome: { kind: "error", reason: `HTTP ${response.status} from ${current}` },
      };
    }
    return { ok: true, body, contentType: response.headers.get("content-type") ?? "" };
  }
  return { ok: false, outcome: { kind: "error", reason: `More than ${MAX_REDIRECTS} redirects` } };
}

/** RFC 9309: an unavailable robots.txt (4xx) allows everything; an unreachable one (5xx, network) allows nothing. */
async function robotsAllows(url: URL, deps: WatcherDeps): Promise<WatchOutcome | null> {
  const robotsUrl = new URL("/robots.txt", url).toString();
  const result = await guardedGet(robotsUrl, deps, "text/plain");
  if (!result.ok) {
    const outcome = result.outcome;
    if (outcome.kind === "error" && /^HTTP 4\d\d/.test(outcome.reason)) return null;
    return { kind: "blocked", reason: `robots.txt unavailable, not fetching: ${outcome.reason}` };
  }
  const robots = robotsParser(robotsUrl, result.body);
  return robots.isAllowed(url.toString(), deps.userAgent) === false
    ? { kind: "blocked", reason: `Disallowed by robots.txt: ${url.pathname}` }
    : null;
}

export function diffExcerpt(before: string, after: string): string {
  const lines: string[] = [];
  // Compare with a trailing newline on both sides so an appended line doesn't also show
  // the unchanged previous last line as removed and re-added.
  for (const part of diffLines(
    `${before}
`,
    `${after}
`,
  )) {
    if (!part.added && !part.removed) continue;
    const prefix = part.added ? "+ " : "- ";
    for (const line of part.value.split("\n")) {
      if (line) lines.push(prefix + line);
    }
  }
  const excerpt = lines.join("\n");
  return excerpt.length > DIFF_EXCERPT_MAX ? `${excerpt.slice(0, DIFF_EXCERPT_MAX)}\n…` : excerpt;
}

export async function checkWatch(watch: WatchInput, deps: WatcherDeps): Promise<WatchOutcome> {
  const guard = await guardUrl(watch.url, deps.allowedHosts, deps.resolveAll);
  if (!guard.ok) return { kind: "blocked", reason: guard.reason };

  const robotsBlock = await robotsAllows(guard.url, deps);
  if (robotsBlock) return robotsBlock;

  const page = await guardedGet(watch.url, deps, "text/html");
  if (!page.ok) return page.outcome;
  if (!/text\/html|application\/xhtml\+xml/i.test(page.contentType)) {
    return { kind: "error", reason: `Unexpected content type: ${page.contentType || "none"}` };
  }

  const extracted = extractMainText(page.body, watch.cssSelector);
  if (!extracted.ok) return { kind: "error", reason: extracted.reason };

  const hash = hashText(extracted.text);
  if (watch.lastHash === null) return { kind: "baseline", hash, text: extracted.text };
  if (hash === watch.lastHash) return { kind: "unchanged", hash };
  return {
    kind: "changed",
    hash,
    text: extracted.text,
    diffExcerpt: diffExcerpt(watch.lastText ?? "", extracted.text),
  };
}
