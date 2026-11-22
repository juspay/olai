/**
 * The theme: what a chip writes, what this browser keeps, and what the page
 * repaints to. The chips are the preferences panel's Theme row, so every step
 * here opens that panel first (`preferences_steps.ts`).
 *
 * The theme TABLE is imported, not read back off the page — `DEFAULT_THEME`,
 * `THEME_ATTRIBUTE`, `THEME_STORAGE_KEY` and `customProperty` come from the
 * client that owns them, for the same reason `support/world.ts` imports
 * `TESTID`: renaming one is then a type error at `bun run typecheck` rather
 * than a thirty-second timeout in a scenario that no longer says why. The only
 * strings a scenario spells are the two or three themes it asks for by name,
 * which is the scenario saying what it wants.
 *
 * No step asserts on a COLOUR it wrote down. The paper is compared against
 * itself (before a pick, after a pick), against the browser chrome and against
 * what the manifest says — never against a hex written in a test, which would
 * make this the place a design decision has to be changed.
 */

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
import {
  DEFAULT_DARK_THEME,
  PALETTE_TOKENS,
  PALETTES,
  SYSTEM_SCHEME,
  THEME_NAMES,
} from "@olai/appearance/palettes.ts";
import { focusedOn } from "@olai/tests/harness/caret.ts";
import { manifestOf } from "@olai/tests/harness/manifest.ts";
import { showPreferences } from "@olai/tests/harness/preferences.ts";
import { saveScreenshot } from "@olai/tests/harness/screenshot.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { attr, POLL_TIMEOUT, PREFS_PANEL, PREFS_ROW, THEME_CHIP } from "@olai/tests/harness/world.ts";
import type { Box } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** What the parse probe leaves on `window`. Named once: an init script and two
 *  steps have to agree about it. */
const PROBE = "__olaiThemeLanded";

/** The custom property the sheet paints the page's own background with. Asked
 *  of the generator, so a renamed namespace is a rename here too rather than a
 *  step that quietly reads an empty string. */
const PAPER = customProperty("paper");

/**
 * What the browser chrome is painted in, as a page-side JavaScript function.
 *
 * A STRING, not a TypeScript function this file would serialise: Playwright
 * runs `toString()` of a callback in the page, and a `: string` or an `as`
 * cast is a syntax error there. The mark is a blob the page minted; fetching
 * it is how this step reads the paper it was drawn in.
 *
 * THE META THE BROWSER USES, not the first one in the head: the shell ships
 * two, each with a `prefers-color-scheme` query, and the rule is the first
 * whose media matches — asked here with the page's own `matchMedia`, which is
 * the same answer the UA gives itself. Reading `querySelector` instead was
 * how a dark palette under a light OS could wear the dark DEFAULT's paper
 * with nothing failing: the meta that was repainted was not the one in force.
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

// ── picking ────────────────────────────────────────────────────────────

When("I pick the theme {string}", async function (this: OlaiWorld, theme: string) {
  await pick(this, theme);
});

When("I pick the default theme", async function (this: OlaiWorld) {
  await pick(this, DEFAULT_THEME);
});

/** Open the preferences if the chips are not already on screen. The strip is
 *  the panel's Theme row: the chips never crowded the bar, because the bar
 *  never held them — what changed with `preferences-panel` is that the pill in
 *  front of them is gone and this is the one door. */
