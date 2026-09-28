/**
 * THE PAGE WITH NOTHING ON IT, and the next step it offers (`../src/browser/
 * Nothing.tsx`): `No outlines yet` with `New outline` on a directory holding
 * none, and `Page not found` with `Go home` on a path that names nothing.
 *
 * Its own file because it is its own surface: the tree steps are about rows,
 * and an empty page has none. The sentence is read through the one testid the
 * shared `Empty` puts on it; the button through the testid this row gives it.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib";

import { EMPTY_UNDER, NOTHING, oneLine, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";

const NEW_OUTLINE = selector(TESTID.nothingNewOutline);
const GO_HOME = selector(TESTID.missingGoHome);

Then("the empty page says {string}", async function (this: OlaiWorld, line: string) {
  const said = this.page.locator(NOTHING).first();
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => oneLine(await said.innerText()) === line,
    `the empty page to say ${JSON.stringify(line)}`,
  );
});

/** The short second line under it — what the page was asked for, in words. */
Then("the empty page explains {string}", async function (this: OlaiWorld, detail: string) {
  const line = this.page.locator(NOTHING).first().locator("xpath=following-sibling::p");
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(oneLine(await line.innerText()), detail);
});

When("I press New outline on the empty page", async function (this: OlaiWorld) {
  const button = this.page.locator(NEW_OUTLINE);
  assert.strictEqual(oneLine(await button.innerText()), "New outline");
  await this.press(button);
});

When("I press Go home on the empty page", async function (this: OlaiWorld) {
  const button = this.page.locator(GO_HOME);
  assert.strictEqual(oneLine(await button.innerText()), "Go home");
  await this.press(button);
});

/** A ZOOMED node with nothing drawn under it (`../../src/browser/NodePage.tsx`):
 *  a leaf says so, and a subtree the done-pick swept says THAT, which is the
 *  one on-screen sentence about the pick on that page. */
Then("the empty zoomed page says {string}", async function (this: OlaiWorld, line: string) {
  const said = this.page.locator(EMPTY_UNDER);
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => oneLine(await said.innerText()) === line,
    `the zoomed page to say ${JSON.stringify(line)}`,
  );
});

Then("the empty page offers no New outline", async function (this: OlaiWorld) {
  await this.page.locator(NOTHING).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(NEW_OUTLINE).count(), 0);
});
