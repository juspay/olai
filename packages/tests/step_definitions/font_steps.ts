/**
 * The typeface pick. The preference circuit is `theming.feature`'s; what is
 * unique here is that a generic face asks the server for nothing, so the
 * Font row has to actually change for that fetch to be about a pick.
 */

import { Then, When } from "@cucumber/cucumber";
import type { Page } from "playwright";

import { FONT_ATTRIBUTE } from "@olai/fonts";

import { showPreferences } from "./preferences_steps.ts";
import { FONT_SELECT, POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

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
