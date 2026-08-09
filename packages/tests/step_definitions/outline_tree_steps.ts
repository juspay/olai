/**
 * The tree: what one outline looks like once everything derived has been
 * derived.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  DATE,
  DESC,
  NODE,
  oneLine,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  TAG,
  TOGGLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** One line, with the `#` that marks a tag dropped.
 *
 *  The `#` is dropped on BOTH sides of every title comparison because the
 *  format stores the title verbatim and leaves the split to the view: whether
 *  the styled tag reads `#home` or `home` is a presentation choice the view is
 *  entitled to make. What a title assertion is actually for is that the words
 *  survive being cut apart into text and tag spans and put back together.
 *
 *  Stripped BEFORE the whitespace is flattened, so a `#` the view sets off on
 *  its own does not leave a double space behind. */
const readable = (text: string): string => oneLine(text.replace(/#/g, ""));

Then("the tree is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(OUTLINE_TREE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no outline tree is shown", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(OUTLINE_TREE).count(),
    0,
    "a tree is on screen; an invalid set shows the error view INSTEAD of one",
  );
});

Then("the node {string} is shown", async function (this: OlaiWorld, id: string) {
  await this.node(id)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** Not on screen at all. Poll for the node to GO — hiding what is done
 *  re-renders, and reading the count once races the frame that drops it. */
Then(
  "the node {string} is not shown",
  async function (this: OlaiWorld, id: string) {
    await this.node(id)
      .first()
      .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.strictEqual(
      await this.visibleNode(id).count(),
      0,
      `"${id}" is on screen, and this step says it should not be`,
    );
  },
);

Then(
  "the node {string} is a child of {string}",
  async function (this: OlaiWorld, child: string, parent: string) {
    const nested = this.node(parent).locator(`${NODE}[data-node-id="${child}"]`);
    await nested
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await nested.count()) > 0,
      `"${child}" is not rendered inside "${parent}"`,
    );
  },
);

Then(
  "the node {string} has the title {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(readable((await title.innerText()) ?? ""), readable(expected));
  },
);

Then(
  "the node {string} has status {string}",
  async function (this: OlaiWorld, id: string, status: string) {
    await this.expectNodeAttribute(id, "data-status", status);
  },
);

Then(
  "the node {string} shows the date {string}",
  async function (this: OlaiWorld, id: string, date: string) {
    const badge = this.node(id).locator(DATE).first();
    await badge.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The badge may PRINT the date any way it likes (`10 Aug`, `Monday`), so
    // the ISO value is looked for in the places a formatted badge keeps it as
    // well as in the text. What is being asserted is that the badge is about
    // THIS date — not how it chooses to say so.
    const shown = await badge.evaluate((node) =>
      [
        node.textContent,
        node.getAttribute("datetime"),
        node.getAttribute("data-date"),
        node.getAttribute("title"),
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" | "),
    );
    assert.ok(
      shown.includes(date),
      `the date badge on "${id}" says ${JSON.stringify(shown)}, which does not mention ${date}`,
    );
  },
);

Then(
  "the node {string} shows no date",
  async function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      await this.node(id).locator(DATE).count(),
      0,
      `"${id}" has no \`date\` field, so it must show no date badge`,
    );
  },
);

Then(
  "the description of {string} renders bold text {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const bold = await desc.locator("strong, b").allInnerTexts();
    assert.ok(
      bold.some((value) => value.trim() === text),
      `the description of "${id}" renders bold text ${JSON.stringify(bold)}, expected ${JSON.stringify(text)}`,
    );
  },
);

Then(
  "the description of {string} renders {int} list items",
  async function (this: OlaiWorld, id: string, expected: number) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await desc.locator("li").count(), expected);
  },
);

Then(
  "the description of {string} does not show its markdown source",
  async function (this: OlaiWorld, id: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = await desc.innerText();
    // `**` surviving into the rendered text means the desc was printed rather
    // than rendered — the one failure this assertion exists to catch.
    assert.ok(
      !text.includes("**"),
      `the description of "${id}" still contains markdown source: ${JSON.stringify(text)}`,
    );
  },
);

