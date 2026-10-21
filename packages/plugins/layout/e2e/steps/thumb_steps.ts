/**
 * THE THUMB BAR (`../../src/Frame.tsx`'s `layout.thumbs`): the bar itself —
 * where it is, how tall, what it holds, what the page clears for it — and a
 * tap on a door. What each door DOES is the owning plugin's claim (a day
 * opens, the agenda opens, the drawer opens, the palette opens), and those are
 * the steps those plugins already have; what is here is the bar's own shape
 * and the thumbs' shared face (`contracts/Thumb.tsx`): its label, whether it
 * is lit, what it counts.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { keysSettled } from "@olai/tests/harness/settling.ts";
import {
  PALETTE_INPUT,
  POLL_TIMEOUT,
  SIDEBAR_BODY,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";

const BAR = selector(TESTID.thumbs);
const NEEDS = selector(PLUGIN_TESTID.agentNeedsYou);
const CHATS = selector(PLUGIN_TESTID.thumbChats);
const AGENDA_PAGE = selector(PLUGIN_TESTID.agendaPage);

/** A door, by the word under its icon — the one thing a person reads. */
const thumb = (world: OlaiWorld, label: string) =>
  world.page.locator(BAR).getByRole("link", { name: label, exact: true })
    .or(world.page.locator(BAR).getByRole("button", { name: label, exact: true }));

Then("the thumb bar holds {string}", async function (this: OlaiWorld, labels: string) {
  await this.page.locator(BAR).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const doors = await this.page.locator(`${BAR} > *`).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? ""));
  assert.deepStrictEqual(doors, labels.split(" "), "the bar's doors, left to right");
});

Then("there is no thumb bar", async function (this: OlaiWorld) {
  await this.page.locator(BAR).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

/** A finger's height (the 44px both platforms print), pinned to the foot of
 *  the viewport, edge to edge, each door at least a finger wide. */
Then("the thumb bar is a finger's height at the foot of the screen", async function (this: OlaiWorld) {
  const bar = await this.box(this.page.locator(BAR), "the thumb bar");
  const viewport = this.viewport();
  assert.ok(bar.height >= 44, `the bar is ${Math.round(bar.height)}px tall, under a finger's 44`);
  assert.ok(Math.abs(bar.y + bar.height - viewport.height) <= 1,
    `the bar's foot is at ${Math.round(bar.y + bar.height)}px on a ${viewport.height}px screen — it is not pinned to the foot`);
  assert.ok(bar.x <= 1 && Math.abs(bar.x + bar.width - viewport.width) <= 1,
    `the bar spans ${Math.round(bar.x)}–${Math.round(bar.x + bar.width)}px of a ${viewport.width}px screen`);
  for (const door of await this.page.locator(`${BAR} > *`).all()) {
    const box = await this.box(door, "a thumb");
    assert.ok(box.width >= 44 && box.height >= 44,
      `${await door.getAttribute("aria-label")} is ${Math.round(box.width)}×${Math.round(box.height)}px, under a finger's size`);
  }
});

/** `--height-bottom-chrome` (`../../src/layout/css.ts`) is what every page's
 *  clearance adds under its last row, so the bar never covers one. Measured
 *  through a box sized by the token rather than read as text: the token is a
 *  `var()` reference, and what matters is what it RESOLVES to. */
Then("the frame reserves the thumb bar's height under the page", async function (this: OlaiWorld) {
  const bar = await this.box(this.page.locator(BAR), "the thumb bar");
  const reserved = await this.page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "var(--height-bottom-chrome, 0px)";
    probe.style.position = "absolute";
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });
  assert.ok(Math.abs(reserved - bar.height) <= 1,
    `the frame reserves ${Math.round(reserved)}px under the page for a bar ${Math.round(bar.height)}px tall`);
});

When("I tap the thumb {string}", async function (this: OlaiWorld, label: string) {
  await this.press(thumb(this, label), "tap");
});

Then("the thumb {string} is current", async function (this: OlaiWorld, label: string) {
  await this.waitUntil(async () => (await thumb(this, label).getAttribute("aria-current")) === "page",
    `the thumb ${label} to be lit as the page`);
});

Then("the thumb {string} is not current", async function (this: OlaiWorld, label: string) {
  await this.waitUntil(async () => (await thumb(this, label).getAttribute("aria-current")) === null,
    `the thumb ${label} to be unlit`);
});

Then("no thumb is current", async function (this: OlaiWorld) {
  await this.page.locator(BAR).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(`${BAR} [aria-current="page"]`).count(), 0, "a thumb is lit on a page none of them opens");
});

Then("the agenda page is open", async function (this: OlaiWorld) {
  await this.page.locator(AGENDA_PAGE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** The badge is `data-waiting`, the count of conversations that need a
 *  person — the Needs you rows — and it is drawn only while it is not zero. */
Then("the Chats thumb counts {int} waiting", async function (this: OlaiWorld, count: number) {
  await this.waitUntil(async () => (await this.page.locator(CHATS).getAttribute("data-waiting")) === String(count),
    `the Chats thumb to count ${count} waiting`);
  assert.strictEqual((await this.page.locator(CHATS).innerText()).replace(/\s+/g, " ").trim(), `${count} Chats`, "the badge is the count and nothing else");
});

Then("the Chats thumb counts nobody", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await this.page.locator(CHATS).getAttribute("data-waiting")) === "0",
    "the Chats thumb to count nobody");
  assert.strictEqual((await this.page.locator(CHATS).innerText()).trim(), "Chats", "a zero is a number nobody acts on, so none is drawn");
});

/** The drawer is open and keyboard focus is inside Needs you — the thumb put
 *  the caret where the waiting agent is, not merely on the drawer. */
Then("the caret is on Needs you", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    () => this.page.evaluate((needs) => document.querySelector(needs)?.contains(document.activeElement) === true, NEEDS),
    "the caret to land inside Needs you",
  );
});

Then("the palette box reads {string}", async function (this: OlaiWorld, text: string) {
  const input = this.page.locator(PALETTE_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => (await input.inputValue()) === text, `the palette box to read ${JSON.stringify(text)}`);
  assert.ok(await input.evaluate((element) => element === document.activeElement), "the palette box has the caret");
});

/** Typed after what is already there — a `fill` would replace the prefix the
 *  thumb primed, which is the thing the scenario is about. */
When("I type {string} into the palette box", async function (this: OlaiWorld, text: string) {
  const input = this.page.locator(PALETTE_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await input.pressSequentially(text);
});

When("I press {string} in the palette", async function (this: OlaiWorld, key: string) {
  await this.page.locator(PALETTE_INPUT).press(key);
  await keysSettled(this);
});
