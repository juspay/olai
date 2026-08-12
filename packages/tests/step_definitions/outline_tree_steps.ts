/**
 * The tree: what one outline looks like once everything derived has been
 * derived.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  BLOCKED,
  CHECKBOX,
  DATE,
  DESC,
  NODE,
  NODE_GUTTER,
  NODE_MENU,
  NODE_MENU_ITEM,
  NODE_MENU_PANEL,
  oneLine,
  nodeSelector,
  PROGRESS,
  readable,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  TAG,
  TOGGLE,
  ZOOM,
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

Then(
  "the node {string} has no status",
  async function (this: OlaiWorld, id: string) {
    // ABSENT, not a word for "none": the row of a bullet says nothing about
    // status at all, which is what "not a task" is spelled as everywhere else.
    // The same waiting machinery `has status` uses, from the other side.
    await this.expectAttributeAbsent(nodeSelector(id), "data-status", `node "${id}"`);
  },
);

/** The three faces of the status box beside the bullet. Asserted as
 *  `data-face` + `data-status` rather than a Unicode glyph: the faces are CSS
 *  squares now (Workflowy), and a restyle is entitled to redraw the pixels
 *  without breaking the contract. `empty` is `todo`, never the absence of a
 *  mark, which is a box that is not drawn at all (see "shows no checkbox"). */
const CHECKBOX_FACE: Record<string, { readonly status: string; readonly face: string }> = {
  checked: { status: "done", face: "checked" },
  doing: { status: "doing", face: "doing" },
  empty: { status: "todo", face: "empty" },
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
    // VISIBLE, not merely present: a box that is opacity-0 on desktop until
    // hover would still be in the DOM, and a mark nobody can see is not a mark.
    await this.waitUntil(
      async () => {
        const status = await box.getAttribute("data-status");
        const drawn = await box.getAttribute("data-face");
        return status === expected.status && drawn === expected.face;
      },
      `the node "${id}" shows a ${face} checkbox (data-face=${expected.face}, data-status=${expected.status})`,
    ).catch(async () => {
      assert.strictEqual(await box.getAttribute("data-status"), expected.status);
      assert.strictEqual(await box.getAttribute("data-face"), expected.face);
    });
  },
);

/** "This row draws no such thing" — asked of the node's own LINE, because rows
 *  nest and a descendant's badge or box is that node's business rather than
 *  this one's. One helper, so the next thing that can be absent from a row does
 *  not arrive with a third copy of the wait. */
const drawsNothing = async (
  world: OlaiWorld,
  id: string,
  control: string,
  what: string,
): Promise<void> => {
  const line = world.within(id, NODE_GUTTER);
  await line.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  const own = line.locator(control);
  await world
    .waitUntil(async () => (await own.count()) === 0, `the node "${id}" shows no ${what}`)
    .catch(async () => {
      assert.strictEqual(await own.count(), 0);
    });
};

Then(
  "the node {string} shows no checkbox",
  async function (this: OlaiWorld, id: string) {
    // A bullet draws no box — not an empty one. The blank holding the column
    // open carries no testid, so counting the boxes is the whole assertion.
    await drawsNothing(this, id, CHECKBOX, "checkbox");
  },
);

Then(
  "the node {string} shows the progress {string}",
  async function (this: OlaiWorld, id: string, progress: string) {
    // The badge publishes the value as an attribute, so this asks for it the
    // way every other row assertion does — and hears what the badge carries
    // instead when it disagrees.
    await this.expectAttribute(
      `${nodeSelector(id)} ${PROGRESS}`,
      "data-progress",
      progress,
      `node "${id}"`,
    );
  },
);

