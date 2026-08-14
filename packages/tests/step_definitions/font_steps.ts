/**
 * The typeface: what the Font row writes, what this browser keeps, and what
 * the page sets to. The select is the preferences panel's Font row, so every
 * step here opens that panel first (`preferences_steps.ts`).
 *
 * The typeface TABLE is imported, not read back off the page —
 * `DEFAULT_FONT`, `FONT_ATTRIBUTE` and `FONT_STORAGE_KEY` come from
 * `@olai/fonts`, the package that owns them, for the same reason the theme
 * steps import `theme/palettes.ts`.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { Page } from "playwright";

import {
  DEFAULT_FONT,
  FONT_ATTRIBUTE,
  FONT_STORAGE_KEY,
  typefaceNamed,
} from "@olai/fonts";

import { hintOf, showPreferences } from "./preferences_steps.ts";
import { FONT_SELECT, POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const PROBE = "__olaiFontLanded";

const showSelect = async (
  world: OlaiWorld,
  page: Page = world.page,
): Promise<void> => {
  const select = page.locator(FONT_SELECT);
  if (await select.isVisible().catch(() => false)) return;
  await showPreferences(page);
  await select.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

const pick = async (world: OlaiWorld, name: string): Promise<void> => {
  await showSelect(world);
  await world.page.locator(FONT_SELECT).selectOption(name);
  await world.expectAttribute("html", FONT_ATTRIBUTE, name, "the page");
};

When("I pick the font {string}", async function (this: OlaiWorld, name: string) {
  await pick(this, name);
});

When("I pick the default font", async function (this: OlaiWorld) {
  await pick(this, DEFAULT_FONT);
});

Then("the page names no font", async function (this: OlaiWorld) {
  const named = await this.page.locator("html").getAttribute(FONT_ATTRIBUTE);
  assert.equal(named, null, `the page already names a font: ${named}`);
});

Then(
  "the page is in the font {string}",
  async function (this: OlaiWorld, name: string) {
    await this.expectAttribute("html", FONT_ATTRIBUTE, name, "the page");
  },
);

Then("the page is in the default font", async function (this: OlaiWorld) {
  await this.expectAttribute("html", FONT_ATTRIBUTE, DEFAULT_FONT, "the page");
});

Then("the font row names the typeface in force", async function (this: OlaiWorld) {
  const face = typefaceNamed(
    (await this.page.getAttribute("html", FONT_ATTRIBUTE)) ?? DEFAULT_FONT,
  );
  assert.ok(face, "the page is in a font no row offers");
  const hint = await hintOf(this, "font");
  assert.ok(
    hint.includes(face.hint.slice(0, 24)),
    `the Font row says "${hint}", which is not ${face.label}'s hint`,
  );
});

Then(
  "the font select is {string}",
  async function (this: OlaiWorld, name: string) {
    await showSelect(this);
    const value = await this.page.locator(FONT_SELECT).inputValue();
    assert.equal(value, name, `the Font select is "${value}", not "${name}"`);
  },
);

Then("the font select is the default", async function (this: OlaiWorld) {
  await showSelect(this);
  const value = await this.page.locator(FONT_SELECT).inputValue();
  assert.equal(
    value,
    DEFAULT_FONT,
    `the Font select is "${value}", not the default`,
  );
});

When(
  "this browser has stored the font {string}",
  async function (this: OlaiWorld, name: string) {
    await this.page.evaluate(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [FONT_STORAGE_KEY, name],
    );
  },
);

Then("this browser has stored no font", async function (this: OlaiWorld) {
  const stored = await this.stored(FONT_STORAGE_KEY);
  assert.equal(stored, null, `this browser still keeps "${stored}"`);
});

When(
  "a second tab picks the font {string}",
  async function (this: OlaiWorld, name: string) {
    const other = await this.context.newPage();
    await other.goto("/");
    await showSelect(this, other);
    await other.locator(FONT_SELECT).selectOption(name);
    await other
      .locator(`html[${FONT_ATTRIBUTE}="${name}"]`)
      .waitFor({ state: "attached", timeout: POLL_TIMEOUT })
      .catch(() => {
        throw new Error(
          `the second tab never took the font "${name}", so there was ` +
            "nothing for this one to hear",
        );
      });
  },
);

When("I watch for the font landing", async function (this: OlaiWorld) {
  await this.page.addInitScript(
    ([key, attribute]: ReadonlyArray<string>) => {
      const window_ = window as unknown as Record<string, unknown>;
      window_[key as string] = null;
      new MutationObserver((records) => {
        if (window_[key as string]) return;
        if (!records.some((record) => record.attributeName === attribute)) return;
        window_[key as string] = {
          font: document.documentElement.getAttribute(attribute as string),
          parsing: document.readyState === "loading",
        };
      }).observe(document, {
        attributes: true,
        subtree: true,
        attributeFilter: [attribute as string],
      });
    },
    [PROBE, FONT_ATTRIBUTE],
  );
});

Then(
  "the font {string} landed while the page was still parsing",
  async function (this: OlaiWorld, name: string) {
    const landed = (await this.page.evaluate(
      (key) => (window as unknown as Record<string, unknown>)[key],
      PROBE,
    )) as { font: string; parsing: boolean } | null;
    assert.ok(landed, "no font was ever written on <html>");
    assert.equal(landed.font, name);
    assert.ok(
      landed.parsing,
      "the font landed after the parse: the page flashed the wrong one",
    );
  },
);
