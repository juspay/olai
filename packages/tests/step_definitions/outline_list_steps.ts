/**
 * The sidebar: what the served directory turned out to contain.
 */

import * as assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";

import {
  HYDRATION_TIMEOUT,
  OUTLINE_LINK,
  OUTLINE_LIST,
  OUTLINE_TREE,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Then("the outline list is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(OUTLINE_LIST)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("no outline list is shown", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(OUTLINE_LIST).count(),
    0,
    "the sidebar is on screen; an invalid set shows the error view INSTEAD of it",
  );
});

Then(
  "the outline list has {int} entries",
  async function (this: OlaiWorld, expected: number) {
    const links = this.page.locator(`${OUTLINE_LIST} ${OUTLINE_LINK}`);
    // Wait for the expected count rather than reading it once: the list is
    // painted from the first snapshot, and reading during the frame that adds
    // the second entry would see one.
    await links
      .nth(expected - 1)
      .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const files = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-file")),
    );
    assert.strictEqual(
      files.length,
      expected,
      `expected ${expected} outline(s) in the sidebar, found ${files.length}: ${files.join(", ")}`,
    );
  },
);

Then(
  "the outline list links to {string}",
  async function (this: OlaiWorld, file: string) {
    await this.outlineLink(file).waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
  },
);

Then(
  "the outline list does not link to {string}",
  async function (this: OlaiWorld, file: string) {
    assert.strictEqual(
      await this.outlineLink(file).count(),
      0,
      `the sidebar links to "${file}", which is not an outline`,
    );
  },
);

Given(
  "I open the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.open("/");
    const link = this.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    // The tree is the app's answer to the click; waiting for it here means
    // every later step starts from a rendered outline rather than racing it.
    await this.page
      .locator(OUTLINE_TREE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitForFrame();
  },
);