Then(
  "the node {string} shows no progress",
  async function (this: OlaiWorld, id: string) {
    // Absent, not `0/0`: a node with no tasks under it has nothing to count,
    // which is the same answer the derivation gives.
    await drawsNothing(this, id, PROGRESS, "progress badge");
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

/** One dim clamped plain-text line under the title — the only closed shape.
 *  Asserted as words, not as source: the preview strips markdown marks. */
Then(
  "the description of {string} is a preview of {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await desc.getAttribute("data-preview"),
      "true",
      `the description of "${id}" is not a clamped one-line preview`,
    );
    assert.strictEqual(
      await desc.getAttribute("data-open"),
      "false",
      `the description of "${id}" is open; a preview is the folded shape`,
    );
    await this.waitUntil(
      async () => readable(await desc.innerText()) === readable(expected),
      `the description of "${id}" reads ${JSON.stringify(expected)}`,
    ).catch(async () => {
      assert.strictEqual(readable(await desc.innerText()), readable(expected));
    });
  },
);

/** No list, no bold — the closed preview is plain text, not half-rendered. */
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

/** Workflowy-style: the note is its own line under the title, not beside it. */
Then(
  "the description of {string} is under its title",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    const desc = this.node(id).locator(DESC).first();
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const titleBox = await title.boundingBox();
    const descBox = await desc.boundingBox();
    assert.ok(titleBox !== null, `the title of "${id}" has no box`);
    assert.ok(descBox !== null, `the description of "${id}" has no box`);
    assert.ok(
      descBox.y >= titleBox.y + titleBox.height - 2,
      `the description of "${id}" is not under the title ` +
        `(title ends y=${titleBox.y + titleBox.height}, desc y=${descBox.y})`,
    );
  },
);

/** Clamped: one line of layout height, not a multi-line block. */
Then(
  "the description of {string} is clamped to one line",
  async function (this: OlaiWorld, id: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await desc.boundingBox();
    assert.ok(box !== null, `the description of "${id}" has no box`);
    // A single line of ~0.875rem text is well under 2rem; a multi-line note
    // (the open body) is not. The clamp is CSS `truncate`, which is height.
    assert.ok(
      box.height <= 32,
      `the description of "${id}" is ${Math.round(box.height)}px tall — ` +
        "a one-line clamp should be a single line of text",
    );
  },
);

// ── click / tap expand ─────────────────────────────────────────────────

/** The note control for a node: closed preview or open body. */
const noteControl = (world: OlaiWorld, id: string) =>
  world.node(id).locator(DESC).first();

const setNoteOpen = async (
  world: OlaiWorld,
  id: string,
  open: boolean,
  gesture: "click" | "tap",
): Promise<void> => {
  const row = world.node(id).first();
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const current =
    (await row.getAttribute("data-note-open")) === "true";
  if (current === open) {
    await world.waitForFrame();
    return;
  }
  const control = noteControl(world, id);
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await control.scrollIntoViewIfNeeded();
  await world.press(control, gesture);
  await world.waitUntil(
    async () =>
      (await world.node(id).first().getAttribute("data-note-open"))
        === String(open),
    `the note of "${id}" is ${open ? "open" : "folded"}`,
  );
};

/** Press the note, and let the render settle. What the press DOES depends on
 *  the state it is in — a clamped line expands, an expanded note takes the
 *  caret (`packages/web/src/client/NodeBody.tsx`) — so this does not wait for
 *  one particular outcome; the scenario says which it expected. */
const pressNote = async (
  world: OlaiWorld,
  id: string,
  gesture: "click" | "tap",
): Promise<void> => {
  const control = noteControl(world, id);
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await control.scrollIntoViewIfNeeded();
  await world.press(control, gesture);
};

When(
  "I click the note of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressNote(this, id, "click");
  },
);

When(
  "I tap the note of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressNote(this, id, "tap");
  },
);

