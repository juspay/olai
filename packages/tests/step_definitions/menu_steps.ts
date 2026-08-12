/**
 * The `•••` menu: opening it, what it offers, what it asks, and what it said.
 *
 * Its own file because the menu is no longer a list of read verbs — it writes
 * now, so it has a question before one of them, two moods to say things in,
 * and a clipboard to be denied by. What stays in `outline_tree_steps.ts` is
 * the GUTTER it lives in: whether the `•••` is revealed on hover, whether a
 * phone lays one out at all. That is a fact about the row; everything here is
 * about the panel.
 *
 * The one thing this file is careful about is TONE. What a verb said is drawn
 * in one place in two moods — a refusal, in the ops layer's own words, and a
 * remark from a write that landed — and a scenario that could not tell them
 * apart would pass on a client that alarmed about a nudge.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  NODE_MENU,
  NODE_MENU_CONFIRM,
  NODE_MENU_ITEM,
  NODE_MENU_PANEL,
  NODE_MENU_SAID,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { revealGutter } from "./outline_tree_steps.ts";

When(
  "I open the node menu of {string}",
  async function (this: OlaiWorld, id: string) {
    await revealGutter(this, id);
    const menu = this.within(id, NODE_MENU);
    await menu.click({ force: true });
    await this.page
      .locator(NODE_MENU_PANEL)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the node menu offers {string}",
  async function (this: OlaiWorld, label: string) {
    const panel = this.page.locator(NODE_MENU_PANEL);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const items = panel.locator(NODE_MENU_ITEM);
    const labels = (await items.allInnerTexts()).map((t) => t.trim());
    assert.ok(
      labels.includes(label),
      `node menu offers ${JSON.stringify(labels)}, expected ${JSON.stringify(label)}`,
    );
  },
);

Then(
  "the node menu does not offer {string}",
  async function (this: OlaiWorld, label: string) {
    const panel = this.page.locator(NODE_MENU_PANEL);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const labels = (await panel.locator(NODE_MENU_ITEM).allInnerTexts()).map((t) =>
      t.trim(),
    );
    assert.ok(
      !labels.includes(label),
      `node menu offers ${JSON.stringify(labels)}, and this step says ${
        JSON.stringify(label)
      } is not one of them`,
    );
  },
);

Then(
  "the node menu offers exactly:",
  async function (this: OlaiWorld, table: { rawTable: string[][] }) {
    const expected = table.rawTable.map((row) => row[0]!.trim());
    const panel = this.page.locator(NODE_MENU_PANEL);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const labels = (await panel.locator(NODE_MENU_ITEM).allInnerTexts()).map((t) =>
      t.trim(),
    );
    assert.deepStrictEqual(
      labels,
      expected,
      `node menu offers ${JSON.stringify(labels)}, expected exactly ${JSON.stringify(expected)}`,
    );
  },
);

When(
  "I choose {string} from the node menu",
  async function (this: OlaiWorld, label: string) {
    const panel = this.page.locator(NODE_MENU_PANEL);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const item = panel.locator(NODE_MENU_ITEM).filter({ hasText: label }).first();
    await item.click();
    await this.waitForFrame();
  },
);

/** The question the panel puts where its list was. VERBATIM, because the whole
 *  point of it is the two things it names — which row, and how much goes with
 *  it — and a substring match would pass on a confirm that had lost the
 *  count. */
Then(
  "the node menu asks {string}",
  async function (this: OlaiWorld, question: string) {
    const asked = this.page.locator(NODE_MENU_CONFIRM);
    await asked.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await asked.innerText()), question);
  },
);

Then("the node menu is not asking anything", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(NODE_MENU_CONFIRM).count()) === 0,
    "the confirm to be gone from the panel",
  );
});

