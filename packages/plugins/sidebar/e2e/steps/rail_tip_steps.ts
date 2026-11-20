import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import {
  POLL_TIMEOUT,
  RAIL_OUTLINES,
  SIDEBAR_EXPAND,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const RAIL: Readonly<Record<string, string>> = {
  expand: SIDEBAR_EXPAND,
  outlines: RAIL_OUTLINES,
};

const railIcon = (world: OlaiWorld, which: string): Locator => {
  const selector = RAIL[which];
  assert.ok(selector !== undefined, `no rail icon is called ${JSON.stringify(which)}`);
  return world.page.locator(selector);
};

When("I hover the rail's {string} icon", async function (this: OlaiWorld, which: string) {
  const icon = railIcon(this, which);
  await icon.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await icon.hover();
});

Then(
  "the rail's {string} icon is named {string}",
  async function (this: OlaiWorld, which: string, name: string) {
    assert.strictEqual(await railIcon(this, which).getAttribute("aria-label"), name);
  },
);

Then(
  "the rail's {string} icon carries no native tooltip",
  async function (this: OlaiWorld, which: string) {
    const title = await railIcon(this, which).getAttribute("title");
    assert.strictEqual(
      title,
      null,
      `the ${which} icon still wears title=${JSON.stringify(title)}, so the browser ` +
        "draws its own tooltip beside the app's",
    );
  },
);
