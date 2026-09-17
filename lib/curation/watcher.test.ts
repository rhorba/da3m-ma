import { describe, expect, it, vi } from "vitest";
import { extractMainText, hashText, normaliseText } from "./extract";
import { checkUrl, guardUrl, isPublicAddress, parseAllowedHosts } from "./fetch-guard";
import { checkWatch, diffExcerpt, DIFF_EXCERPT_MAX, MAX_BYTES, type WatcherDeps } from "./watcher";

const HOST = "www.tamwilcom.ma";
const PAGE = `https://${HOST}/fr/intelaka`;
const ROBOTS = `https://${HOST}/robots.txt`;

const html = (main: string, noise = "") =>
  `<html><head><style>.x{}</style></head><body><nav>Menu ${noise}</nav><main>${main}</main>` +
  `<script>var t="${noise}"</script><footer>© ${noise}</footer></body></html>`;

type Route = { status?: number; body?: string; headers?: Record<string, string>; throws?: Error };

function fakeFetch(routes: Record<string, Route>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    const route = routes[url];
    if (!route)
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    if (route.throws) throw route.throws;
    return new Response(route.body ?? "", {
      status: route.status ?? 200,
      headers: { "content-type": "text/html; charset=utf-8", ...route.headers },
    });
  });
}

function deps(routes: Record<string, Route>, overrides: Partial<WatcherDeps> = {}): WatcherDeps {
  return {
    fetch: fakeFetch(routes) as unknown as typeof fetch,
    resolveAll: async () => ["196.200.1.10"],
    allowedHosts: new Set([HOST]),
    userAgent: "Da3mBot/1.0 (+https://da3m.ma/bot)",
    ...overrides,
  };
}

const robotsOk: Route = {
  body: "User-agent: *\nDisallow: /admin/\n",
  headers: { "content-type": "text/plain" },
};
const watch = (lastText: string | null = null) => ({
  url: PAGE,
  cssSelector: null,
  lastText,
  lastHash: lastText === null ? null : hashText(lastText),
});

