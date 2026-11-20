import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";

import { Then, When } from "@olai/tests/harness/runner.ts";



import {
  COMPLETION_ITEM,
  COMPLETIONS,
  NODE_GUTTER,
  oneLine,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  COMPLETION_ITEM_PLACE,
} from "../selectors.ts";
import { theListIsGone } from "@olai/tests/harness/caret.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const panel = (world: OlaiWorld) => world.page.locator(COMPLETIONS);

const rows = (world: OlaiWorld) => world.page.locator(COMPLETION_ITEM);

Then(
  "the {word} completions are open",
  async function (this: OlaiWorld, kind: string) {
    await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await panel(this).getAttribute("data-kind"), kind);
  },
);

Then("no completions are open", async function (this: OlaiWorld) {
  await theListIsGone(this);
});

Then(
  "the completions take the pointer where they cross the section heading of {string}",
  async function (this: OlaiWorld, id: string) {
    const list = panel(this);
    await list.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const heading = this.within(id, NODE_GUTTER);
    const over = await this.box(list, "the completions");
    const under = await this.box(heading, `the section heading "${id}"`);
    const left = Math.max(over.x, under.x);
    const right = Math.min(over.x + over.width, under.x + under.width);
    const top = Math.max(over.y, under.y);
    const bottom = Math.min(over.y + over.height, under.y + under.height);
    assert.ok(
      right > left && bottom > top,
      `the completions (${Math.round(over.x)},${Math.round(over.y)} ` +
        `${Math.round(over.width)}×${Math.round(over.height)}) do not ` +
        `cross the section heading of "${id}" ` +
        `(${Math.round(under.x)},${Math.round(under.y)} ` +
        `${Math.round(under.width)}×${Math.round(under.height)}) — ` +
        "without an overlap this step cannot see a layer",
    );
    const found = await this.topmostTestidAt(
      (left + right) / 2,
      (top + bottom) / 2,
    );
    assert.ok(
      found === TESTID.completions || found === TESTID.completionItem,
      `the element at the overlap is ${found} — a sticky heading ` +
        "painting through the list is the bug this scenario holds",
    );
  },
);

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

When(
  "I choose {string} from the completions",
  async function (this: OlaiWorld, label: string) {
    const row = rows(this).filter({ hasText: label }).first();
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await row.click();
    await theListIsGone(this);
  },
);

const labels = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  (await rows(world).allInnerTexts()).map((text) => oneLine(text.split("\n")[0] ?? ""));