/**
 * What a verb SAID, in the mood it said it.
 *
 * Verbatim and in the alarm tone: a refusal is the ops layer's own sentence,
 * and quoting it in a feature file is how "surfaced verbatim" is a test rather
 * than a claim. The tone is a `data-` fact rather than a colour, which is the
 * same contract the row editor's line keeps.
 */
Then(
  "the node menu of {string} says {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const said = this.within(id, NODE_MENU_SAID);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await said.innerText()), text);
    assert.strictEqual(
      await said.getAttribute("data-tone"),
      "alarm",
      `"${id}" said ${JSON.stringify(text)} in the wrong tone — a refusal is an alarm`,
    );
  },
);

/** The other mood: a write that LANDED and had something to add. A substring,
 *  because a nudge is a paragraph the rollup wrote and what matters is that it
 *  arrived at all — and that it did not arrive as an alarm. */
Then(
  "the node menu of {string} remarks {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const said = this.within(id, NODE_MENU_SAID);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const remark = oneLine(await said.innerText());
    assert.ok(
      remark.includes(text),
      `"${id}" remarked ${JSON.stringify(remark)}, which does not mention ${
        JSON.stringify(text)
      }`,
    );
    assert.strictEqual(
      await said.getAttribute("data-tone"),
      "aside",
      `"${id}" remarked ${JSON.stringify(remark)} in the wrong tone — a nudge is not an alarm`,
    );
  },
);

Then("the node menu of {string} says nothing", async function (this: OlaiWorld, id: string) {
  await this.waitUntil(
    async () => (await this.within(id, NODE_MENU_SAID).count()) === 0,
    `"${id}" to have nothing said beside it`,
  );
});

// ── the clipboard ──────────────────────────────────────────────────────

/**
 * A browser whose clipboard says no.
 *
 * Which is the ORDINARY browser for most olai readers: `navigator.clipboard`
 * is gated on a secure context, and a server on the LAN read over plain http
 * is not one. The e2e suite is served from `localhost`, which IS a secure
 * context, so the refusal has to be put back — and put back as the same shape
 * a real one has, a rejected promise from `writeText`.
 */
Given("this browser's clipboard refuses", async function (this: OlaiWorld) {
  // `evaluate` on the page that is already open, rather than `addInitScript`:
  // the feature's Background has navigated before this step runs, and an init
  // script only reaches the NEXT navigation. Nothing here reloads — the app is
  // a single page — so patching the live window is what a scenario sees.
  await this.page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new Error("olai e2e: the clipboard is not available")),
      },
    });
  });
});

/**
 * A clipboard that keeps what it was given, so a scenario can read it back.
 *
 * Patched rather than granted: reading the real clipboard needs a permission
 * that is Chromium's alone, and the assertion this exists for is about the
 * TEXT olai composed — every tab, every note line — which is the same string
 * either way. The same live-window patch as the refusing one above, and the
 * same reason it is not an init script.
 */
Given(
  "this browser's clipboard records what is copied",
  async function (this: OlaiWorld) {
    await this.page.evaluate(() => {
      const held = { text: "" };
      (globalThis as unknown as { __olaiClipboard: typeof held }).__olaiClipboard = held;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            held.text = text;
            return Promise.resolve();
          },
        },
      });
    });
  },
);

/** What landed on it, to the tab. A doc string rather than a table: the shape
 *  IS the assertion — one line per node, one tab per level, the note beneath
 *  its own node — and a table would hide exactly the whitespace under test. */
Then("the clipboard holds:", async function (this: OlaiWorld, expected: string) {
  await this.waitUntil(
    async () =>
      (await this.page.evaluate(
        () => (globalThis as unknown as { __olaiClipboard?: { text: string } })
          .__olaiClipboard?.text ?? "",
      )) !== "",
    "something to reach the clipboard",
  );
  const copied = await this.page.evaluate(
    () =>
      (globalThis as unknown as { __olaiClipboard?: { text: string } }).__olaiClipboard
        ?.text ?? "",
  );
  assert.strictEqual(copied, expected);
});