const showChips = async (
  world: OlaiWorld,
  page: Page = world.page,
): Promise<void> => {
  const chip = page.locator(THEME_CHIP).first();
  if (await chip.isVisible().catch(() => false)) return;
  await showPreferences(page);
  await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

/** Press a chip, and wait for the PAGE to say it is in that theme.
 *
 *  Waiting on the page rather than on the click is what keeps everything after
 *  it an assertion about the theme instead of about timing; `expectAttribute`
 *  is what makes the failure say which theme the page is in instead of timing
 *  out with nothing to show. The panel is deliberately NOT waited on to shut:
 *  it is a settings surface rather than a menu, and it stays open so two
 *  palettes can be compared on the page they paint. */
const pick = async (world: OlaiWorld, theme: string): Promise<void> => {
  await showChips(world);
  await world.press(world.page.locator(`${THEME_CHIP}${attr("data-value", theme)}`));
  await world.expectChromeAttribute("html", THEME_ATTRIBUTE, theme, "the page");
};

// ── what the page is in ────────────────────────────────────────────────

/** The theme `<html>` NAMES, or null for the page nobody has picked on. */
const namedTheme = (world: OlaiWorld): Promise<string | null> =>
  world.page.locator("html").getAttribute(THEME_ATTRIBUTE);

Then("the page names no theme", async function (this: OlaiWorld) {
  // No attribute is not "no theme": it is the DEFAULT, which the sheet paints
  // on the bare `:root`. The distinction is the point — this is the page
  // nobody has picked on yet.
  const named = await namedTheme(this);
  assert.equal(named, null, `the page already names a theme: ${named}`);
});

/**
 * The Theme row NAMES the theme in force — including the default when nobody
 * has picked — once, quietly, beside its label.
 *
 * This is the promise the retired header pill carried, kept where the rest of
 * the preferences are said. It is worth its own step for the reason it was
 * worth one there: mutation-tested, hard-coding the name to "chalk" passed
 * every theming scenario until something asserted it. Swatches wearing their
 * palettes say which is which and not which is ON — and a swatch carries no
 * word at all.
 *
 * Waited for rather than read once: a pick crossing from another tab lands
 * on a `storage` event, and the name follows it a frame later.
 */
Then(
  "the theme row names the theme in force",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    const named = themeRow(this).locator(selector(TESTID.prefsValue));
    await named.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    let said = "";
    let expected = "";
    // An unpicked page names the OS's choice as `System · Chalk`: the palette
    // is the last word either way, and the first says whose answer it was.
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

// ── following the OS ───────────────────────────────────────────────────

/** THE DEFAULT THE OS PICKS for an unpicked page: the dark one under
 *  `prefers-color-scheme: dark`, the light one otherwise — asked of the page's
 *  own `matchMedia`, which is what an emulated scheme flips too. */
const systemDefault = async (world: OlaiWorld): Promise<string> =>
  (await world.page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches))
    ? DEFAULT_DARK_THEME
    : DEFAULT_THEME;

/** The follow control: the one button in the row that is not a palette. */
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

/** Tell the browser what the OS prefers. Playwright's emulation fires the
 *  page's `matchMedia` change event exactly as a real OS flip would. */
When("the system prefers {string}", async function (this: OlaiWorld, scheme: string) {
  assert.ok(scheme === "dark" || scheme === "light", `no such scheme: ${scheme}`);
  await this.page.emulateMedia({ colorScheme: scheme });
});

/** The paper an unpicked page paints under the OS's word, read off the sheet
 *  and compared to the table's default for that scheme — not to a hex. */
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

/** The Theme row, by the preference it sets. */
const themeRow = (world: OlaiWorld) =>
  world.page.locator(`${PREFS_ROW}${attr("data-pref", "theme")}`);

/**
 * Every row of the table, picked and read back off the page it paints.
 *
 * The sheet is GENERATED from the table (`appearance/src/css.ts`), one block
 * per row, so the honest check of every row is the round trip rather than a
 * spot check of the two or three scenarios name — and of EVERY token in the
 * block and its `color-scheme`, because a block that dropped its alarm or its
 * scheme paints the right paper and is still wrong. It is written against the
 * table and not against a hex, which is this file's rule — a retune is a
 * retune in one place — and a row whose block was dropped, mistyped, or given
 * another row's values fails here, in the browser that paints it.
 */
Then("every palette paints the page it names", async function (this: OlaiWorld) {
  const wrong: Array<string> = [];
  for (const palette of PALETTES) {
    await pick(this, palette.name);
    const painted = await this.page.evaluate((properties) => {
      const style = getComputedStyle(document.documentElement);
      return {
        scheme: style.colorScheme,
        colours: properties.map((property) => style.getPropertyValue(property).trim()),
      };
    }, PALETTE_TOKENS.map(customProperty));
    PALETTE_TOKENS.forEach((token, at) => {
      const said = painted.colours[at] ?? "";
      if (said.toLowerCase() !== palette.colors[token].toLowerCase()) {
        wrong.push(`${palette.name}.${token}: the page paints ${said || "(nothing)"}, the table says ${palette.colors[token]}`);
      }
    });
    if (painted.scheme !== palette.scheme) {
      wrong.push(`${palette.name}: the page's color-scheme is "${painted.scheme}", the table says "${palette.scheme}"`);
    }
  }
  assert.deepStrictEqual(wrong, [], "a palette does not paint the page it names");
});

// ── the picker's two lines ─────────────────────────────────────────────

/** Every swatch's box, by the theme it offers — one read of the page's own
 *  layout, so the lines are compared at one instant. */
const swatchBoxes = async (world: OlaiWorld): Promise<ReadonlyMap<string, Box>> => {
  await showChips(world);
  const measured = await world.page.locator(THEME_CHIP).evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        value: (element as HTMLElement).dataset.value ?? "",
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }),
  );
  return new Map(measured.map(({ value, box }) => [value, box]));
};

