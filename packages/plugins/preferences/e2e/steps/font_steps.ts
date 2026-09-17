/**
 * The typeface pick. The preference circuit is `theming.feature`'s; what is
 * unique here is that a generic face asks the server for nothing, so the
 * Font row has to actually change for that fetch to be about a pick.
 */

import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Page } from "@olai/tests/harness/playwright.ts";

import { FONT_ATTRIBUTE } from "@olai/fonts";

import { showPreferences } from "@olai/tests/harness/preferences.ts";
import { FONT_SELECT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const showSelect = async (
  world: OlaiWorld,
  page: Page = world.page,
): Promise<void> => {
  const select = page.locator(FONT_SELECT);
  if (await select.isVisible().catch(() => false)) return;
  await showPreferences(page);
  await select.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

When("I pick the font {string}", async function (this: OlaiWorld, name: string) {
  await showSelect(this);
  await this.page.locator(FONT_SELECT).selectOption(name);
  await this.expectAttribute("html", FONT_ATTRIBUTE, name, "the page");
});

Then(
  "the page is in the font {string}",
  async function (this: OlaiWorld, name: string) {
    await this.expectAttribute("html", FONT_ATTRIBUTE, name, "the page");
  },
);
