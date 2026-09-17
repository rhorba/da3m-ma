import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { absoluteUrl, alternatesFor, localisedPath, siteUrl } from "./urls";

const original = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://da3m.ma";
});

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("siteUrl", () => {
  it("drops a trailing slash so joined paths never double up", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://da3m.ma/";
    expect(siteUrl()).toBe("https://da3m.ma");
  });

  it("falls back to localhost when the site URL is not configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("localisedPath", () => {
  it("puts the locale first", () => {
    expect(localisedPath("fr", "/programmes/intelaka")).toBe("/fr/programmes/intelaka");
  });

  it("normalises missing and doubled slashes", () => {
    expect(localisedPath("ar", "programmes")).toBe("/ar/programmes");
    expect(localisedPath("en", "/programmes/")).toBe("/en/programmes");
  });

  it("keeps the home page free of a trailing slash", () => {
    expect(localisedPath("fr", "/")).toBe("/fr");
  });
});

describe("absoluteUrl", () => {
  it("joins the site, the locale and the path", () => {
    expect(absoluteUrl("ar", "/programmes/x")).toBe("https://da3m.ma/ar/programmes/x");
  });
});

describe("alternatesFor", () => {
  const alternates = () => alternatesFor("ar", "/programmes/x");

  it("points the canonical at the locale being rendered", () => {
    expect(alternates().canonical).toBe("https://da3m.ma/ar/programmes/x");
  });

  it("lists every locale, so each one can be found in its own language", () => {
    expect(alternates().languages).toMatchObject({
      fr: "https://da3m.ma/fr/programmes/x",
      ar: "https://da3m.ma/ar/programmes/x",
      en: "https://da3m.ma/en/programmes/x",
    });
  });

  it("sends x-default to French, the default locale", () => {
    expect(alternates().languages["x-default"]).toBe("https://da3m.ma/fr/programmes/x");
  });
});