/** The light swatches' boxes and the dark ones', in table order. Which is
 *  which is the TABLE's word, so a row that changed polarity moves line
 *  without these steps learning its name. */
const linesOf = async (world: OlaiWorld): Promise<{ light: Array<Box>; dark: Array<Box> }> => {
  const boxes = await swatchBoxes(world);
  const line = (scheme: string): Array<Box> =>
    PALETTES.filter((palette) => palette.scheme === scheme).map((palette) => {
      const box = boxes.get(palette.name);
      assert.ok(box, `no swatch offers ${palette.name}`);
      return box;
    });
  return { light: line("light"), dark: line("dark") };
};

/** Every dark swatch starts below the foot of every light one. */
const assertLightsAboveDarks = (light: Array<Box>, dark: Array<Box>): void => {
  const lightFoot = Math.max(...light.map((box) => box.y + box.height));
  const darkTop = Math.min(...dark.map((box) => box.y));
  assert.ok(darkTop >= lightFoot - 1, `the darks start at ${Math.round(darkTop)}px, above the lights' foot at ${Math.round(lightFoot)}px`);
};

Then("the theme swatches stand in two lines, light above dark", async function (this: OlaiWorld) {
  const { light, dark } = await linesOf(this);
  const tops = (boxes: Array<Box>): Set<number> => new Set(boxes.map((box) => Math.round(box.y)));
  assert.equal(tops(light).size, 1, `the light swatches stand at ${[...tops(light)].join(", ")}px, not on one line`);
  assert.equal(tops(dark).size, 1, `the dark swatches stand at ${[...tops(dark)].join(", ")}px, not on one line`);
  assertLightsAboveDarks(light, dark);
});

Then("every light swatch stands above every dark one", async function (this: OlaiWorld) {
  // On a phone a line of seven 44px targets is wider than the panel, so the
  // lights may wrap onto a second line; what holds there is the order.
  const { light, dark } = await linesOf(this);
  assertLightsAboveDarks(light, dark);
});

Then(
  "the {string} swatch stands under the {string} swatch",
  async function (this: OlaiWorld, under: string, over: string) {
    const boxes = await swatchBoxes(this);
    const below = boxes.get(under);
    const above = boxes.get(over);
    assert.ok(below && above, `no swatch offers ${below ? over : under}`);
    const centre = (box: Box): number => box.x + box.width / 2;
    assert.ok(
      Math.abs(centre(below) - centre(above)) <= 1,
      `the ${under} swatch is centred at x=${Math.round(centre(below))}, the ${over} swatch at x=${Math.round(centre(above))}`,
    );
    assert.ok(
      below.y >= above.y + above.height - 1,
      `the ${under} swatch (y=${Math.round(below.y)}) is not below the ${over} swatch (foot at ${Math.round(above.y + above.height)})`,
    );
  },
);