describe("fetch guard", () => {
  it.each([
    ["10.0.0.5", false],
    ["172.16.4.1", false],
    ["192.168.1.1", false],
    ["127.0.0.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["::1", false],
    ["fd12::1", false],
    ["fe80::1", false],
    ["::ffff:10.0.0.1", false],
    ["not-an-ip", false],
    ["196.200.1.10", true],
    ["8.8.8.8", true],
    ["2a00:1450:4007::1", true],
    ["::ffff:8.8.8.8", true],
  ])("%s is public: %s", (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });

  it.each([
    ["http://www.tamwilcom.ma/x", /Only https/],
    ["https://user:pw@www.tamwilcom.ma/x", /credentials/],
    ["https://www.tamwilcom.ma:8443/x", /Non-default port/],
    ["https://evil.example/x", /not in WATCH_ALLOWED_HOSTS/],
    ["not a url", /Not a valid URL/],
  ])("rejects %s", (url, reason) => {
    const result = checkUrl(url, new Set([HOST]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });

  it("parses the allowlist case-insensitively and ignores blanks", () => {
    expect(parseAllowedHosts(" WWW.Tamwilcom.ma, ,marocpme.gov.ma ")).toEqual(
      new Set(["www.tamwilcom.ma", "marocpme.gov.ma"]),
    );
    expect(parseAllowedHosts(undefined).size).toBe(0);
  });

  it("blocks hosts resolving to any private address, or not resolving", async () => {
    const hosts = new Set([HOST]);
    expect((await guardUrl(PAGE, hosts, async () => ["196.200.1.10", "10.0.0.1"])).ok).toBe(false);
    expect((await guardUrl(PAGE, hosts, async () => [])).ok).toBe(false);
    expect(
      (await guardUrl(PAGE, hosts, async () => Promise.reject(new Error("ENOTFOUND")))).ok,
    ).toBe(false);
    expect((await guardUrl(PAGE, hosts, async () => ["196.200.1.10"])).ok).toBe(true);
  });
});

describe("text extraction", () => {
  it("keeps main content and drops scripts, styles and page chrome", () => {
    const result = extractMainText(
      html("<h1>Intelaka &amp; Forsa</h1><p>Taux&nbsp;: 2 %</p>", "12:05"),
    );
    expect(result).toEqual({ ok: true, text: "Intelaka & Forsa\nTaux : 2 %" });
  });

  it("uses a CSS selector override when given", () => {
    const page =
      "<body><div class='cookie'>Accept</div><section id='conditions'><p>Âge : 18 à 45 ans</p></section></body>";
    expect(extractMainText(page, "#conditions")).toEqual({ ok: true, text: "Âge : 18 à 45 ans" });
  });

  it("falls back from main to article to body", () => {
    expect(extractMainText("<body><article>A</article><p>B</p></body>")).toEqual({
      ok: true,
      text: "A",
    });
    expect(extractMainText("<body><p>Only body</p></body>")).toEqual({
      ok: true,
      text: "Only body",
    });
  });

  it("reports bad selectors and empty pages", () => {
    expect(extractMainText("<body>x</body>", "div[[[")).toEqual({
      ok: false,
      reason: "Invalid CSS selector: div[[[",
    });
    expect(extractMainText("<body>x</body>", "#missing")).toEqual({
      ok: false,
      reason: "Selector matched nothing: #missing",
    });
    expect(extractMainText("<body><script>x</script></body>")).toEqual({
      ok: false,
      reason: "Page has no readable text",
    });
  });

  it("normalises whitespace, including non-breaking spaces", () => {
    expect(normaliseText("  a  b \r\n\n\t c  ")).toBe("a b\nc");
  });
});

describe("checkWatch", () => {
  it("records a baseline on first check without reporting a change", async () => {
    const result = await checkWatch(
      watch(),
      deps({ [ROBOTS]: robotsOk, [PAGE]: { body: html("<p>Taux 2 %</p>") } }),
    );
    expect(result).toEqual({ kind: "baseline", hash: hashText("Taux 2 %"), text: "Taux 2 %" });
  });

  it("ignores changes outside the main content (scripts, nav, footer, timestamps)", async () => {
    const d = deps({
      [ROBOTS]: robotsOk,
      [PAGE]: { body: html("<p>Taux 2 %</p>", "2026-09-17 03:00") },
    });
    expect((await checkWatch(watch("Taux 2 %"), d)).kind).toBe("unchanged");
  });

  it("reports a change with a diff excerpt", async () => {
    const d = deps({
      [ROBOTS]: robotsOk,
      [PAGE]: { body: html("<p>Taux 1,75 %</p><p>Plafond 1,2 MDH</p>") },
    });
    const result = await checkWatch(watch("Taux 2 %\nPlafond 1,2 MDH"), d);
    expect(result).toMatchObject({ kind: "changed", text: "Taux 1,75 %\nPlafond 1,2 MDH" });
    if (result.kind === "changed") expect(result.diffExcerpt).toBe("- Taux 2 %\n+ Taux 1,75 %");
  });

  it("makes no request at all for a non-allowlisted host (test strategy §4)", async () => {
    const d = deps({});
    const result = await checkWatch({ ...watch(), url: "https://evil.example/page" }, d);
    expect(result).toEqual({
      kind: "blocked",
      reason: "Host not in WATCH_ALLOWED_HOSTS: evil.example",
    });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("blocks a host resolving to a private address before fetching", async () => {
    const d = deps({}, { resolveAll: async () => ["169.254.169.254"] });
    expect((await checkWatch(watch(), d)).kind).toBe("blocked");
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("honours robots.txt", async () => {
    const d = deps({
      [ROBOTS]: {
        body: "User-agent: *\nDisallow: /fr/\n",
        headers: { "content-type": "text/plain" },
      },
    });
    expect(await checkWatch(watch(), d)).toEqual({
      kind: "blocked",
      reason: "Disallowed by robots.txt: /fr/intelaka",
    });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it("treats a missing robots.txt (4xx) as allowing, and an erroring one (5xx) as disallowing", async () => {
    const missing = deps({ [PAGE]: { body: html("<p>ok</p>") } });
    expect((await checkWatch(watch(), missing)).kind).toBe("baseline");

    const failing = deps({ [ROBOTS]: { status: 503 }, [PAGE]: { body: html("<p>ok</p>") } });
    const result = await checkWatch(watch(), failing);
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked")
      expect(result.reason).toMatch(/robots.txt unavailable.*HTTP 503/);
  });

  it("follows allowed redirects and blocks redirects off the allowlist", async () => {
    const moved = `https://${HOST}/fr/programmes/intelaka`;
    const ok = deps({
      [ROBOTS]: robotsOk,
      [PAGE]: { status: 301, headers: { location: "/fr/programmes/intelaka" } },
      [moved]: { body: html("<p>moved</p>") },
    });
    expect((await checkWatch(watch(), ok)).kind).toBe("baseline");

    const offsite = deps({
      [ROBOTS]: robotsOk,
      [PAGE]: { status: 302, headers: { location: "http://169.254.169.254/latest" } },
    });
    const result = await checkWatch(watch(), offsite);
    expect(result).toEqual({
      kind: "blocked",
      reason: "Only https is allowed: http://169.254.169.254/latest",
    });
  });

  it("gives up after too many redirects, or a redirect without a location", async () => {
    const loop = deps({ [ROBOTS]: robotsOk, [PAGE]: { status: 302, headers: { location: PAGE } } });
    expect(await checkWatch(watch(), loop)).toEqual({
      kind: "error",
      reason: "More than 3 redirects",
    });

    const noLocation = deps({ [ROBOTS]: robotsOk, [PAGE]: { status: 302 } });
    expect((await checkWatch(watch(), noLocation)).kind).toBe("error");
  });

  it("reports HTTP errors, timeouts, network failures, wrong content types and oversized pages", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    const cases: [Route, RegExp][] = [
      [{ status: 500, body: "boom" }, /HTTP 500/],
      [{ throws: timeout }, /Timed out/],
      [{ throws: new TypeError("fetch failed") }, /Network error/],
      [
        { body: "%PDF", headers: { "content-type": "application/pdf" } },
        /Unexpected content type: application\/pdf/,
      ],
      [{ body: "x".repeat(MAX_BYTES + 1) }, /larger than/],
      [
        { body: html("<p>x</p>"), headers: { "content-type": "" } },
        /Unexpected content type: none/,
      ],
    ];
    for (const [route, reason] of cases) {
      const result = await checkWatch(watch(), deps({ [ROBOTS]: robotsOk, [PAGE]: route }));
      expect(result.kind).toBe("error");
      if (result.kind === "error") expect(result.reason).toMatch(reason);
    }
  });

  it("reports extraction failures", async () => {
    const d = deps({ [ROBOTS]: robotsOk, [PAGE]: { body: html("<p>x</p>") } });
    expect(await checkWatch({ ...watch(), cssSelector: "#gone" }, d)).toEqual({
      kind: "error",
      reason: "Selector matched nothing: #gone",
    });
  });

  it("identifies itself honestly", async () => {
    const d = deps({ [ROBOTS]: robotsOk, [PAGE]: { body: html("<p>x</p>") } });
    await checkWatch(watch(), d);
    const init = vi.mocked(d.fetch).mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>)["user-agent"]).toBe(
      "Da3mBot/1.0 (+https://da3m.ma/bot)",
    );
    expect(init.redirect).toBe("manual");
  });
});

describe("diffExcerpt", () => {
  it("lists only removed and added lines", () => {
    expect(diffExcerpt("a\nb\nc", "a\nB\nc\nd")).toBe("- b\n+ B\n+ d");
  });

  it("caps very long excerpts", () => {
    const excerpt = diffExcerpt("", "x".repeat(DIFF_EXCERPT_MAX * 2));
    expect(excerpt.length).toBe(DIFF_EXCERPT_MAX + 2);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
