/**
 * The row editor: the caret, the keys, and what the file says afterwards.
 *
 * Two kinds of assertion here and the difference is the point. What the PAGE
 * says is asked of the DOM, like every other feature; what the DIRECTORY says
 * is asked of the disk, because "the write went through the ops layer to a
 * file" is the claim these scenarios exist to make, and a page that agreed
 * with itself would prove nothing about it.
 *
 * WHICH of the two a scenario uses is not arbitrary, and the structural keys
 * are asked of the DOM on purpose: nothing is echoed, so a row that has moved
 * on screen has moved on disk — the page cannot say it until the file said it
 * first. The disk assertions are for the claims the page cannot make, and one
 * of them is a NEGATIVE ("nothing was written"), which has to outlast the
 * commit window rather than be read the instant typing stops.
 *
 * Keys are pressed by NAME (`"Alt+Shift+ArrowUp"`), which is Playwright's own
 * spelling and the same one the client's keyboard map is written against — so
 * a scenario says the chord a person presses rather than a synthetic event.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { IDLE_COMMIT } from "@olai/web/src/client/edit/draft.ts";

import {
  DESC_EDITOR,
  EDIT_NUDGE,
  EDIT_REFUSAL,
  NEW_ROW,
  nodeSelector,
  POLL_TIMEOUT,
  START_LINE,
  TITLE_EDITOR,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── opening an editor ──────────────────────────────────────────────────

When(
  "I click the title of {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(this.nodeTitle(id));
    await this.page
      .locator(TITLE_EDITOR)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the empty outline {string}",
  async function (this: OlaiWorld, file: string) {
    // Not "I open the outline": that step waits for a TREE, and an outline
    // that holds nothing has no rows to draw one from — what it has instead is
    // the line this feature is about.
    await this.showSidebar();
    await this.outlineLink(file).click();
    await this.page
      .locator(START_LINE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When("I start the first line", async function (this: OlaiWorld) {
  await this.press(this.page.locator(START_LINE).first());
  await this.page
    .locator(TITLE_EDITOR)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── typing ─────────────────────────────────────────────────────────────

When("I type {string}", async function (this: OlaiWorld, text: string) {
  await this.page.keyboard.type(text);
});

When(
  "I select all and type {string}",
  async function (this: OlaiWorld, text: string) {
    // Select-all inside the field, which is what a person retyping a title
    // does. An empty `text` is the whole point of one scenario: the field is
    // cleared and the write is refused.
    await this.page.keyboard.press("ControlOrMeta+a");
    if (text === "") await this.page.keyboard.press("Backspace");
    else await this.page.keyboard.type(text);
  },
);

When("I press {string}", async function (this: OlaiWorld, key: string) {
  await this.page.keyboard.press(key);
  await this.waitForFrame();
});

When("I click away from the editor", async function (this: OlaiWorld) {
  // Somewhere in the pane that is not a row: a blur, and nothing else.
  await this.page.locator("main").click({ position: { x: 4, y: 4 } });
  await this.waitForFrame();
});

// ── what is on screen ──────────────────────────────────────────────────

Then(
  "the row being typed holds {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.page.locator(TITLE_EDITOR).first();
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await editor.inputValue()) === text,
      `the row being typed to hold ${JSON.stringify(text)}`,
    );
  },
);

Then("no row is being edited", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(TITLE_EDITOR).count()) === 0 &&
      (await this.page.locator(DESC_EDITOR).count()) === 0,
    "no editor to be open",
  );
});

Then("a new row is being typed", async function (this: OlaiWorld) {
  await this.page
    .locator(NEW_ROW)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the note of {string} is being typed",
  async function (this: OlaiWorld, id: string) {
    await this.within(id, DESC_EDITOR)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the note of {string} is no longer being typed",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await this.node(id).locator(DESC_EDITOR).count()) === 0,
      `the note editor on "${id}" to close`,
    );
  },
);

/** What the line under the editor says — a refusal and a nudge are the same
 *  assertion about two moods, so they are one function and two steps. */
const saidUnderTheRow = async (
  world: OlaiWorld,
  locator: string,
  said: string,
  what: string,
): Promise<void> => {
  const line = world.page.locator(locator).first();
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const text = (await line.innerText()).trim();
  assert.ok(
    text.includes(said),
    `the ${what} reads ${JSON.stringify(text)}, which does not mention ${JSON.stringify(said)}`,
  );
};

Then("the refusal says {string}", async function (this: OlaiWorld, said: string) {
  await saidUnderTheRow(this, EDIT_REFUSAL, said, "refusal");
});

Then("the nudge says {string}", async function (this: OlaiWorld, said: string) {
  await saidUnderTheRow(this, EDIT_NUDGE, said, "nudge");
});

Then("nothing is being said about the row", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(EDIT_NUDGE).count()) === 0 &&
      (await this.page.locator(EDIT_REFUSAL).count()) === 0,
    "the row to have nothing said about it",
  );
});

Then(
  "the node {string} comes before {string}",
  async function (this: OlaiWorld, first: string, second: string) {
    // Sibling order as the page draws it, which is the `ord` the write
    // produced — read by position rather than by attribute, because "which is
    // above which" is what a reader is looking at.
    await this.waitUntil(async () => {
      const ids = await this.page
        .locator(`${nodeSelector(first)}, ${nodeSelector(second)}`)
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("data-node-id") ?? ""),
        );
      return ids.indexOf(first) !== -1 && ids.indexOf(first) < ids.indexOf(second);
    }, `"${first}" to be drawn above "${second}"`);
  },
);

// ── what the directory says ────────────────────────────────────────────

/** Every title the file holds, off the disk this scenario is writing to.
 *  Deliberately the RECORDS rather than the page: what these scenarios claim
 *  is that a keystroke reached a file through the ops layer. */
const titlesIn = (world: OlaiWorld, file: string): ReadonlyArray<string> =>
  world.servedNodes(file).map((node) => String(node["title"] ?? ""));

Then(
  "{string} holds a node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () => titlesIn(this, file).includes(title),
      `${file} to hold a node titled ${JSON.stringify(title)}`,
    );
  },
);

/** Nothing was written, and it STAYS unwritten for a while — read once, this
 *  would pass against a client that wrote a moment later, which is exactly the
 *  thing "a draft is not a write" claims did not happen. The window is a
 *  fraction of the idle commit's, because idling is one of the three moments
 *  that DOES write (see the step below it). */
const HELD = Math.floor(IDLE_COMMIT / 3);

Then(
  "{string} holds no node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    const deadline = Date.now() + HELD;
    do {
      assert.ok(
        !titlesIn(this, file).includes(title),
        `${file} holds a node titled ${JSON.stringify(title)}, and this step says nothing should have been written`,
      );
      await this.page.waitForTimeout(50);
    } while (Date.now() < deadline);
  },
);