Then(
  "the title of {string} styles the tag {string}",
  async function (this: OlaiWorld, id: string, tag: string) {
    const tags = this.nodeTitle(id).locator(TAG);
    await tags
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    const found = (await tags.allInnerTexts()).map((value) =>
      value.replace(/^#/, "").trim(),
    );
    assert.ok(
      found.includes(tag),
      `the title of "${id}" styles ${JSON.stringify(found)}, expected a tag ${JSON.stringify(tag)}`,
    );
  },
);

// ── collapse and expand ────────────────────────────────────────────────

const clickToggle = (world: OlaiWorld, id: string): Promise<void> =>
  world.clickWithin(id, TOGGLE);

/** Serves both keywords: as a `Given` it ESTABLISHES the state (clicking if
 *  the node happens to start collapsed), as a `Then` it asserts it. Cucumber
 *  matches on the text alone, so this has to be one definition — and making it
 *  idempotent is what lets the same sentence be a precondition and a
 *  conclusion without lying in either role. */
Given(
  "the node {string} is expanded",
  async function (this: OlaiWorld, id: string) {
    if ((await this.nodeAttribute(id, "data-collapsed")) === "true") {
      await clickToggle(this, id);
    }
    await this.expectNodeAttribute(id, "data-collapsed", "false");
  },
);

Then(
  "the node {string} is collapsed",
  async function (this: OlaiWorld, id: string) {
    await this.expectNodeAttribute(id, "data-collapsed", "true");
  },
);

/** One toggle, two sentences. The control is the same button either way — it
 *  is the node's CURRENT state that decides which word the scenario reads
 *  naturally — so the alternation keeps both readings without registering the
 *  same body twice. A `Given … is expanded` above establishes the state each
 *  reading assumes. */
When(
  "I collapse/expand the node {string}",
  async function (this: OlaiWorld, id: string) {
    await clickToggle(this, id);
  },
);

Then(
  "the children of {string} are hidden",
  async function (this: OlaiWorld, id: string) {
    const children = this.visibleChildNodes(id);
    // Poll on VISIBILITY, not presence: hiding the children and dropping them
    // are both legitimate implementations of a collapse, and this step means
    // the same thing to the person reading the screen either way.
    await this.page
      .waitForFunction(
        (selector) =>
          Array.from(document.querySelectorAll(selector)).every(
            (node) => node.getClientRects().length === 0,
          ),
        `${NODE}[data-node-id="${id}"] ${NODE}`,
        { timeout: POLL_TIMEOUT },
      )
      .catch(() => undefined);
    assert.strictEqual(
      await children.count(),
      0,
      `"${id}" is collapsed but still shows children`,
    );
  },
);

Then(
  "the children of {string} are shown",
  async function (this: OlaiWorld, id: string) {
    const children = this.visibleChildNodes(id);
    await children
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await children.count()) > 0,
      `"${id}" is expanded but shows no children`,
    );
  },
);

Then(
  "the node {string} has no toggle",
  async function (this: OlaiWorld, id: string) {
    await this.node(id)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await this.node(id).locator(TOGGLE).count(),
      0,
      `"${id}" has no children, so there is nothing for a toggle to do`,
    );
  },
);

// ── mirrors ────────────────────────────────────────────────────────────

/** `data-kind` is the row's whole classification — "node" | "mirror" |
 *  "cycle" | "dangling" — so asserting on it says more than a boolean did:
 *  a row that degraded into a cycle stub or a dangling marker now fails here
 *  naming what it became, rather than reading as a plain "not a mirror". */
Then(
  "the node {string} is marked as a mirror",
  async function (this: OlaiWorld, id: string) {
    await this.expectNodeAttribute(id, "data-kind", "mirror");
  },
);
