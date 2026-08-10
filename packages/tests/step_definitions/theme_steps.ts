/**
 * The theme picker: what a chip writes, what this browser keeps, and what the
 * page repaints to.
 *
 * The theme NAMES are read off the page — the picker carries `data-default`
 * and every chip carries `data-value` — and so is the storage key
 * (`data-store-key`). The client owns that table; a suite with its own copy of
 * it would only ever be the copy that is out of date. The one thing spelled
 * here is the two themes a scenario asks for by name, which is the scenario
 * saying what it wants rather than this file knowing anything.
 *
 * No step asserts on a COLOUR it wrote down. The paper is compared against
 * itself (before a pick, after a pick) and against what the browser chrome and
 * the manifest say — never against a hex written in a test, which would be the
 * suite holding a design decision hostage.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  THEME_CHIP,
  THEME_PICKER,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** What the parse probe leaves on `window`. Named once: an init script and two
 *  steps have to agree about it. */
const PROBE = "__olaiThemeLanded";

// ── picking ────────────────────────────────────────────────────────────

When("I pick the theme {string}", async function (this: OlaiWorld, theme: string) {
  await pick(this, theme);
});

When("I pick the default theme", async function (this: OlaiWorld) {
  await pick(this, await defaultTheme(this));
});

/** Press a chip, and wait for the PAGE to say it is in that theme.
 *
 *  Waiting on the page rather than on the click is what keeps everything after
 *  it an assertion about the theme instead of about timing: the attribute is
 *  written in the click handler, so this settles in a tick, and if it ever
 *  stops settling the failure is here rather than three steps later. */
const pick = async (world: OlaiWorld, theme: string): Promise<void> => {
  await world.showSidebar();
  await world.press(world.page.locator(`${THEME_CHIP}[data-value="${theme}"]`));
  await world.page.waitForFunction(
    (wanted) =>
      document.documentElement.getAttribute("data-theme") === wanted,
    theme,
    { timeout: POLL_TIMEOUT },
  );
};

// ── what the page is in ────────────────────────────────────────────────

/** The theme `<html>` NAMES, or null for the page nobody has picked on. */
const namedTheme = (world: OlaiWorld): Promise<string | null> =>
  world.page.locator("html").getAttribute("data-theme");

/** The theme the picker falls back to, asked of the picker. */
const defaultTheme = async (world: OlaiWorld): Promise<string> => {
  const picker = world.page.locator(THEME_PICKER);
  await picker.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  const fallback = await picker.getAttribute("data-default");
  assert.ok(fallback, "the picker does not say which theme is the default");
  return fallback;
};

Then("the page names no theme", async function (this: OlaiWorld) {
  // No attribute is not "no theme": it is the DEFAULT, which the sheet paints
  // on the bare `:root`. The distinction is the point — this is the page
  // nobody has picked on yet.
  const named = await namedTheme(this);
  assert.equal(named, null, `the page already names a theme: ${named}`);
});

Then(
  "the page is in the theme {string}",
  async function (this: OlaiWorld, theme: string) {
    assert.equal(await namedTheme(this), theme);
  },
);

Then("the page is in the default theme", async function (this: OlaiWorld) {
  assert.equal(await namedTheme(this), await defaultTheme(this));
});

Then(
  "the lit theme chip is {string}",
  async function (this: OlaiWorld, theme: string) {
    assert.equal(await litChip(this), theme);
  },
);

Then("the lit theme chip is the default", async function (this: OlaiWorld) {
  assert.equal(await litChip(this), await defaultTheme(this));
});

/** Every chip: which theme it offers, and what it announces. */
const chips = (
  world: OlaiWorld,
): Promise<ReadonlyArray<{ value: string | undefined; pressed: string | null }>> =>
  world.page
    .locator(THEME_CHIP)
    .evaluateAll((elements) =>
      elements.map((element) => ({
        value: (element as HTMLElement).dataset.value,
        pressed: element.getAttribute("aria-pressed"),
      })),
    );

/** Which theme the picker says is in force. Exactly one chip is, always. */
const litChip = async (world: OlaiWorld): Promise<string> => {
  await world.page.waitForFunction(
    (chip) => document.querySelectorAll(`${chip}[aria-pressed="true"]`).length === 1,
    THEME_CHIP,
    { timeout: POLL_TIMEOUT },
  );
  const lit = (await chips(world)).find((chip) => chip.pressed === "true");
  assert.ok(lit?.value, "no chip says it is the one in force");
  return lit.value;
};