Then("every theme swatch is inside the preferences panel, and a finger's size", async function (this: OlaiWorld) {
  // 44px is the target both mobile platforms print in their guidelines; the
  // swatch's disc is smaller, and the button around it is the target.
  const boxes = await swatchBoxes(this);
  const panel = await this.box(this.page.locator(PREFS_PANEL), "the preferences panel");
  const wrong: Array<string> = [];
  for (const name of THEME_NAMES) {
    const box = boxes.get(name);
    if (box === undefined) {
      wrong.push(`${name}: no swatch`);
      continue;
    }
    if (box.x < panel.x - 1 || box.x + box.width > panel.x + panel.width + 1) {
      wrong.push(`${name}: x=${Math.round(box.x)}..${Math.round(box.x + box.width)}, the panel is ${Math.round(panel.x)}..${Math.round(panel.x + panel.width)}`);
    }
    if (box.width < 44 || box.height < 44) {
      wrong.push(`${name}: ${Math.round(box.width)}×${Math.round(box.height)}px, under a finger's 44`);
    }
  }
  assert.deepStrictEqual(wrong, [], "a theme swatch is outside the panel or too small to hit");
});

// ── pictures, for a person to judge ────────────────────────────────────

/** One picture per row of the table, named `theme-<name>.png`, each taken with
 *  the panel still open on the page that row paints. Evidence and not an
 *  assertion: whether a palette LOOKS right is a person's call, and these are
 *  what they look at. The pick itself is still waited on, so a picture is
 *  never of the theme before. */
Then("I save a picture of the page in every theme", async function (this: OlaiWorld) {
  for (const palette of PALETTES) {
    await pick(this, palette.name);
    await saveScreenshot(this, `theme-${palette.name}.png`);
  }
});

Then("I save a picture of the theme picker as {string}", async function (this: OlaiWorld, name: string) {
  await showChips(this);
  await saveScreenshot(this, name, themeRow(this));
});

// ── the keyboard ───────────────────────────────────────────────────────

/** Walk the caret with Tab — the way a keyboard reaches a swatch, rather than
 *  a `focus()` no person can make — until it stands on the one offering
 *  `theme`. Bounded, and the failure names where the caret got to. */
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

/** Waited for, not read once — one sentence for the claim however the theme
 *  got here. A pick made in this tab is already on `<html>` by the time the
 *  step that made it returns, and one that crossed from another tab arrives on
 *  a `storage` event a moment later; asserting the second with a bare read
 *  would be asserting that the event crossed instantly. `expectAttribute` is
 *  also what makes the failure name the theme the page IS in. */
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

/** Wait for the chip that offers `theme` to say it is the one in force.
 *  One locator: Playwright retries it, and the attribute IS the claim. */
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
    // The invariant behind the chips, as its own step: a screen reader hears
    // `aria-pressed` and sees none of the ring that says the same thing to
    // everybody else, and a scenario about PICKING a theme should not be the
    // thing that fails when those two drift.
    //
    // ONE snapshot of every chip, so "exactly one is in force" and "the rest
    // say so" are read off the same instant rather than two milliseconds apart.
    await showChips(this);
    const chips = await this.page.locator(THEME_CHIP).evaluateAll((elements) =>
      elements.map((element) => ({
        value: (element as HTMLElement).dataset.value ?? null,
        pressed: element.getAttribute("aria-pressed"),
        name: element.getAttribute("aria-label"),
      })),
    );
    // ONE SWATCH PER PALETTE, and each one NAMED: a swatch is a colour with
    // no word on it, so its accessible name (and its tooltip) is the only
    // way a screen reader — or anybody unsure of a colour — knows what it is.
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
// ── the paint ──────────────────────────────────────────────────────────

