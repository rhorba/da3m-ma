import { expect, test, type Page } from "@playwright/test";

/**
 * The structural half of the accessibility baseline (UI foundation §6, Story 4.7).
 *
 * Colour contrast is checked against the shipped tokens in tests/unit/contrast.test.ts,
 * which also covers the dark theme. These checks are the things only a rendered page can
 * answer: landmarks, heading order, accessible names, language and tap targets.
 *
 * A full axe sweep is still pending: @axe-core/playwright cannot be installed while the
 * .npmrc minimum-release-age guard holds.
 */

const PUBLIC_PAGES = [
  { name: "home", path: "/fr" },
  { name: "wizard", path: "/fr/eligibilite" },
  { name: "catalogue", path: "/fr/programmes" },
  { name: "programme", path: "/fr/programmes/e2e-subvention-numerique" },
];

/** Every control a keyboard user can reach, with the name a screen reader would announce. */
async function namedControls(page: Page) {
  return page.evaluate(() => {
    const selector = "a[href], button, input, select, textarea";
    return [...document.querySelectorAll(selector)]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const labelledBy = el.getAttribute("aria-labelledby");
        const labelled = labelledBy ? document.getElementById(labelledBy)?.textContent : null;
        const wrappingLabel = el.closest("label")?.textContent;
        const forLabel = el.id
          ? document.querySelector(`label[for="${el.id}"]`)?.textContent
          : null;
        // A radio inside a card label is not the target: the whole label is clickable,
        // so that is what a finger has to hit.
        const target = el.closest("label") ?? el;
        const rect = target.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type"),
          name: (
            el.getAttribute("aria-label") ??
            labelled ??
            forLabel ??
            wrappingLabel ??
            el.textContent ??
            ""
          ).trim(),
          height: Math.round(rect.height),
          inProse: Boolean(el.closest("p")),
        };
      });
  });
}

for (const { name, path } of PUBLIC_PAGES) {
  test.describe(`${name} page`, () => {
    test("has one main landmark and exactly one first-level heading", async ({ page }) => {
      await page.goto(path);

      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
    });

    test("never skips a heading level", async ({ page }) => {
      await page.goto(path);

      const levels = await page.evaluate(() =>
        [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
          .filter((h) => (h as HTMLElement).offsetParent !== null)
          .map((h) => Number(h.tagName[1])),
      );

      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect([path, levels[i]! - levels[i - 1]!]).toEqual([path, expect.any(Number)]);
        expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
      }
    });

    test("gives every control something a screen reader can announce", async ({ page }) => {
      await page.goto(path);
      const unnamed = (await namedControls(page)).filter((control) => control.name === "");

      expect(unnamed).toEqual([]);
    });

    test("keeps tap targets big enough to hit on a phone", async ({ page }) => {
      await page.goto(path);
      // WCAG 2.5.8 exempts links inside a sentence, which is why prose links are excluded
      // here; navigation and standalone links are not exempt and must reach the floor.
      const small = (await namedControls(page)).filter(
        (control) => !control.inProse && control.height > 0 && control.height < 44,
      );

      expect(small).toEqual([]);
    });

    test("shows where the keyboard is", async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press("Tab");

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return { tag: el.tagName.toLowerCase(), outline: getComputedStyle(el).outlineWidth };
      });

      expect(focused).not.toBeNull();
      expect(focused?.outline).not.toBe("0px");
    });
  });
}

test.describe("language", () => {
  test("declares French left to right", async ({ page }) => {
    await page.goto("/fr/programmes");

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("declares Arabic right to left, on every public page", async ({ page }) => {
    for (const { path } of PUBLIC_PAGES) {
      await page.goto(path.replace("/fr", "/ar"));
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
  });
});
