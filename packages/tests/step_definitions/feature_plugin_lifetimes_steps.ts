import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";
import { TESTID } from "@olai/web/testlib";
import { CHAT_TOGGLE, HYDRATION_TIMEOUT, OFFLINE, TITLE_EDITOR } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const contributions: Readonly<Record<string, string>> = {
  files: `[data-testid="${TESTID.sidebarFiles}"]`,
  pins: `[data-testid="${TESTID.pinShelf}"]`,
  capture: `[data-testid="${TESTID.inboxLink}"]`,
  trash: `[data-testid="${TESTID.trashLink}"]`,
  chat: CHAT_TOGGLE,
};

Then("the directory feature {string} is {word} in this tab", async function(this: OlaiWorld, feature: string, state: string) {
  const selector = contributions[feature];
  assert.ok(selector, `unknown directory feature ${feature}`);
  assert.ok(state === "present" || state === "absent");
  await this.page.locator(selector).first().waitFor({
    state: state === "present" ? "visible" : "detached",
    timeout: HYDRATION_TIMEOUT,
  });
});

Then("the surviving title editor has keyboard focus", async function(this: OlaiWorld) {
  // Another tab's switch is not this tab's activation receipt. Once the
  // contribution actually changed, await its redial and browser focus restore.
  // Inspect focus; never repair a lost caret with a test-authored focus().
  await this.page.locator(OFFLINE).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
  await this.page.waitForFunction(selector => document.activeElement?.matches(selector) === true, TITLE_EDITOR);
});
