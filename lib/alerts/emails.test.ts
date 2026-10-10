import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asLocale, confirmationEmail, digestEmail } from "./emails";

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://da3m.ma";
});
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

const items = [
  {
    slug: "damane-express",
    outcome: "eligible" as const,
    version: 2,
    content: {
      fr: { title: "Damane Express", summary: "" },
      ar: { title: "ضمان إكسبريس", summary: "" },
    },
  },
  {
    slug: "tech-start",
    outcome: "needs_info" as const,
    version: 1,
    content: { fr: { title: "Tech <Start>", summary: "" } },
  },
];

describe("alert emails", () => {
  it("puts a working confirmation link in the subscriber's language", () => {
    const email = confirmationEmail({ to: "a@example.com", locale: "en", confirmToken: "tok.en" });
    expect(email.subject).toBe("Confirm your Da3m.ma alerts");
    expect(email.text).toContain("https://da3m.ma/en/alertes/confirmer?t=tok.en");
    expect(email.html).toContain('href="https://da3m.ma/en/alertes/confirmer?t=tok.en"');
  });

  it("lists each programme with its outcome and link, and counts them in the subject", () => {
    const email = digestEmail({
      to: "a@example.com",
      locale: "fr",
      items,
      unsubscribeToken: "u.t",
    });
    expect(email.subject).toBe("2 programmes pour vous ont changé sur Da3m.ma");
    expect(email.text).toContain("- Damane Express (vous êtes éligible)");
    expect(email.text).toContain("https://da3m.ma/fr/programmes/tech-start");
    expect(email.text).toContain("https://da3m.ma/fr/alertes/desinscription?t=u.t");
  });

  it("offers one-click unsubscribe to mail clients", () => {
    const email = digestEmail({
      to: "a@example.com",
      locale: "fr",
      items,
      unsubscribeToken: "u.t",
    });
    expect(email.headers).toEqual({
      "List-Unsubscribe": "<https://da3m.ma/api/alerts/unsubscribe?t=u.t>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("writes Arabic right to left, falling back to the French title when there is no Arabic", () => {
    const email = digestEmail({ to: "a@example.com", locale: "ar", items, unsubscribeToken: "u" });
    expect(email.html).toContain('dir="rtl"');
    expect(email.text).toContain("ضمان إكسبريس");
    expect(email.text).toContain("Tech <Start>");
  });

  it("escapes programme titles in the HTML", () => {
    const email = digestEmail({ to: "a@example.com", locale: "fr", items, unsubscribeToken: "u" });
    expect(email.html).toContain("Tech &lt;Start&gt;");
    expect(email.html).not.toContain("<Start>");
  });

  it("falls back to French for a locale it does not know", () => {
    expect(asLocale("de")).toBe("fr");
    expect(asLocale("ar")).toBe("ar");
  });
});
