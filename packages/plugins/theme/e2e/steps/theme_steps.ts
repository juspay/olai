import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Page } from "@olai/tests/harness/playwright.ts";

import {
  customProperty,
  DEFAULT_THEME,
  selector,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "@olai/web/testlib";
import { DEFAULT_DARK_THEME, PALETTES, SYSTEM_SCHEME, THEME_NAMES } from "@olai/appearance/palettes.ts";
import { focusedOn } from "@olai/tests/harness/caret.ts";
import { manifestOf } from "@olai/tests/harness/manifest.ts";
import { showPreferences } from "@olai/tests/harness/preferences.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { attr, POLL_TIMEOUT, PREFS_ROW, THEME_CHIP } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const PROBE = "__olaiThemeLanded";

const PAPER = customProperty("paper");

/**
 * A STRING, not a TypeScript function this file would serialise: Playwright
 * runs `toString()` of a callback in the page, and a `: string` or an `as`
 * cast is a syntax error there.
 *
 * It reads the meta the browser USES: the shell ships one per
 * `prefers-color-scheme`, and the UA paints from the first whose media
 * matches — asked here with the page's own `matchMedia`.
 */
const CHROME_OF = `async (property) => {
  const paper = getComputedStyle(document.documentElement)
    .getPropertyValue(property).trim().toLowerCase();
  const used = [...document.querySelectorAll('meta[name="theme-color"]')]
    .find((meta) => {
      const query = meta.getAttribute("media");
      return !query || matchMedia(query).matches;
    });
  const chrome = used?.getAttribute("content")?.toLowerCase() ?? null;
  const href = document.querySelector("link[rel=icon]")?.href;
  let mark = null;
  if (href) {
    try { mark = (await (await fetch(href)).text()).toLowerCase(); }
    catch { mark = null; }
  }
  return { chrome, paper, mark };
}`;

When("I pick the theme {string}", async function (this: OlaiWorld, theme: string) {
  await pick(this, theme);
});

When("I pick the default theme", async function (this: OlaiWorld) {
  await pick(this, DEFAULT_THEME);
});

const showChips = async (
  world: OlaiWorld,
  page: Page = world.page,
): Promise<void> => {
  const chip = page.locator(THEME_CHIP).first();
  if (await chip.isVisible().catch(() => false)) return;
  await showPreferences(page);
  await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

const pick = async (world: OlaiWorld, theme: string): Promise<void> => {
  await showChips(world);
  await world.press(world.page.locator(`${THEME_CHIP}${attr("data-value", theme)}`));
  await world.expectChromeAttribute("html", THEME_ATTRIBUTE, theme, "the page");
};

const namedTheme = (world: OlaiWorld): Promise<string | null> =>
  world.page.locator("html").getAttribute(THEME_ATTRIBUTE);

Then("the page names no theme", async function (this: OlaiWorld) {
  const named = await namedTheme(this);
  assert.equal(named, null, `the page already names a theme: ${named}`);
});

Then(
  "the theme row names the theme in force",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    const named = themeRow(this).locator(selector(TESTID.prefsValue));
    await named.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    let said = "";
    let expected = "";
    await this.waitUntil(async () => {
      const picked = await namedTheme(this);
      expected = picked ?? await systemDefault(this);
      said = (await named.innerText()).trim();
      const lower = said.toLowerCase();
      return picked === null
        ? lower.startsWith("system") && lower.endsWith(expected.toLowerCase())
        : lower === expected.toLowerCase();
    }, "the Theme row to name the theme in force").catch(() => {
      assert.fail(`the Theme row names "${said}", but the page is in "${expected}"`);
    });
  },
);

const systemDefault = async (world: OlaiWorld): Promise<string> =>
  (await world.page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches))
    ? DEFAULT_DARK_THEME
    : DEFAULT_THEME;

const FOLLOW = selector(TESTID.themeFollow);

When("I hand the theme back to the system", async function (this: OlaiWorld) {
  await showChips(this);
  await this.press(this.page.locator(FOLLOW));
  await this.waitUntil(
    async () => (await namedTheme(this)) === null,
    "the page to stop naming a theme",
  );
});

Then("the follow-the-system control is lit", async function (this: OlaiWorld) {
  await showChips(this);
  await this.expectChromeAttribute(FOLLOW, "aria-pressed", "true", "the follow control");
});

Then("the follow-the-system control is not lit", async function (this: OlaiWorld) {
  await showChips(this);
  await this.expectChromeAttribute(FOLLOW, "aria-pressed", "false", "the follow control");
});

When("the system prefers {string}", async function (this: OlaiWorld, scheme: string) {
  assert.ok(scheme === "dark" || scheme === "light", `no such scheme: ${scheme}`);
  await this.page.emulateMedia({ colorScheme: scheme });
});

