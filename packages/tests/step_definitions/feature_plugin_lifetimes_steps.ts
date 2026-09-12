import { TESTID } from "@olai/bundle/testids"
import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";
import { selector } from "@olai/web/testlib"
import { CHAT_TOGGLE, HYDRATION_TIMEOUT, OFFLINE, TITLE_EDITOR } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const contributions: Readonly<Record<string, string>> = {
  files: selector(TESTID.sidebarFiles),
  pins: selector(TESTID.pinShelf),
  capture: selector(TESTID.inboxLink),
  trash: selector(TESTID.trashLink),
  chat: `${selector(TESTID.agentStart)}, ${selector(TESTID.agentStanding)}`,
};

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
  // Another tab's switch is not this tab's activation receipt. Once the
  // contribution actually changed, await its redial and browser focus restore.
  // Inspect focus; never repair a lost caret with a test-authored focus().
  await this.page.locator(OFFLINE).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
  await this.page.waitForFunction(selector => document.activeElement?.matches(selector) === true, TITLE_EDITOR);
});

/**
 * THE OVERLAY SOCKET, COUNTED — the one page element whose lifetime this phase
 * moved.
 *
 * Every overlay the outline hangs over the page (the completions popper, the
 * row menu's dropdown, the sentence beside it) mounts into one fixed box at the
 * viewport origin. That box used to be `@olai/web`'s: appended the first time
 * an overlay asked and remembered in a module variable for the life of the tab,
 * so turning the outline off left it behind and turning it on again reused a
 * container nobody was responsible for (the audit's §10).
 *
 * It is the outline row's now, minted inside the same acquisition that holds
 * the rest of that row's browser state — so this counts the boxes rather than
 * asking whether a menu opens: a residue is invisible by definition, and the
 * only way to see one is to switch the row and count. `data-olai-overlay` is
 * the socket's own marker (`olai-plugin-outlines/browser/overlay.ts`), not a
 * testid, because nothing draws it and nothing presses it.
 */
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