When(
  "I click away from the note of {string}",
  async function (this: OlaiWorld, id: string) {
    // The sidebar is outside every note control. Clicking it collapses an
    // open note without following a navigation that would leave the page.
    const sidebar = this.page.locator('[data-testid="sidebar"]').first();
    await sidebar.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await sidebar.click({ position: { x: 8, y: 8 } });
    await this.waitForFrame();
    await this.waitUntil(
      async () =>
        (await this.node(id).first().getAttribute("data-note-open"))
          === "false",
      `the note of "${id}" is closed after clicking away`,
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

/** Inline markdown in a title — the same promise a note's open body makes,
 *  scoped to the title span so a bold word in the note cannot answer for it. */
Then(
  "the title of {string} renders bold text {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await title.locator("strong, b").allInnerTexts()).some(
          (value) => value.trim() === text,
        ),
      `the title of "${id}" to render ${JSON.stringify(text)} in bold`,
    );
  },
);

Then(
  "the title of {string} renders code {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await title.locator("code").allInnerTexts()).some(
          (value) => value.trim() === text,
        ),
      `the title of "${id}" to render ${JSON.stringify(text)} as code`,
    );
  },
);

Then(
  "the title of {string} does not show its markdown source",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = await title.innerText();
    assert.ok(
      !text.includes("**") && !text.includes("`"),
      `the title of "${id}" still contains markdown source: ${JSON.stringify(text)}`,
    );
  },
);

/** No block elements in a title — the inline-only discipline. A heading, a
 *  list or a fence that leaked through would break the row's baseline layout. */
Then(
  "the title of {string} does not render as markdown blocks",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await title.locator("h1, h2, h3, h4, h5, h6, ul, ol, li, pre, p, blockquote, table").count(),
      0,
      `the title of "${id}" still draws markdown blocks`,
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

// ── what cannot start yet ──────────────────────────────────────────────
//
// Blockedness is DERIVED — `a after b` holds `a` up while `b` is a task that
// is not done — so what these steps are really asking is whether the page
// agrees with the edges and the marks in the fixture. WHETHER a node is
// blocked, and by what, is `data-blocked` on the node itself: a fact, in the
// promised order, and never the dim it is drawn with. The affordance beside
// it — the mark column's waiting glyph on a row, the named list on a page —
// carries `TESTID.blocked`, and both are asserted, because a fact nothing
// draws is a fact nobody can read.

Then(
  "the node {string} is blocked by {string}",
  async function (this: OlaiWorld, id: string, blocker: string) {
    // `~=` is a space-separated token match: the attribute lists every blocker,
    // and this step is about one of them being among them.
    await this.page
      .locator(`${nodeSelector(id)}[data-blocked~="${blocker}"]`)
      .first()
      .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await this.node(id)
      .locator(BLOCKED)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the node {string} is not blocked",
  async function (this: OlaiWorld, id: string) {
    // The ABSENCE of the attribute, which is how the row says "nothing is in
    // my way" — an empty one would be a second spelling of nothing.
    await this.expectAttributeAbsent(
      nodeSelector(id),
      "data-blocked",
      `node "${id}"`,
    );
  },
);

Then(
  "the node {string} shows the waiting mark",
  async function (this: OlaiWorld, id: string) {
    const mark = this.within(id, BLOCKED);
    await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // Face, not a Unicode glyph: the hourglass is drawn CSS/SVG now, and the
    // contract is `data-face="waiting"` on the mark column's waiting control.
    const face = await mark.locator("[data-face]").first().getAttribute("data-face");
    assert.strictEqual(
      face,
      "waiting",
      `the waiting mark on "${id}" does not carry data-face=waiting`,
    );
  },
);

Then(
  "the waiting mark on {string} says {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    const mark = this.within(id, BLOCKED);
    await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The LABEL, not the tip: what a row is waiting on must be readable
    // without a pointer, so this is the copy that has to be right.
    assert.strictEqual(await mark.getAttribute("aria-label"), said);
  },
);

// ── Workflowy gutter: hover-reveal, halo, menu ─────────────────────────

/** Force the row's hover gutter visible for assertions that would otherwise
 *  depend on a real pointer hover (opacity-0 until group-hover on desktop).
 *  Hovers the LINE, not the whole <li>: the group/row lives on the gutter,
 *  and an expanded parent li's centre is over nested children. */
const revealGutter = async (world: OlaiWorld, id: string): Promise<void> => {
  const line = world.within(id, NODE_GUTTER);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await line.hover();
  await world.waitForFrame();
};

Then(
  "the node {string} shows a collapsed halo",
  async function (this: OlaiWorld, id: string) {
    const bullet = this.within(id, ZOOM);
    await bullet.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await bullet.getAttribute("data-halo")) === "true",
      `the bullet of "${id}" carries data-halo=true`,
    ).catch(async () => {
      assert.strictEqual(await bullet.getAttribute("data-halo"), "true");
    });
  },
);