Then("the page paints the {string} default", async function (this: OlaiWorld, scheme: string) {
  const expected = PALETTES.find((palette) => palette.scheme === scheme && palette.name === (scheme === "dark" ? DEFAULT_DARK_THEME : DEFAULT_THEME));
  assert.ok(expected, `no default for scheme ${scheme}`);
  let painted = "";
  await this.waitUntil(async () => {
    painted = (await paper(this)).toLowerCase();
    return painted === expected.colors.paper.toLowerCase();
  }, `the page to paint the ${scheme} default`).catch(() => {
    assert.fail(`the page paints ${painted || "(nothing)"}, the ${scheme} default is ${expected.colors.paper}`);
  });
});

const themeRow = (world: OlaiWorld) =>
  world.page.locator(`${PREFS_ROW}${attr("data-pref", "theme")}`);

Then("every palette paints the page it names", async function (this: OlaiWorld) {
  const wrong: Array<string> = [];
  for (const palette of PALETTES) {
    await pick(this, palette.name);
    const painted = await this.page.evaluate(
      (property) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(property)
          .trim(),
      PAPER,
    );
    if (painted.toLowerCase() !== palette.colors.paper.toLowerCase()) {
      wrong.push(
        `${palette.name}: the page paints ${painted || "(nothing)"}, ` +
          `the table says ${palette.colors.paper}`,
      );
    }
  }
  assert.deepStrictEqual(wrong, [], "a palette does not paint the page it names");
});

When(
  "I Tab to the {string} swatch",
  async function (this: OlaiWorld, theme: string) {
    await showChips(this);
    let at = "nothing";
    for (let presses = 0; presses < 40; presses += 1) {
      at = await focusedOn(this);
      if (at === `${TESTID.themeChip}=${theme}`) return;
      await pressed(this, "Tab");
    }
    assert.fail(`forty Tabs never reached the ${theme} swatch; the caret is on ${at}`);
  },
);

Then(
  "the {string} swatch has the focus",
  async function (this: OlaiWorld, theme: string) {
    const at = await focusedOn(this);
    assert.equal(at, `${TESTID.themeChip}=${theme}`, `the caret is on ${at}, not on the ${theme} swatch`);
  },
);

Then(
  "the page is in the theme {string}",
  async function (this: OlaiWorld, theme: string) {
    await this.expectChromeAttribute("html", THEME_ATTRIBUTE, theme, "the page");
  },
);

Then("the page is in the default theme", async function (this: OlaiWorld) {
  assert.equal(await namedTheme(this), DEFAULT_THEME);
});

Then(
  "the lit theme chip is {string}",
  async function (this: OlaiWorld, theme: string) {
    await litChipIs(this, theme);
  },
);

Then("the lit theme chip is the default", async function (this: OlaiWorld) {
  await litChipIs(this, DEFAULT_THEME);
});

const litChipIs = async (world: OlaiWorld, theme: string): Promise<void> => {
  await showChips(world);
  await world.expectChromeAttribute(
    `${THEME_CHIP}${attr("data-value", theme)}`,
    "aria-pressed",
    "true",
    `the ${theme} chip`,
  );
};

Then(
  "every theme chip agrees with what it announces",
  async function (this: OlaiWorld) {
    await showChips(this);
    const chips = await this.page.locator(THEME_CHIP).evaluateAll((elements) =>
      elements.map((element) => ({
        value: (element as HTMLElement).dataset.value ?? null,
        pressed: element.getAttribute("aria-pressed"),
        name: element.getAttribute("aria-label"),
      })),
    );
    assert.deepStrictEqual(
      chips.map((chip) => chip.value).sort(),
      [...THEME_NAMES].sort(),
      "the swatches are not one per palette",
    );
    assert.deepStrictEqual(
      chips.filter((chip) => (chip.name ?? "").toLowerCase() !== chip.value),
      [],
      "a swatch does not announce the palette it offers",
    );
    assert.deepStrictEqual(
      chips.filter((chip) => chip.pressed !== "true" && chip.pressed !== "false"),
      [],
      "a chip announces neither aria-pressed=true nor aria-pressed=false",
    );
    assert.equal(
      chips.filter((chip) => chip.pressed === "true").length,
      1,
      `${chips.filter((chip) => chip.pressed === "true").length} chips claim to be in force`,
    );
    const lit = chips.find((chip) => chip.pressed === "true")?.value;
    assert.equal(
      lit,
      await namedTheme(this) ?? await systemDefault(this),
      "the lit chip is not the theme the page is in",
    );
  },
);

const paper = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(
    (property) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(property)
        .trim(),
    PAPER,
  );

When("I note the paper colour", async function (this: OlaiWorld) {
  this.paperBefore = await paper(this);
  assert.ok(this.paperBefore, `the sheet paints no ${PAPER}`);
});

Then("the paper colour has changed", async function (this: OlaiWorld) {
  assert.ok(this.paperBefore, "nothing noted the paper colour first");
  assert.notEqual(
    await paper(this),
    this.paperBefore,
    "the attribute flipped but the sheet painted the same paper",
  );
});

