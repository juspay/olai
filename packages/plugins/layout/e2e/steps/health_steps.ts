/**
 * THE BAR'S ONE HEALTH DOT, driven the way a person drives it.
 *
 * What is asserted is the dot's `data-health` (the state, never the colour), its
 * accessible name (the words a reader with no pointer gets, and what a person
 * learns without opening anything), which rows its popover holds (by test id —
 * each row is its owner's face, so the id is the owner's), and where the caret
 * is after a key shut it.
 */
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
  // HYDRATION: a tone moves when the wire does (a dropped socket, a survey
  // landing), which is a network's clock rather than a render's.
  await this.expectAttribute(HEALTH, "data-health", tone, "the health dot", HYDRATION_TIMEOUT);
});

/** Its accessible name, which is also the first line of its tip. Contains
 *  rather than equals where the scenario names one piece of news among others
 *  the serve may also be reporting. */
Then("the health dot names {string}", async function (this: OlaiWorld, words: string) {
  const dot = this.page.locator(HEALTH);
  await this.waitUntil(
    async () => ((await dot.getAttribute("aria-label")) ?? "").includes(words),
    `the health dot's name to include ${JSON.stringify(words)}`,
    HYDRATION_TIMEOUT,
  );
  const tip = (await dot.getAttribute("title")) ?? "";
  assert.ok(
    tip.includes(words),
    `the health dot's tip is ${JSON.stringify(tip)}, which does not say ${JSON.stringify(words)} — ` +
      "a pointer should hear what a screen reader hears",
  );
});

Then("the health dot says all is well", async function (this: OlaiWorld) {
  await this.expectAttribute(HEALTH, "aria-label", "Status: all good", "the health dot", HYDRATION_TIMEOUT);
});

When("I open the health popover", async function (this: OlaiWorld) {
  await this.press(this.page.locator(HEALTH));
  await this.page.locator(HEALTH_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I focus the health dot", async function (this: OlaiWorld) {
  await this.page.locator(HEALTH).focus();
});

/** A key pressed wherever the caret is — the dot, the popover, a row. */
When("I press {word} on the health dot", async function (this: OlaiWorld, key: string) {
  await this.page.keyboard.press(key === "Space" ? " " : key);
  await this.waitForFrame();
});

Then("the health popover is open", async function (this: OlaiWorld) {
  await this.page.locator(HEALTH_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.expectAttribute(HEALTH, "aria-expanded", "true", "the health dot");
});

Then("the health popover is shut", async function (this: OlaiWorld) {
  await this.page.locator(HEALTH_PANEL).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  await this.expectAttribute(HEALTH, "aria-expanded", "false", "the health dot");
});

Then("the health dot has the focus", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await focusedOn(this)) === TESTID.health,
    "the caret to be back on the health dot",
  );
});

/** The rows, by their owners' test ids, in the order they are drawn. A listed
 *  id must be there and in that order; others (a plugin this scenario does not
 *  name) may stand between them. */
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
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => (await panel.locator(attr("data-testid", id)).count()) === 0,
    `the ${id} row to leave the health popover`,
  );
});

Then("the commit panel is up", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** THE CALM BAR: what stands in the desktop header's right-hand group is the
 *  search box, the one dot, preferences and who is looking — nothing else. A
 *  pill that found its way back into the bar is the regression this names. */
Then("the desktop header holds only its calm controls", async function (this: OlaiWorld) {
  const chrome = this.page.locator(APP_HEADER).locator(APP_CHROME);
  await chrome.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.locator(HEALTH).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const standing = await chrome.evaluate((row) =>
    [...row.querySelectorAll<HTMLElement>("[data-testid]")]
      // The controls a person SEES in the bar: laid out, and not a part of one.
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
