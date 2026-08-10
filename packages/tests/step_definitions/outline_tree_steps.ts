/**
 * The tree: what one outline looks like once everything derived has been
 * derived.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  CHECKBOX,
  DATE,
  DESC,
  NODE,
  readable,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  TAG,
  TOGGLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

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
    // POLLED, not read once. A title can change under a live page — a file is
    // saved, the store publishes, the node re-renders in place — and reading
    // the instant the node appears would compare against whatever the previous
    // snapshot said. The re-assert on timeout is what turns "waited 15s" into
    // "expected X, found Y".
    await this.waitUntil(
      async () => readable(await title.innerText()) === readable(expected),
      `the node "${id}" reads ${JSON.stringify(expected)}`,
    ).catch(async () => {
      assert.strictEqual(readable(await title.innerText()), readable(expected));
    });
  },
);

Then(
  "the node {string} has status {string}",
  async function (this: OlaiWorld, id: string, status: string) {
    await this.expectNodeAttribute(id, "data-status", status);
  },
);

/** The three faces of the status box beside the bullet. The MARK is the
 *  assertion: open is an empty box, not the absence of one, so a regression
 *  that only tones the title and drops the checkbox fails here on all three. */
const CHECKBOX_FACE: Record<string, { readonly status: string; readonly mark: string }> = {
  checked: { status: "done", mark: "☑" },
  doing: { status: "doing", mark: "◧" },
  empty: { status: "open", mark: "☐" },
};

Then(
  "the node {string} shows a(n) {word} checkbox",
  async function (this: OlaiWorld, id: string, face: string) {
    const expected = CHECKBOX_FACE[face];
    assert.ok(
      expected !== undefined,
      `unknown checkbox face ${JSON.stringify(face)}; want checked, doing or empty`,
    );
    const box = this.node(id).locator(CHECKBOX).first();
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // VISIBLE, not merely present: an open box that is opacity-0 on desktop
    // until hover would still be in the DOM, and the whole point of the empty
    // face is that open is a drawn box, not the absence of one.
    await this.waitUntil(
      async () => {
        const status = await box.getAttribute("data-status");
        const mark = readable(await box.innerText());
        return status === expected.status && mark === expected.mark;
      },
      `the node "${id}" shows a ${face} checkbox (${expected.mark}, data-status=${expected.status})`,
    ).catch(async () => {
      assert.strictEqual(await box.getAttribute("data-status"), expected.status);
      assert.strictEqual(readable(await box.innerText()), expected.mark);
    });
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

/** Same-line gray plain-text snippet — the only closed shape. Asserted as
 *  words, not as source: the preview strips markdown marks. */
Then(
  "the description of {string} is a preview of {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await desc.getAttribute("data-preview"),
      "true",
      `the description of "${id}" is not a same-line snippet`,
    );
    assert.strictEqual(
      await desc.getAttribute("data-open"),
      "false",
      `the description of "${id}" is open; a snippet is the folded shape`,
    );
    await this.waitUntil(
      async () => readable(await desc.innerText()) === readable(expected),
      `the description of "${id}" reads ${JSON.stringify(expected)}`,
    ).catch(async () => {
      assert.strictEqual(readable(await desc.innerText()), readable(expected));
    });
  },
);

/** No list, no bold — the closed snippet is plain text, not half-rendered. */
Then(
  "the description of {string} does not render as markdown blocks",
  async function (this: OlaiWorld, id: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await desc.locator("li, strong, b, p, ul, ol").count(),
      0,
      `the description of "${id}" still draws markdown blocks while folded`,
    );
  },
);

/** Things-style: the snippet rides the title row, not a second line under it. */
Then(
  "the description of {string} is on the same line as its title",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    const desc = this.node(id).locator(DESC).first();
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const titleBox = await title.boundingBox();
    const descBox = await desc.boundingBox();
    assert.ok(titleBox !== null, `the title of "${id}" has no box`);
    assert.ok(descBox !== null, `the description of "${id}" has no box`);
    // Same baseline row: the vertical centres share a band, and the snippet
    // starts to the right of the title. A second line under the title would
    // put the snippet wholly below the title's bottom.
    const titleMid = titleBox.y + titleBox.height / 2;
    const descMid = descBox.y + descBox.height / 2;
    assert.ok(
      Math.abs(titleMid - descMid) <= Math.max(titleBox.height, descBox.height),
      `the description of "${id}" is not on the title line ` +
        `(title y=${titleBox.y}+${titleBox.height}, desc y=${descBox.y}+${descBox.height})`,
    );
    assert.ok(
      descBox.x >= titleBox.x + titleBox.width * 0.5,
      `the description of "${id}" is not after the title ` +
        `(title ends ${titleBox.x + titleBox.width}, desc at ${descBox.x})`,
    );
  },
);

// ── hover expand / touch toggle ────────────────────────────────────────

When(
  "I hover the row of {string}",
  async function (this: OlaiWorld, id: string) {
    const row = this.node(id).first();
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await row.hover();
    await this.waitForFrame();
    await this.waitUntil(
      async () =>
        (await this.node(id).first().getAttribute("data-note-open")) === "true",
      `the row of "${id}" is open after hover`,
    );
  },
);

When(
  "I stop hovering the row of {string}",
  async function (this: OlaiWorld, id: string) {
    // Park the pointer on the page chrome so the row receives mouseleave.
    // Hovering the sidebar (always on a laptop) is more reliable than (0,0),
    // which can still sit over a tall tree.
    const sidebar = this.page.locator('[data-testid="sidebar"]').first();
    await sidebar.hover({ position: { x: 8, y: 8 } }).catch(async () => {
      await this.page.mouse.move(0, 0);
    });
    await this.waitForFrame();
    await this.waitUntil(
      async () =>
        (await this.node(id).first().getAttribute("data-note-open"))
          === "false",
      `the row of "${id}" is closed after mouse-out`,
    );
  },
);

When(
  "I tap the note snippet of {string}",
  async function (this: OlaiWorld, id: string) {
    const snippet = this.node(id).locator(`${DESC}[data-preview="true"]`).first();
    await snippet.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await snippet.scrollIntoViewIfNeeded();
    await this.press(snippet, "tap");
    await this.waitUntil(
      async () =>
        (await this.node(id).first().getAttribute("data-note-open")) === "true",
      `the row of "${id}" is open after tapping the snippet`,
    );
  },
);

When(
  "I tap the open note of {string}",
  async function (this: OlaiWorld, id: string) {
    const body = this.node(id).locator(`${DESC}[data-open="true"]`).first();
    await body.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await body.scrollIntoViewIfNeeded();
    await this.press(body, "tap");
    await this.waitUntil(
      async () =>
        (await this.node(id).first().getAttribute("data-note-open"))
          === "false",
      `the row of "${id}" is closed after tapping the open note`,
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
