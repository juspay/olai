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

/**
 * Nothing on the page may make it pan sideways — a whole-app invariant, and
 * here because everything that can break it is shared: one markdown pipeline
 * draws a note, a document and an agent's reply, so any of the three can
 * regress it and a rule that lived under one of them would only be asked about
 * that one.
 *
 * It is asked of the SCROLL CONTAINERS, not of `documentElement`. The main
 * pane is `overflow-x-auto` (App.tsx) precisely so a runaway block cannot
 * reach the window — which means the window's own `scrollWidth` says nothing,
 * and a step that read it would pass over a page the reader has to pan. What
 * over-wide content is allowed to do is scroll WITHIN itself: a fence, a
 * table. What it may not do is make the pane it is written in scroll, and the
 * pane is what is measured.
 */
Then("nothing overflows the pane", async function (this: OlaiWorld) {
  await this.page.locator(ROOT).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  const panned = await this.page.evaluate(() =>
    [...document.querySelectorAll("main, aside")]
      .filter((pane) => pane.scrollWidth > pane.clientWidth)
      .map((pane) => `${pane.tagName.toLowerCase()}: ${pane.scrollWidth}>${pane.clientWidth}`)
  );
  assert.deepStrictEqual(panned, [], "these panes have to be panned sideways to be read");
});

/** A genuine reload of whatever is open — the page comes back cold, from the
 *  server, with only what this browser stored to carry anything across. Here
 *  rather than in a feature's own steps because nothing about it is any one
 *  feature's, and a second copy would make Cucumber fail the whole run on an
 *  ambiguous definition.
 *
 *  The WHOLE address, query and all: a filtered page's `?q=` is part of what a
 *  reader would have in the bar (`client/routes.ts`), so reloading the path
 *  alone would be this step quietly opening a different page than the one that
 *  was open. */
When("I reload the page", async function (this: OlaiWorld) {
  await this.open(this.address());
});

Then("the page has not reloaded", async function (this: OlaiWorld) {
  assert.ok(
    await this.pageStillMarked(),
    "the marker planted on `window` is gone, so the document was replaced — " +
      "something navigated when it should have re-rendered in place",
  );
});