/** The one colour a step may talk about: the one the sheet painted and the
 *  browser resolved. It is compared against itself, never against a hex
 *  written here. */
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
  // One page function per attempt — the meta and the tab mark are repainted
  // from the palette a frame after a chip is pressed, so this is a wait.
  // Polled from Node: waitForFunction does not await an async IIFE string, and
  // a Promise is truthy, so that wait would return on the first tick.
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

// ── what this browser keeps ────────────────────────────────────────────

When(
  "this browser has stored the theme {string}",
  async function (this: OlaiWorld, theme: string) {
    // Written straight into storage rather than picked, because the point is a
    // value NO CHIP OFFERS — a theme renamed, a theme dropped, an older olai's
    // spelling. There is no way to reach that state through the UI, which is
    // exactly why it is worth a scenario.
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

// ── before the first paint ─────────────────────────────────────────────

When("I watch for the theme landing", async function (this: OlaiWorld) {
  // Installed before any page script runs, and it reads `document.readyState`
  // at the moment the attribute appears: "loading" is the parser still going,
  // which is the only moment at which no deferred script has run yet.
  //
  // `document` with a subtree filter, because at this point `<html>` does not
  // exist and there is nothing narrower to observe.
  //
  // THE CANVAS IS READ IN THE SAME BREATH, because it is the same moment: the
  // boot script writes the attribute and then the meta, and this callback is
  // a microtask after both. What it catches is the half of the first paint
  // the attribute does not own — the browser's own canvas, scrollbars and
  // form controls, which until the sheet lands go the way the meta says and
  // not the way `data-theme` does.
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

/** What the probe caught, or `null` on a load where no theme was ever
 *  written. One reader for the two steps that ask about that moment. */
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
    // The failure this catches is invisible in a screenshot of the finished
    // page: the sheet puts the canvas right the moment it lands, so the only
    // evidence that a dark palette spent the parse in a light browser is what
    // the meta said during it.
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

/** Where the browser is told what to paint ITSELF in — the canvas behind the
 *  page, the scrollbars, the form controls. Asserted through
 *  `expectChromeAttribute`, which WAITS: a pick repaints this a frame later,
 *  the same way the status bar's colour is repainted. */
const CANVAS = 'meta[name="color-scheme"]';

Then(
  "the canvas is pinned to {string}",
  async function (this: OlaiWorld, scheme: string) {
    await this.expectChromeAttribute(CANVAS, "content", scheme, "the canvas");
  },
);

Then("the canvas follows the system", async function (this: OlaiWorld) {
  // Both words, which is the shell's authored default and the only state in
  // which a page whose JavaScript never ran and a page that handed the theme
  // back look the same — as they should.
  await this.expectChromeAttribute(CANVAS, "content", SYSTEM_SCHEME, "the canvas");
});

// ── and nothing reaches the server ─────────────────────────────────────

When("the appearance controls have finished loading their fonts", async function (this: OlaiWorld) {
  await showChips(this);
  // Opening the picker is a separate action from choosing a color. Let the
  // browser finish layout and the fonts that drawing it requested before
  // measuring the pick; every request after that point still counts.
  await this.page.evaluate(async () => {
    document.documentElement.getBoundingClientRect();
    await document.fonts.ready;
  });
});

When("I watch what the page asks for", function (this: OlaiWorld) {
  this.watchRequests();
});

Then("the page asked for nothing at all", async function (this: OlaiWorld) {
  // A frame first: a request the pick had made would already be in flight, and
  // asserting in the same tick would pass on a page that then went to ask.
  await this.waitForFrame();
  assert.deepStrictEqual(
    [...this.requestsWatched()],
    [],
    "picking a theme is client state; nothing about it should reach a network",
  );
});