Then(
  "the node {string} shows no collapsed halo",
  async function (this: OlaiWorld, id: string) {
    const bullet = this.within(id, ZOOM);
    await bullet.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.expectAttributeAbsent(
      `${nodeSelector(id)} ${ZOOM}`,
      "data-halo",
      `bullet of "${id}"`,
    );
  },
);

When(
  "I hover the node {string}",
  async function (this: OlaiWorld, id: string) {
    await revealGutter(this, id);
  },
);

/** Opacity of a control — the reveal contract is opacity, not presence. */
const controlOpacity = async (
  world: OlaiWorld,
  id: string,
  control: string,
): Promise<number> => {
  const el = world.within(id, control);
  await el.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  return el.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity));
};

/** Move the pointer off every outline row so group-hover is clear. */
const clearHover = async (world: OlaiWorld): Promise<void> => {
  await world.page.locator("body").hover({ position: { x: 2, y: 2 } });
  await world.waitForFrame();
};

Then(
  "the node menu of {string} is revealed",
  async function (this: OlaiWorld, id: string) {
    // Does NOT hover for you: a scenario that only checks the post-hover
    // state without first asserting hidden would survive deleting HOVER_REVEAL.
    await this.waitUntil(
      async () => (await controlOpacity(this, id, NODE_MENU)) > 0.5,
      `the node menu of "${id}" is visible (opacity > 0.5)`,
    );
  },
);

Then(
  "the node menu of {string} is hidden",
  async function (this: OlaiWorld, id: string) {
    await clearHover(this);
    await this.waitUntil(
      async () => (await controlOpacity(this, id, NODE_MENU)) < 0.1,
      `the node menu of "${id}" is hidden (opacity < 0.1)`,
    );
  },
);

Then(
  "the node menu of {string} is not on the row",
  async function (this: OlaiWorld, id: string) {
    // Phone: the menu is display:none (or detached from layout), not merely
    // opacity-0 — a 390px title has no room for an always-on •••.
    const menu = this.within(id, NODE_MENU);
    await this.waitUntil(async () => {
      const count = await menu.count();
      if (count === 0) return true;
      const box = await menu.boundingBox();
      return box === null || box.width === 0;
    }, `the node menu of "${id}" is not laid out on a phone row`);
  },
);

Then(
  "the collapse control of {string} is revealed",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await controlOpacity(this, id, TOGGLE)) > 0.5,
      `the collapse control of "${id}" is visible (opacity > 0.5)`,
    );
  },
);

Then(
  "the collapse control of {string} is hidden",
  async function (this: OlaiWorld, id: string) {
    await clearHover(this);
    await this.waitUntil(
      async () => (await controlOpacity(this, id, TOGGLE)) < 0.1,
      `the collapse control of "${id}" is hidden (opacity < 0.1)`,
    );
  },
);

When(
  "I focus the collapse control of {string}",
  async function (this: OlaiWorld, id: string) {
    // Opacity-0 still receives programmatic focus; that is what fires
    // group-focus-within without a pointer hover.
    const toggle = this.within(id, TOGGLE);
    await toggle.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await toggle.evaluate((el) => (el as HTMLElement).focus());
    await this.waitForFrame();
  },
);

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
