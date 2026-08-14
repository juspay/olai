/**
 * The three input widgets: what a trigger character puts on screen, what
 * walking it does, and what taking a row writes.
 *
 * Its own file for the reason `date_steps.ts` is one: a completion is a surface
 * with a state of its own — an armed trigger, a shortlist, one active row — and
 * the rest of the editor's steps are about a line of text.
 *
 * What the DIRECTORY says afterwards is deliberately NOT here. A day lands as a
 * `date` field and a chosen node lands as a placement, and both are asked with
 * the disk assertions that already exist (`editing_steps.ts`) — because the
 * claim these scenarios make is that a widget sends the SAME edit the pill's
 * picker and the agent's tools send, and a second spelling of "the file says
 * so" would be a second answer to that.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import {
  COMPLETION_ITEM,
  COMPLETION_ITEM_PLACE,
  COMPLETIONS,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const panel = (world: OlaiWorld) => world.page.locator(COMPLETIONS);

const rows = (world: OlaiWorld) => world.page.locator(COMPLETION_ITEM);

// ── is it there, and which one is it ───────────────────────────────────

/** WHICH widget, off `data-kind` — `date`, `tag` or `mirror`. Named rather
 *  than guessed from the rows, because the whole design claim is that one
 *  scan decides which of three characters the caret is inside. */
Then(
  "the {word} completions are open",
  async function (this: OlaiWorld, kind: string) {
    await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await panel(this).getAttribute("data-kind"), kind);
  },
);

/** Nothing armed, or nothing matched — which are the same thing on screen and
 *  deliberately so: a widget with nothing to offer draws no box. */
Then("no completions are open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await panel(this).count()) === 0,
    "the completion list to be gone from the page",
  );
});

// ── what is in it ──────────────────────────────────────────────────────

/** The rows, top to bottom, as `label` — a comma-separated list, the way every
 *  other ordered assertion in this suite is written. The `hint` beside a label
 *  (the day a phrase means, how many nodes carry a tag) is asked separately, so
 *  a list assertion does not have to restate today's date. */
Then(
  "the completions list {string}",
  async function (this: OlaiWorld, wanted: string) {
    const expected = wanted.split(",").map((one) => one.trim());
    await this.waitUntil(async () => {
      const found = await labels(this);
      return found.length === expected.length &&
        found.every((label, at) => label === expected[at]);
    }, `the completions to list ${JSON.stringify(expected)}`);
  },
);

Then(
  "the completions include {string}",
  async function (this: OlaiWorld, wanted: string) {
    await this.waitUntil(
      async () => (await labels(this)).includes(wanted),
      `the completions to include ${JSON.stringify(wanted)}`,
    );
  },
);

/** The DAY a phrase stands for, which every row says out loud beside it —
 *  `next friday` is an argument about which Friday, and this is the promise
 *  that nobody has to press Enter to find out. */
Then(
  "the completion {string} says {string}",
  async function (this: OlaiWorld, label: string, hint: string) {
    await this.waitUntil(async () => {
      const row = rows(this).filter({ hasText: label }).first();
      return (await row.count()) > 0 &&
        oneLine(await row.innerText()).includes(hint);
    }, `the completion ${JSON.stringify(label)} to say ${JSON.stringify(hint)}`);
  },
);

/** WHERE a `((` hit sits — the second line of its row, which is what makes a
 *  bare title mean something in a list of strangers. Its own step because it is
 *  its own line, and only the node rows have one. */
Then(
  "the completion {string} sits at {string}",
  async function (this: OlaiWorld, label: string, place: string) {
    const row = rows(this).filter({ hasText: label }).first();
    await this.waitUntil(async () => {
      const line = row.locator(COMPLETION_ITEM_PLACE);
      return (await line.count()) === 1 && oneLine(await line.innerText()) === place;
    }, `the completion ${JSON.stringify(label)} to sit at ${JSON.stringify(place)}`);
  },
);

/** Which row Enter would take. The arrows move it, and a scenario that only
 *  asserted the list would never notice them. */
Then(
  "the active completion is {string}",
  async function (this: OlaiWorld, label: string) {
    const active = this.page.locator(`${COMPLETION_ITEM}[data-active="true"]`);
    await this.waitUntil(async () => {
      if ((await active.count()) !== 1) return false;
      return (await active.first().innerText()).split("\n")[0]?.trim() === label;
    }, `the active completion to be ${JSON.stringify(label)}`);
  },
);

// ── taking one ─────────────────────────────────────────────────────────

/** With the POINTER, which is the door a scenario can name a row through
 *  without counting arrow presses. The row prevents the default on mousedown,
 *  so this must not blur the line being typed — which is itself part of what
 *  the click proves. */
When(
  "I choose {string} from the completions",
  async function (this: OlaiWorld, label: string) {
    const row = rows(this).filter({ hasText: label }).first();
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await row.click();
    await this.waitForFrame();
  },
);

/** The FIRST line of each row: a `((` row carries where the node sits on a
 *  second line, and that is asked by its own step. A page with no panel has no
 *  rows either, so this answers `[]` without a separate look. */
const labels = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  (await rows(world).allInnerTexts()).map((text) => oneLine(text.split("\n")[0] ?? ""));