Then("the browser chrome matches the paper", async function (this: OlaiWorld) {
  // Polled from Node: `waitForFunction` does not await an async IIFE string,
  // and a Promise is truthy, so that wait would return on the first tick.
  const property = JSON.stringify(PAPER);
  const seenOf = () =>
    this.page.evaluate(`(${CHROME_OF})(${property})`) as Promise<{
      chrome: string | null;
      paper: string;
      mark: string | null;
    }>;
  await this.waitUntil(async () => {
    const seen = await seenOf();
    return (
      seen.chrome === seen.paper &&
      seen.mark !== null &&
      seen.mark.includes(`fill="${seen.paper}"`)
    );
  }, "the browser chrome to match the paper").catch(() => undefined);
  const seen = await seenOf();
  assert.equal(
    seen.chrome,
    seen.paper,
    "the browser chrome is not the colour the page is painted in",
  );
  assert.ok(
    seen.mark !== null && seen.mark.includes(`fill="${seen.paper}"`),
    "the tab mark is not painted in the paper the page is in",
  );
});

Then(
  "the manifest's chrome is the paper this page paints",
  async function (this: OlaiWorld) {
    const manifest = await manifestOf(this);
    const unpicked = await paper(this);
    for (const field of ["theme_color", "background_color"] as const) {
      const declared = manifest[field];
      assert.equal(
        typeof declared === "string" ? declared.toLowerCase() : declared,
        unpicked.toLowerCase(),
        `the manifest's ${field} is not the paper an unpicked page paints`,
      );
    }
  },
);

When(
  "this browser has stored the theme {string}",
  async function (this: OlaiWorld, theme: string) {
    await this.page.evaluate(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [THEME_STORAGE_KEY, theme],
    );
  },
);

Then("this browser has stored no theme", async function (this: OlaiWorld) {
  const stored = await this.stored(THEME_STORAGE_KEY);
  assert.equal(stored, null, `this browser still keeps "${stored}"`);
});

When("I watch for the theme landing", async function (this: OlaiWorld) {
  await this.page.addInitScript(
    ([key, attribute]: ReadonlyArray<string>) => {
      const window_ = window as unknown as Record<string, unknown>;
      window_[key as string] = null;
      new MutationObserver((records) => {
        if (window_[key as string]) return;
        if (!records.some((record) => record.attributeName === attribute)) return;
        window_[key as string] = {
          theme: document.documentElement.getAttribute(attribute as string),
          canvas: document
            .querySelector('meta[name="color-scheme"]')
            ?.getAttribute("content") ?? null,
          parsing: document.readyState === "loading",
        };
      }).observe(document, {
        attributes: true,
        subtree: true,
        attributeFilter: [attribute as string],
      });
    },
    [PROBE, THEME_ATTRIBUTE],
  );
});

const landing = async (
  world: OlaiWorld,
): Promise<{ theme: string; canvas: string | null; parsing: boolean } | null> =>
  (await world.page.evaluate(
    (key) => (window as unknown as Record<string, unknown>)[key],
    PROBE,
  )) as { theme: string; canvas: string | null; parsing: boolean } | null;

Then(
  "the theme {string} landed while the page was still parsing",
  async function (this: OlaiWorld, theme: string) {
    const landed = await landing(this);
    assert.ok(landed, "no theme was ever written on <html>");
    assert.equal(landed.theme, theme);
    assert.ok(
      landed.parsing,
      "the theme landed after the parse: the page flashed the wrong one",
    );
  },
);

Then(
  "the canvas was already {string} while the page was still parsing",
  async function (this: OlaiWorld, scheme: string) {
    const landed = await landing(this);
    assert.ok(landed, "no theme was ever written on <html>");
    assert.ok(
      landed.parsing,
      "the theme landed after the parse: the page flashed the wrong one",
    );
    assert.equal(
      landed.canvas,
      scheme,
      `the browser was told "${landed.canvas}" while the page was parsing`,
    );
  },
);

const CANVAS = 'meta[name="color-scheme"]';

Then(
  "the canvas is pinned to {string}",
  async function (this: OlaiWorld, scheme: string) {
    await this.expectChromeAttribute(CANVAS, "content", scheme, "the canvas");
  },
);

Then("the canvas follows the system", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(CANVAS, "content", SYSTEM_SCHEME, "the canvas");
});

When("the appearance controls have finished loading their fonts", async function (this: OlaiWorld) {
  await showChips(this);
  await this.page.evaluate(async () => {
    document.documentElement.getBoundingClientRect();
    await document.fonts.ready;
  });
});

When("I watch what the page asks for", function (this: OlaiWorld) {
  this.watchRequests();
});

Then("the page asked for nothing at all", async function (this: OlaiWorld) {
  await this.waitForFrame();
  assert.deepStrictEqual(
    [...this.requestsWatched()],
    [],
    "picking a theme is client state; nothing about it should reach a network",
  );
});
