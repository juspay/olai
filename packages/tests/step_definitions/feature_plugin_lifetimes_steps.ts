import { TESTID } from "@olai/bundle/testids"
import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";
import { selector } from "@olai/web/testlib"
import { HYDRATION_TIMEOUT, OFFLINE, TITLE_EDITOR } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const contributions: Readonly<Record<string, string>> = {
  files: selector(TESTID.sidebarFiles),
  pins: selector(TESTID.pinShelf),
  capture: selector(TESTID.inboxLink),
  trash: selector(TESTID.trashLink),
  chat: `${selector(TESTID.agentStart)}, ${selector(TESTID.agentStanding)}`,
  journal: selector(TESTID.calendarRow),
};

const parts: Readonly<Record<string, ReadonlyArray<string>>> = {
  files: [selector(TESTID.sidebarFiles), selector(TESTID.newFile)],
  pins: [selector(TESTID.pinShelf)],
  capture: [selector(TESTID.inboxLink)],
  trash: [`${selector(TESTID.sidebarFoot)} ${selector(TESTID.trashLink)}`],
  chat: [selector(TESTID.agentRoster), selector(TESTID.chatNew)],
  journal: [selector(TESTID.agendaLink), selector(TESTID.calendarRow), selector(TESTID.calendarToggle)],
};

Then("every sidebar part of {string} is {word} in this tab", async function(this: OlaiWorld, feature: string, state: string) {
  const selectors = parts[feature];
  assert.ok(selectors, `unknown directory feature ${feature}`);
  assert.ok(state === "present" || state === "absent");
  await this.showSidebar();
  for (const one of selectors) {
    await this.page.locator(one).first().waitFor({
      state: state === "present" ? "attached" : "detached",
      timeout: HYDRATION_TIMEOUT,
    });
  }
});

Then("the directory feature {string} is {word} in this tab", async function(this: OlaiWorld, feature: string, state: string) {
  const selector = contributions[feature];
  assert.ok(selector, `unknown directory feature ${feature}`);
  assert.ok(state === "present" || state === "absent");
  await this.page.locator(selector).first().waitFor({
    state: state === "present" ? "attached" : "detached",
    timeout: HYDRATION_TIMEOUT,
  });
});

Then("the surviving title editor has keyboard focus", async function(this: OlaiWorld) {
  // Inspect focus; never repair a lost caret with a test-authored focus().
  await this.page.locator(OFFLINE).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
  await this.page.waitForFunction(selector => document.activeElement?.matches(selector) === true, TITLE_EDITOR);
});

Then(
  "the page has {int} overlay socket(s)",
  async function (this: OlaiWorld, many: number) {
    const sockets = this.page.locator("[data-olai-overlay]");
    await this.waitUntil(
      async () => (await sockets.count()) === many,
      `${many} overlay socket(s) on the page, and there are ${await sockets.count()}`,
    );
  },
);
