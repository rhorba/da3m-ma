import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "./json-ld";

describe("jsonLdHtml", () => {
  it("round-trips to the original data", () => {
    const data = { "@type": "GovernmentService", name: "Prêt & garantie", amount: 200_000 };
    expect(JSON.parse(jsonLdHtml(data))).toEqual(data);
  });

  it("cannot emit a closing script tag, whatever the content", () => {
    const html = jsonLdHtml({ name: "</script><img src=x onerror=alert(1)>" });

    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
    expect(html).not.toContain(">");
    // And the value survives intact for anything reading the structured data.
    expect(JSON.parse(html).name).toBe("</script><img src=x onerror=alert(1)>");
  });

  it("escapes ampersands so entities cannot be introduced", () => {
    const html = jsonLdHtml({ name: "a & b" });

    expect(html).not.toContain("&");
    expect(JSON.parse(html).name).toBe("a & b");
  });

  it("escapes the line terminators that break a JavaScript parser", () => {
    const html = jsonLdHtml({ name: "a\u2028b\u2029c" });

    expect(html).not.toContain("\u2028");
    expect(html).not.toContain("\u2029");
    expect(JSON.parse(html).name).toBe("a\u2028b\u2029c");
  });

  it("keeps Arabic and accented text readable rather than escaping everything", () => {
    expect(jsonLdHtml({ name: "منحة رقمية" })).toContain("منحة رقمية");
    expect(jsonLdHtml({ name: "Prêt" })).toContain("Prêt");
  });
});
