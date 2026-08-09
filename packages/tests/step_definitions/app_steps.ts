/**
 * The steps that belong to no one feature: opening the app, proving nothing
 * blew up in the console, and proving a later assertion ran against the same
 * document as an earlier one.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { HYDRATION_TIMEOUT, ROOT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

When("I open the app", async function (this: OlaiWorld) {
  await this.open("/");
  // The mount point is the one thing every shape of the app shares, so this
  // separates "the bundle never ran" from "the app rendered the wrong thing".
  await this.page
    .locator(ROOT)
    .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
});

Then("there should be no page errors", function (this: OlaiWorld) {
  assert.deepStrictEqual(
    this.errors,
    [],
    `the page reported ${this.errors.length} error(s):\n  ${this.errors.join("\n  ")}`,
  );
});

Given("I mark the page", async function (this: OlaiWorld) {
  await this.markPage();
});

Then("the page has not reloaded", async function (this: OlaiWorld) {
  assert.ok(
    await this.pageStillMarked(),
    "the marker planted on `window` is gone, so the document was replaced — " +
      "something navigated when it should have re-rendered in place",
  );
});
