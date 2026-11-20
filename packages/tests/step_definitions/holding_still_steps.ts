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
import { HYDRATION_TIMEOUT, PANE, SIDEBAR, type OlaiWorld } from "../support/world.ts";

Given("I mark the screen", async function (this: OlaiWorld) {
  // Establish both regions before marking them.
  await Promise.all([SIDEBAR, PANE].map((region) =>
    this.page.locator(region).first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
  ));
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
