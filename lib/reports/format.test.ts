import { describe, expect, it } from "vitest";
import { amountLabel, formatDate, formatMad } from "./format";

describe("amountLabel", () => {
  it("shows a range when both bounds are published", () => {
    expect(amountLabel(10_000, 200_000)).toEqual({
      key: "amountRange",
      min: 10_000,
      max: 200_000,
    });
  });

  it("shows a ceiling when only the maximum is published", () => {
    expect(amountLabel(null, 200_000)).toEqual({ key: "amountUpTo", amount: 200_000 });
  });

  it("shows a floor when only the minimum is published", () => {
    expect(amountLabel(50_000, null)).toEqual({ key: "amountFrom", amount: 50_000 });
  });

  it("says nothing when the programme publishes no amount", () => {
    expect(amountLabel(null, null)).toBeNull();
  });

  it("treats a published zero as a real bound, not a missing one", () => {
    expect(amountLabel(0, null)).toEqual({ key: "amountFrom", amount: 0 });
  });
});

describe("formatMad", () => {
  it("drops centimes from a ceiling", () => {
    // These are published bounds, not invoices, so no locale should print ",00".
    for (const locale of ["fr", "ar", "en"]) {
      expect([locale, formatMad(locale, 200_000)]).toEqual([
        locale,
        expect.not.stringMatching(/[,.]\d\d(\D|$)/),
      ]);
    }
  });

  it("keeps Latin digits in Arabic (UI foundation §5)", () => {
    expect(formatMad("ar", 200_000)).toMatch(/200/);
    expect(formatMad("ar", 200_000)).not.toMatch(/[٠-٩]/);
  });

  it("names the currency in every locale", () => {
    for (const locale of ["fr", "ar", "en"]) {
      expect(formatMad(locale, 1_000)).toMatch(/MAD|DH|د\.م\./);
    }
  });
});

describe("formatDate", () => {
  it("does not slip a day, whatever the runtime timezone", () => {
    expect(formatDate("en", "2026-09-16")).toContain("16");
    expect(formatDate("fr", "2026-01-01")).toContain("1");
  });

  it("writes Arabic dates with Latin digits", () => {
    expect(formatDate("ar", "2026-09-16")).toMatch(/16/);
  });
});
