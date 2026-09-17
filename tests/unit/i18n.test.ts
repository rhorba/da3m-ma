import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { localeDirection, routing } from "@/i18n/routing";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) };
  }, {});
}

describe("locales", () => {
  it("serves French by default, with Arabic and English", () => {
    expect(routing.defaultLocale).toBe("fr");
    expect([...routing.locales]).toEqual(["fr", "ar", "en"]);
  });

  it("renders Arabic right-to-left and the others left-to-right", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("fr")).toBe("ltr");
    expect(localeDirection("en")).toBe("ltr");
  });
});

describe("messages", () => {
  const catalogues = { fr: flatten(fr), ar: flatten(ar), en: flatten(en) };
  const frenchKeys = Object.keys(catalogues.fr).sort();

  it.each(["ar", "en"] as const)("%s has exactly the same keys as French", (locale) => {
    expect(Object.keys(catalogues[locale]).sort()).toEqual(frenchKeys);
  });

  it.each(["fr", "ar", "en"] as const)("%s has no empty strings", (locale) => {
    const empty = Object.entries(catalogues[locale]).filter(([, v]) => v.trim() === "");
    expect(empty).toEqual([]);
  });

  it("does not ship French copy in the Arabic catalogue (Bina lesson)", () => {
    const untranslated = frenchKeys.filter(
      (key) => !key.startsWith("languages.") && catalogues.ar[key] === catalogues.fr[key],
    );
    expect(untranslated).toEqual([]);
    const withoutArabicScript = Object.entries(catalogues.ar).filter(
      ([key, value]) => !key.startsWith("languages.") && !/[؀-ۿ]/.test(value),
    );
    expect(withoutArabicScript).toEqual([]);
  });
});
