import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The accessibility baseline (UI foundation §6) as a test rather than a claim.
 *
 * It reads the tokens actually shipped in app/globals.css and computes WCAG 2.1
 * contrast, so changing a hex value fails here rather than in someone's eyes. axe checks
 * rendered pages; this checks the palette those pages are built from, including the dark
 * theme, which axe never sees unless a run happens to be in dark mode.
 */

const css = readFileSync(path.resolve(process.cwd(), "app", "globals.css"), "utf8");

/** Token values from one block of the stylesheet. */
function tokensIn(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    tokens[name!] = value!;
  }
  return tokens;
}

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`No block for ${marker} in globals.css`);
  return css.slice(start, css.indexOf("}", start));
}

const light = tokensIn(blockAfter("@theme"));
// The dark overrides are declared twice (media query and explicit theme); either will do.
const dark = { ...light, ...tokensIn(blockAfter(':root[data-theme="dark"]')) };

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const round = (value: number) => Math.round(value * 10) / 10;

describe("contrast maths", () => {
  it("agrees with the WCAG reference values at the extremes", () => {
    expect(round(contrast("#000000", "#ffffff"))).toBe(21);
    expect(round(contrast("#ffffff", "#ffffff"))).toBe(1);
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme", (theme, tokens) => {
  const onBackground = (name: string) => contrast(tokens[name]!, tokens.background!);
  const onSurface = (name: string) => contrast(tokens[name]!, tokens.surface!);

  it("has every token the components use", () => {
    const required = [
      "primary",
      "accent",
      "accent-fg",
      "background",
      "surface",
      "border",
      "primary-fg",
      "text",
      "text-muted",
      "warning",
      "error",
      "ineligible",
    ];
    expect(required.filter((name) => !tokens[name])).toEqual([]);
  });

  it.each(["text", "text-muted", "warning", "error", "primary"])(
    "reads %s as normal body text on both paper and cards",
    (name) => {
      expect([name, round(onBackground(name)) >= 4.5]).toEqual([name, true]);
      expect([name, round(onSurface(name)) >= 4.5]).toEqual([name, true]);
    },
  );

  it("keeps the button label legible on a primary fill", () => {
    // Light mode pairs white with the deep teal; dark mode flips to ink on the lighter
    // teal, because white on it is only 3.0:1.
    expect(round(contrast(tokens["primary-fg"]!, tokens.primary!))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark text legible on a saffron fill", () => {
    expect(round(contrast(tokens["accent-fg"]!, tokens.accent!))).toBeGreaterThanOrEqual(4.5);
  });

  it("never lets saffron itself be used as text on paper", () => {
    // Documented at 2.2:1 on the light background. The test exists so nobody "fixes" a
    // component by colouring text with it. On the dark background the same hue is
    // perfectly readable, so the rule only binds in light mode.
    if (theme === "light") expect(round(onBackground("accent"))).toBeLessThan(4.5);
    else expect(round(onBackground("accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the muted ineligible colour readable at heading size", () => {
    // Used for the collapsed group heading and its dot: large text and a UI component,
    // so the threshold is 3:1, not 4.5:1.
    expect(round(onBackground("ineligible"))).toBeGreaterThanOrEqual(3);
  });

  it(`matches the ratios the UI foundation documents for ${theme}`, () => {
    const documented =
      theme === "light"
        ? { primary: 7.2, "text-muted": 5.6, ineligible: 4.9, warning: 5, error: 5.7 }
        : { primary: 6.4, ineligible: 4.1 };

    for (const [name, expected] of Object.entries(documented)) {
      expect([name, round(onBackground(name))]).toEqual([name, expected]);
    }
  });
});
