/**
 * The steps that ask what a gesture did to the SCREEN rather than to the page:
 * what survived it, what moved in one frame, and what was drawn on the way
 * past.
 *
 * They exist because every other assertion in this suite reads the DOM once it
 * has settled, and a column that folded and relit under the reader settles into
 * exactly the markup it started with. The reading itself is `support/probe.ts`
 * — planted before the gesture, read after it — and these are its words.
 *
 * ONE PLANT, SEVERAL CLAIMS. A scenario marks the screen once and then says as
 * many things about that one gesture as it means to; the probe is read afresh
 * per claim, which is a `page.evaluate` and no waiting at all.
 */

import { Given, Then } from "@cucumber/cucumber";

import {
  currentMoved,
  folderHeld,
  markScreen,
  monthHeld,
  neverDrew,
  neverEmptied,
  neverTookAway,
  sidebarHeld,
} from "../support/probe.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Plant it — a serial on every element of the sidebar, and a watch over the
 *  sidebar and the pane. The twin of "I mark the page", one layer in: that one
 *  proves the DOCUMENT survived, this one proves the elements did. */
Given("I mark the screen", async function (this: OlaiWorld) {
  await markScreen(this);
});

Then("the sidebar did not remount", async function (this: OlaiWorld) {
  await sidebarHeld(this);
});

Then(
  "the folder {string} stayed open",
  async function (this: OlaiWorld, path: string) {
    await folderHeld(this, path);
  },
);

Then("the current mark moved in one frame", async function (this: OlaiWorld) {
  await currentMoved(this);
});

Then("the month never changed from {string}", async function (this: OlaiWorld, month: string) {
  await monthHeld(this, month);
});

Then(
  "the node {string} was never drawn",
  async function (this: OlaiWorld, id: string) {
    await neverDrew(this, id);
  },
);

Then(
  "the node {string} was never taken away",
  async function (this: OlaiWorld, id: string) {
    await neverTookAway(this, id);
  },
);

Then("the pane was never empty", async function (this: OlaiWorld) {
  await neverEmptied(this);
});
