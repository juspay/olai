/**
 * THE PROMOTED SETTINGS, in the preferences panel.
 *
 * A config schema leaf a plugin marks as a preference
 * (`@olai/plugin-api/configuration`'s `preference`) is drawn here, under a
 * heading named after the plugin, and moves out of the plugins panel while
 * that plugin is running. The rows are the plugins panel's own `Control.tsx`
 * wrapped in a preference `Row`, so the steps below address the same
 * `plugin-knob`/`plugin-reset`/`plugin-problem` marks the plugins panel does —
 * read through this panel, by the row's `data-pref`.
 *
 * `data-pref` IS `plugin-<plugin>-<key>` (`PromotedRows.tsx`'s `promotedPref`),
 * so a step names a row by whose it is and which leaf it is, never by its
 * position among a list somebody will reorder.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { showPreferences } from "@olai/tests/harness/preferences.ts";
import { selector } from "@olai/web/testlib";
import { attr, POLL_TIMEOUT, PREFS_ROW, PREFS_SCOPE } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const KNOB = selector(TESTID.pluginKnob);
const GROUP = selector(TESTID.prefsGroup);

/** One promoted row, by the preference it sets. */
const preferenceRow = (world: OlaiWorld, pref: string): Locator =>
  world.page.locator(`${PREFS_ROW}${attr("data-pref", pref)}`);

/** The control inside it — the plugins panel's own knob, drawn here. */
const preferenceKnob = (world: OlaiWorld, pref: string): Locator =>
  preferenceRow(world, pref).locator(KNOB);

const shownValue = async (world: OlaiWorld, pref: string): Promise<string | null> =>
  await preferenceKnob(world, pref).getAttribute("data-value");

// ── where a promoted row is ────────────────────────────────────────────

Then(
  "the preference {string} is drawn under the heading {string}",
  async function (this: OlaiWorld, pref: string, heading: string) {
    await showPreferences(this.page);
    const row = preferenceRow(this, pref);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const group = await row.evaluate((el, where) =>
      el.closest(where)?.getAttribute("aria-label") ?? null, GROUP);
    assert.equal(group, heading, `the ${JSON.stringify(pref)} row to sit under ${JSON.stringify(heading)}`);
  },
);

Then(
  "the preferences group {string} ends its rows with the scope line {string}",
  async function (this: OlaiWorld, heading: string, said: string) {
    await showPreferences(this.page);
    const line = this.page.locator(`${GROUP}${attr("aria-label", heading)} ${PREFS_SCOPE}`);
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await line.innerText()).trim(), said);
  },
);

Then(
  "the preferences group {string} draws no scope line",
  async function (this: OlaiWorld, heading: string) {
    await showPreferences(this.page);
    const line = this.page.locator(`${GROUP}${attr("aria-label", heading)} ${PREFS_SCOPE}`);
    assert.equal(await line.count(), 0, `the ${JSON.stringify(heading)} group to draw no scope line of its own`);
  },
);

// ── what one of them shows, and what pressing it does ──────────────────

Then(
  "the preference {string} shows {string}",
  async function (this: OlaiWorld, pref: string, value: string) {
    await showPreferences(this.page);
    await this.waitUntil(async () => (await shownValue(this, pref)) === value,
      `the ${JSON.stringify(pref)} preference to read ${JSON.stringify(value)}`);
  },
);

When(
  "I pick {string} in the preference {string}",
  async function (this: OlaiWorld, value: string, pref: string) {
    await showPreferences(this.page);
    const knob = preferenceKnob(this, pref);
    await knob.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const select = knob.locator("select");
    if (await select.count()) await select.selectOption(value);
    else await this.press(knob.locator(`${attr("data-value", value)}`));
    await this.waitUntil(async () => (await shownValue(this, pref)) === value, `the ${pref} preference to be ${value}`);
  },
);

When(
  "I type {string} into the preference {string}",
  async function (this: OlaiWorld, value: string, pref: string) {
    await showPreferences(this.page);
    const input = preferenceKnob(this, pref).locator("input");
    await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await input.fill(value);
  },
);

When(
  "I press {string} in the preference {string}",
  async function (this: OlaiWorld, keypress: string, pref: string) {
    await preferenceKnob(this, pref).locator("input").press(keypress);
  },
);

When(
  "I use the default for the preference {string}",
  async function (this: OlaiWorld, pref: string) {
    await this.press(preferenceKnob(this, pref).locator(selector(TESTID.pluginReset)));
  },
);

Then(
  "the preference {string} is marked as authored by {string}",
  async function (this: OlaiWorld, pref: string, author: string) {
    await this.waitUntil(async () => await preferenceKnob(this, pref).getAttribute("data-set-by") === author,
      `the ${pref} preference to be authored by ${author}`);
  },
);

Then(
  "the preference {string} problem says {string}",
  async function (this: OlaiWorld, pref: string, text: string) {
    const line = preferenceKnob(this, pref).locator(selector(TESTID.pluginProblem));
    await this.waitUntil(async () => (await line.allTextContents()).some((one) => one.includes(text)),
      `the ${pref} preference's refusal`);
  },
);

Then(
  "the preference {string} has no problem",
  async function (this: OlaiWorld, pref: string) {
    await this.waitUntil(async () => await preferenceKnob(this, pref).locator(selector(TESTID.pluginProblem)).count() === 0,
      `the ${pref} preference to have no problem`);
  },
);

Then(
  "the preference {string} is frozen because {string}",
  async function (this: OlaiWorld, pref: string, text: string) {
    await showPreferences(this.page);
    // The freeze is announced by whichever element IS the control: the group a
    // segmented choice draws its buttons in, a select, a switch, or an input.
    const titled = preferenceKnob(this, pref).locator("[title]");
    await this.waitUntil(
      async () => (await titled.evaluateAll((els) => els.map((el) => el.getAttribute("title") ?? ""))).some((one) => one.includes(text)),
      `the ${pref} preference to be frozen because ${JSON.stringify(text)}`,
    );
  },
);

Then(
  "the preference {string} shows refused file text {string} inline with default {string}",
  async function (this: OlaiWorld, pref: string, raw: string, fallback: string) {
    await showPreferences(this.page);
    const knob = preferenceKnob(this, pref);
    const input = knob.locator("input");
    await this.waitUntil(async () => await input.inputValue() === raw, `the ${pref} refused file spelling`);
    assert.equal(await input.getAttribute("aria-invalid"), "true");
    const problem = await knob.locator(selector(TESTID.pluginProblem)).innerText();
    assert.ok(problem.includes(`· using ${fallback}`), problem);
    assert.ok(!problem.includes("SchemaError("), problem);
  },
);

Then(
  "the preference {string} input reads {string}",
  async function (this: OlaiWorld, pref: string, value: string) {
    await this.waitUntil(async () => await preferenceKnob(this, pref).locator("input").inputValue() === value,
      `the ${pref} input to read ${JSON.stringify(value)}`);
  },
);

Then(
  "the preference {string} has focus",
  async function (this: OlaiWorld, pref: string) {
    const knob = preferenceKnob(this, pref);
    assert.equal(
      await knob.locator("input, select, [aria-pressed]").first().evaluate((el) => el === document.activeElement),
      true,
    );
  },
);