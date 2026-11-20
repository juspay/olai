import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { focusedOn } from "@olai/tests/harness/caret.ts";

import {
  APP_CHROME,
  APP_CHROME_CONTROLS,
  APP_HEADER,
  attr,
  COMMIT_PANEL,
  HEALTH,
  HEALTH_PANEL,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  PREFS_TRIGGER,
} from "@olai/tests/harness/world.ts";
import { TESTID } from "olai-plugin-layout/testids";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the health dot is {string}", async function (this: OlaiWorld, tone: string) {
  await this.expectChromeAttribute(HEALTH, "data-health", tone, "the health dot", HYDRATION_TIMEOUT);
});

Then("the health dot names {string}", async function (this: OlaiWorld, words: string) {
  const dot = this.page.locator(HEALTH);
  await this.waitUntil(
    async () => ((await dot.getAttribute("aria-label")) ?? "").includes(words),
    `the health dot's name to include ${JSON.stringify(words)}`,
    HYDRATION_TIMEOUT,
  );
  const told = (await dot.locator('[role="img"]').getAttribute("aria-label")) ?? "";
  assert.ok(
    told.includes(words),
    `the health dot's story is ${JSON.stringify(told)}, which does not say ${JSON.stringify(words)} — ` +
      "a pointer should hear what a screen reader hears",
  );
});

Then("the health dot says all is well", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(HEALTH, "aria-label", "Status: all good", "the health dot", HYDRATION_TIMEOUT);
});

When("I open the health popover", async function (this: OlaiWorld) {
  await this.press(this.page.locator(HEALTH));
  await this.page.locator(HEALTH_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I focus the health dot", async function (this: OlaiWorld) {
  await this.page.locator(HEALTH).focus();
});

When("I press {word} on the health dot", async function (this: OlaiWorld, key: string) {
  await this.page.keyboard.press(key === "Space" ? " " : key);
  await this.waitForFrame();
});

Then("the health popover is open", async function (this: OlaiWorld) {
  await this.page.locator(HEALTH_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.expectChromeAttribute(HEALTH, "aria-expanded", "true", "the health dot");
});

Then("the health popover is shut", async function (this: OlaiWorld) {
  await this.page.locator(HEALTH_PANEL).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  await this.expectChromeAttribute(HEALTH, "aria-expanded", "false", "the health dot");
});

Then("the health dot has the focus", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await focusedOn(this)) === TESTID.health,
    "the caret to be back on the health dot",
  );
});

Then("the health popover lists, in order:", async function (this: OlaiWorld, table: { raw(): string[][] }) {
  const wanted = table.raw().map((row) => row[0] ?? "");
  const panel = this.page.locator(HEALTH_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const order = async () => panel.evaluate((box) =>
    [...box.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid") ?? "")
  );
  await this.waitUntil(async () => {
    const shown = await order();
    let at = -1;
    return wanted.every((id) => {
      const next = shown.indexOf(id, at + 1);
      if (next === -1) return false;
      at = next;
      return true;
    });
  }, `the health popover to list ${JSON.stringify(wanted)} in that order`).catch(async () => {
    assert.fail(`the health popover lists ${JSON.stringify(await order())}, not ${JSON.stringify(wanted)} in order`);
  });
  const shown = await order();
  assert.equal(
    shown.filter((id) => id === wanted.at(-1)).length,
    1,
    `${wanted.at(-1)} appears more than once in ${JSON.stringify(shown)}`,
  );
});

Then("the health popover has no {string} row", async function (this: OlaiWorld, id: string) {
  const panel = this.page.locator(HEALTH_PANEL);
  await panel.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => (await panel.locator(attr("data-testid", id)).count()) === 0,
    `the ${id} row to leave the health popover`,
  );
});

Then("the {string} row wears a {string} dot", async function (this: OlaiWorld, id: string, tone: string) {
  const dot = `${HEALTH_PANEL} ${attr("data-testid", id)} [data-health]`;
  await this.expectChromeAttribute(dot,"data-health", tone, `the ${id} row's dot`, HYDRATION_TIMEOUT);
});

Then("the health popover's first row is {string}", async function (this: OlaiWorld, id: string) {
  const panel = this.page.locator(HEALTH_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const first = async () => panel.evaluate((box) => box.querySelector("[data-testid]")?.getAttribute("data-testid") ?? "");
  await this.waitUntil(async () => (await first()) === id, `the health popover's first row to be ${id}`).catch(async () => {
    assert.fail(`the health popover's first row is ${JSON.stringify(await first())}, not ${JSON.stringify(id)}`);
  });
});

Then("a row of the health popover wears the health dot's tone", async function (this: OlaiWorld) {
  const tone = (await this.page.locator(HEALTH).getAttribute("data-health")) ?? "";
  const panel = this.page.locator(HEALTH_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const rows = await panel.evaluate((box) =>
    [...box.querySelectorAll("[data-health]")].map((el) => el.getAttribute("data-health") ?? ""));
  assert.ok(
    tone === "healthy" || rows.includes(tone),
    `the health dot is "${tone}" but the popover's rows wear ${JSON.stringify(rows)}`,
  );
});

Then("the commit panel is up", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the desktop header holds only its calm controls", async function (this: OlaiWorld) {
  const chrome = this.page.locator(APP_HEADER).locator(APP_CHROME);
  await chrome.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.locator(HEALTH).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const standing = await chrome.evaluate((row) =>
    [...row.querySelectorAll<HTMLElement>("[data-testid]")]
      .filter((el) => el.getClientRects().length > 0 && el.parentElement?.closest("[data-testid]") === row)
      .map((el) => el.getAttribute("data-testid") ?? "")
  );
  const extra = standing.filter((id) => !APP_CHROME_CONTROLS.includes(id));
  assert.deepEqual(
    extra,
    [],
    `the bar stands ${JSON.stringify(standing)}; ${JSON.stringify(extra)} are not the calm bar's — ` +
      "a status readout belongs in the health popover",
  );
  assert.ok(standing.includes(TESTID.health), `the bar has no health dot: ${JSON.stringify(standing)}`);
  assert.ok(await chrome.locator(PREFS_TRIGGER).isVisible(), "the bar has no preferences door");
});
