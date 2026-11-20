import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib";

import { EMPTY_UNDER, emptyPage, oneLine, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";

const NEW_OUTLINE = selector(TESTID.nothingNewOutline);
const GO_HOME = selector(TESTID.missingGoHome);

Then("the empty page says {string}", async function (this: OlaiWorld, line: string) {
  const { said } = emptyPage(this.page);
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => oneLine(await said.innerText()) === line,
    `the empty page to say ${JSON.stringify(line)}`,
  );
});

Then("the empty page explains {string}", async function (this: OlaiWorld, detail: string) {
  const { detail: under } = emptyPage(this.page);
  await under.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(oneLine(await under.innerText()), detail);
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

Then("the empty zoomed page says {string}", async function (this: OlaiWorld, line: string) {
  const said = this.page.locator(EMPTY_UNDER);
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => oneLine(await said.innerText()) === line,
    `the zoomed page to say ${JSON.stringify(line)}`,
  );
});

Then("the empty page offers no New outline", async function (this: OlaiWorld) {
  await emptyPage(this.page).said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(NEW_OUTLINE).count(), 0);
});