Then(
  "every theme chip agrees with what it announces",
  async function (this: OlaiWorld) {
    // The invariant behind the chips, as its own step: a screen reader hears
    // `aria-pressed` and sees none of the ring that says the same thing to
    // everybody else, and a scenario about PICKING a theme should not be the
    // thing that fails when those two drift.
    const lit = await litChip(this);
    for (const chip of await chips(this)) {
      assert.equal(
        chip.pressed,
        chip.value === lit ? "true" : "false",
        `the ${chip.value} chip announces aria-pressed="${chip.pressed}"`,
      );
    }
  },
);

// ── the paint ──────────────────────────────────────────────────────────

/** The one colour a step may talk about: the one the sheet painted and the
 *  browser resolved. It is compared against itself, never against a hex
 *  written here. */
const paper = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-paper")
      .trim(),
  );

When("I note the paper colour", async function (this: OlaiWorld) {
  this.paperBefore = await paper(this);
  assert.ok(this.paperBefore, "the sheet paints no --color-paper");
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
  // A wait rather than a read: the meta is repainted from the palette after a
  // chip is pressed, which is a frame away. Short — a mismatch is a fact
  // within a frame or two, and the rest of the budget would only buy a worse
  // message.
  try {
    await this.waitUntil(
      async () => sameColour(await chromeColour(this), await paper(this)),
      "the theme-color meta says what the page is painted in",
      5_000,
    );
  } catch (cause) {
    // The timeout says "it never matched"; say WHAT it said instead.
    assert.equal(
      (await chromeColour(this))?.toLowerCase(),
      (await paper(this)).toLowerCase(),
      "the browser chrome is not the colour the page is painted in",
    );
    throw cause;
  }
});

const chromeColour = (world: OlaiWorld): Promise<string | null> =>
  world.page.evaluate(
    () =>
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content") ?? null,
  );

/** Two colours, compared the way a browser would: `#FAFAF6` and `#fafaf6` are
 *  one colour, and only one of the two ends of every comparison here is
 *  something this app wrote by hand. */
const sameColour = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && a.toLowerCase() === b.toLowerCase();

Then(
  "the manifest's chrome is the paper this page paints",
  async function (this: OlaiWorld) {
    const manifest = await this.fetch("/manifest.webmanifest");
    assert.equal(manifest.status, 200);
    const { theme_color, background_color } = JSON.parse(
      manifest.body.toString("utf8"),
    ) as {
      theme_color?: string;
      background_color?: string;
    };
    const unpicked = await paper(this);
    assert.ok(
      sameColour(theme_color ?? null, unpicked),
      `the manifest opens in ${theme_color}, but an unpicked page is ${unpicked}`,
    );
    assert.ok(
      sameColour(background_color ?? null, unpicked),
      `the manifest's background is ${background_color}, not ${unpicked}`,
    );
  },
);

// ── what this browser keeps ────────────────────────────────────────────

/** Where the pick is stored, asked of the picker rather than spelled here. */
const storeKey = async (world: OlaiWorld): Promise<string> => {
  const key = await world.page.locator(THEME_PICKER).getAttribute("data-store-key");
  assert.ok(key, "the picker does not say where this browser keeps a pick");
  return key;
};

When(
  "this browser has stored the theme {string}",
  async function (this: OlaiWorld, theme: string) {
    // Written straight into storage rather than picked, because the point is a
    // value NO CHIP OFFERS — a theme renamed, a theme dropped, an older olai's
    // spelling. There is no way to reach that state through the UI, which is
    // exactly why it is worth a scenario.
    await this.page.evaluate(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [await storeKey(this), theme],
    );
  },
);

Then("this browser has stored no theme", async function (this: OlaiWorld) {
  const stored = await this.page.evaluate(
    (key) => localStorage.getItem(key),
    await storeKey(this),
  );
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
  await this.page.addInitScript((key: string) => {
    (window as unknown as Record<string, unknown>)[key] = null;
    new MutationObserver((records) => {
      if ((window as unknown as Record<string, unknown>)[key]) return;
      if (!records.some((record) => record.attributeName === "data-theme")) return;
      (window as unknown as Record<string, unknown>)[key] = {
        theme: document.documentElement.getAttribute("data-theme"),
        parsing: document.readyState === "loading",
      };
    }).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-theme"],
    });
  }, PROBE);
});

When("I reload the page", async function (this: OlaiWorld) {
  await this.open(this.pathname());
});

Then(
  "the theme {string} landed while the page was still parsing",
  async function (this: OlaiWorld, theme: string) {
    const landed = (await this.page.evaluate(
      (key) => (window as unknown as Record<string, unknown>)[key],
      PROBE,
    )) as { theme: string; parsing: boolean } | null;
    assert.ok(landed, "no theme was ever written on <html>");
    assert.equal(landed.theme, theme);
    assert.ok(
      landed.parsing,
      "the theme landed after the parse: the page flashed the wrong one",
    );
  },
);

// ── and nothing reaches the server ─────────────────────────────────────

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
