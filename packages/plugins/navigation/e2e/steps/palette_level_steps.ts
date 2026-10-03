/**
 * The palette's LEVELS: crumbs, a level's rows and sections, a value level's
 * options and submit, and where the caret is.
 *
 * Rows are named by `data-id` rather than by text — a row's text runs its
 * label, hint and place together — and crumbs, sections and the hint by their
 * own text, read as `textContent` because a section heading is drawn in
 * capitals by CSS and `innerText` would read the capitals.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import {
  attr,
  PALETTE,
  PALETTE_ASK_ERROR,
  PALETTE_INPUT,
  PALETTE_ITEM,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { TESTID } from "../../src/testids.ts";

const tid = (id: string) => attr("data-testid", id);
const CRUMB = tid(TESTID.paletteCrumb);
const LEVEL = tid(TESTID.paletteLevel);
const SECTION = tid(TESTID.paletteSection);
const HINT = tid(TESTID.paletteHint);
const OPTION = tid(TESTID.paletteOption);
const SUBMIT = tid(TESTID.paletteSubmit);
const FOOTER = tid(TESTID.paletteFooter);
const STATUS = tid(TESTID.paletteLevelStatus);
const LIST = tid(TESTID.paletteList);

const list = (text: string): ReadonlyArray<string> =>
  text.trim() === "" ? [] : text.split(",").map((one) => one.trim());
const texts = async (world: OlaiWorld, of: string): Promise<ReadonlyArray<string>> =>
  (await world.page.locator(of).allTextContents()).map((one) => one.replace(/\s+/g, " ").trim());
const ids = async (world: OlaiWorld, of: string): Promise<ReadonlyArray<string>> =>
  world.page.locator(of).evaluateAll((all) => all.map((one) => one.getAttribute("data-id") ?? ""));

/** Wait until `read` answers `wanted`, then assert it — so a failure says
 *  what was there rather than that a poll ran out. */
const settlesTo = async <T>(world: OlaiWorld, read: () => Promise<T>, wanted: T, what: string) => {
  await world.waitUntil(
    async () => JSON.stringify(await read()) === JSON.stringify(wanted),
    `${what} to be ${JSON.stringify(wanted)}`,
  ).catch(() => undefined);
  assert.deepStrictEqual(await read(), wanted, what);
};

// ── moving between levels ──────────────────────────────────────────────

/** A POINTER press on a row that opens a level, or on any row that leaves the
 *  palette up; the caret must stay in the box. */
When("I press the palette row {string}", async function (this: OlaiWorld, id: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", id)}`);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(row);
});

When("I press the palette crumb {string}", async function (this: OlaiWorld, label: string) {
  const crumb = this.page.locator(`${CRUMB}${attr("data-id", label)}`);
  await crumb.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(crumb);
});

/** The crumbs, by the row ids that opened them; `""` is the root. */
Then("the palette path is {string}", async function (this: OlaiWorld, path: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await settlesTo(this, () => ids(this, CRUMB), list(path), "the palette's crumbs");
});

Then("the palette crumbs read {string}", async function (this: OlaiWorld, crumbs: string) {
  await settlesTo(this, () => texts(this, CRUMB), list(crumbs).map((one) => `${one} ›`), "the crumbs' words");
});

// ── what a level lists ─────────────────────────────────────────────────

Then("the palette rows are {string}", async function (this: OlaiWorld, rows: string) {
  await settlesTo(this, () => ids(this, `${LIST} ${PALETTE_ITEM}`), list(rows), "the palette's rows");
});

Then("the palette sections are {string}", async function (this: OlaiWorld, sections: string) {
  await settlesTo(this, () => texts(this, SECTION), list(sections), "the palette's section headings");
});

Then("the palette hint says {string}", async function (this: OlaiWorld, hint: string) {
  await settlesTo(this, () => texts(this, HINT), [hint], "the level's hint");
});

Then("the palette has no hint", async function (this: OlaiWorld) {
  await settlesTo(this, () => texts(this, HINT), [], "the level's hint");
});

Then("the palette placeholder is {string}", async function (this: OlaiWorld, placeholder: string) {
  await settlesTo(this, () => this.page.locator(PALETTE_INPUT).getAttribute("placeholder"), placeholder, "the box's placeholder");
});

Then("the palette footer mentions {string}", async function (this: OlaiWorld, words: string) {
  await this.waitUntil(
    async () => (await texts(this, FOOTER)).some((one) => one.includes(words)),
    `the level's footer to mention ${JSON.stringify(words)}`,
  );
});

/** A level row's place — its second line. */
Then("the palette row {string} is placed {string}", async function (this: OlaiWorld, id: string, place: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", id)}`);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.ok((await row.textContent())?.includes(place), `the row ${id} names ${place}`);
});

// ── a value level ──────────────────────────────────────────────────────

Then("the palette options are {string}", async function (this: OlaiWorld, options: string) {
  await settlesTo(this, () => ids(this, OPTION), list(options), "the level's options");
});

Then("the palette option {string} is chosen", async function (this: OlaiWorld, id: string) {
  await settlesTo(
    this,
    () => this.page.locator(OPTION).evaluateAll((all) =>
      all.filter((one) => one.getAttribute("aria-checked") === "true").map((one) => one.getAttribute("data-id"))),
    [id],
    "the chosen option",
  );
});

When("I press the palette option {string}", async function (this: OlaiWorld, id: string) {
  const option = this.page.locator(`${OPTION}${attr("data-id", id)}`);
  await option.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(option);
});

When("I press the palette submit", async function (this: OlaiWorld) {
  const submit = this.page.locator(SUBMIT);
  await submit.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(submit);
});

/** Its refusal, in the palette's refusal line and the alarm's mood. */
Then("the palette refuses with {string}", async function (this: OlaiWorld, sentence: string) {
  await saysThat(this, PALETTE_ASK_ERROR, sentence, "the level's refusal", "alarm", this.page);
});

Then("the palette level is busy", async function (this: OlaiWorld) {
  await this.page.locator(`${LEVEL}${attr("data-busy", "true")}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.locator(`${SUBMIT}:disabled`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.ok((await this.page.locator(SUBMIT).textContent())?.includes("Working"), "the submit says it is working");
});

Then("the palette level is not busy", async function (this: OlaiWorld) {
  await this.page.locator(`${LEVEL}${attr("data-busy", "false")}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── what a person who cannot see it is told ────────────────────────────

Then("the palette announces {string}", async function (this: OlaiWorld, said: string) {
  const status = this.page.locator(STATUS);
  assert.strictEqual(await status.getAttribute("role"), "status");
  assert.strictEqual(await status.getAttribute("aria-live"), "polite");
  await settlesTo(this, async () => (await status.textContent())?.trim() ?? "", said, "the palette's announcement");
});

Then("the palette box has the caret", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => this.page.evaluate((input) => document.activeElement === document.querySelector(input), PALETTE_INPUT),
    "the caret to be in the palette box",
  );
});

/** A value level's options are one radio group named by the level. */
Then("the palette options are a radio group named {string}", async function (this: OlaiWorld, name: string) {
  const group = this.page.locator(`${LEVEL} [role="radiogroup"]`);
  await group.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await group.getAttribute("aria-label"), name);
  const roles = await this.page.locator(OPTION).evaluateAll((all) => all.map((one) => one.getAttribute("role")));
  assert.ok(roles.length > 0 && roles.every((role) => role === "radio"), `every option is a radio: ${roles.join(",")}`);
});
