/**
 * The tree: what one outline looks like once everything derived has been
 * derived.
 *
 * The gutter is here too — hover-reveal, the halo, whether a phone lays a
 * `•••` out at all — because those are facts about a ROW. What the menu that
 * hangs off it offers, asks and says is `./menu_steps.ts`.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { childOf, notChildOf } from "../support/nesting.ts";
import { pressed } from "../support/settling.ts";
import {
  APP_HEADER,
  attr,
  BLOCKED,
  CHECKBOX,
  DATE,
  DESC,
  expectGone,
  FOLDED_DONE,
  HOT_FACT,
  NODE,
  NODE_GUTTER,
  NODE_MENU,
  NODE_REF,
  NODE_TITLE,
  nodeSelector,
  NOTE_MARK,
  PROGRESS,
  readable,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  TAG,
  TIP,
  TOGGLE,
  TOOK,
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

/** Not on screen at all — the world's own reading of a row that has GONE
 *  (`support/world.ts`), because hiding what is done and narrowing a page both
 *  re-render and reading the count once races the frame that drops it. */
// The same two assertions, about ONE pane of a split workspace: `this.node`
// cannot see pane boundaries at all, and the per-page done pick is exactly
// what can put the same node on one pane and not the other
// (`preferences.feature`'s split-pane fence).
Then(
  "the node {string} is shown in pane {int}",
  async function (this: OlaiWorld, id: string, index: number) {
    await this.pane(index)
      .locator(nodeSelector(id))
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the node {string} is not shown in pane {int}",
  async function (this: OlaiWorld, id: string, index: number) {
    // `expectGone` is page-scoped; the argument against the row is the pane's.
    await this.pane(index)
      .locator(nodeSelector(id))
      .first()
      .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.strictEqual(
      await this.pane(index).locator(`${nodeSelector(id)}:visible`).count(),
      0,
      `"${id}" is on pane ${index}, and this step says it should not be`,
    );
  },
);

Then(
  "the node {string} is not shown",
  async function (this: OlaiWorld, id: string) {
    await expectGone(
      this,
      nodeSelector(id),
      `"${id}" is on screen, and this step says it should not be`,
    );
  },
);

/** Both halves are `support/nesting.ts`'s, taking the whole page as the scope
 *  — the same question a split asks of one pane (`./drag_across_panes_steps.ts`
 *  passes `world.pane(i)`), and the reason the wait semantics live in one
 *  place: the negative is a different question rather than a negated one, and
 *  getting that subtly wrong twice is how a suite stops asking it properly. */
Then(
  "the node {string} is a child of {string}",
  async function (this: OlaiWorld, child: string, parent: string) {
    await childOf(this, this.everywhere(), child, parent);
  },
);

Then(
  "the node {string} is not a child of {string}",
  async function (this: OlaiWorld, child: string, parent: string) {
    await notChildOf(this, this.everywhere(), child, parent);
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

/** The four faces of the status box beside the bullet. Asserted as
 *  `data-face` + `data-status` rather than a Unicode glyph: the faces are CSS
 *  squares now (Workflowy), and a restyle is entitled to redraw the pixels
 *  without breaking the contract. `empty` is `todo`, never the absence of a
 *  mark, which is a box that is not drawn at all (see "shows no checkbox"), and
 *  `crossed` is the fourth mark — a cross in the box where `done` has a check,
 *  which is the ONE place the two settling marks are told apart on a row
 *  (`web/src/client/tone.ts`: they share the strike). */
const CHECKBOX_FACE: Record<string, { readonly status: string; readonly face: string }> = {
  checked: { status: "done", face: "checked" },
  crossed: { status: "cancelled", face: "crossed" },
  doing: { status: "doing", face: "doing" },
  empty: { status: "todo", face: "empty" },
};

Then(
  "the node {string} shows a(n) {word} checkbox",
  async function (this: OlaiWorld, id: string, face: string) {
    const expected = CHECKBOX_FACE[face];
    assert.ok(
      expected !== undefined,
      `unknown checkbox face ${JSON.stringify(face)}; want checked, crossed, doing or empty`,
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

/**
 * IS THE TITLE STRUCK THROUGH?
 *
 * The one assertion in this file that reads a COMPUTED STYLE rather than a
 * `data-` fact, and it earns the exception: the strike is not a styling
 * decision about a promise made elsewhere — it IS the promise. The human asked
 * for a struck-through row for the fourth mark (2026-08-25), a reader is
 * looking at exactly this pixel, and asserting the class name instead would
 * pass on a page where a later rule had turned the decoration off.
 *
 * It is read off the TITLE SPAN, which is the one element the mark tones
 * (`web/src/client/tone.ts`, `NodeLine.tsx`), wherever a node is drawn — a
 * tree row, a day's entry, a page heading. Both settling marks wear it, which
 * is the point: what the strike says is "nobody is waiting on this line", and
 * the CHECKBOX is where `done` and `cancelled` are told apart.
 */
Then(
  "the title of {string} is struck through",
  async function (this: OlaiWorld, id: string) {
    const title = this.node(id).locator(NODE_TITLE).first();
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const struck = async (): Promise<boolean> =>
      await title.evaluate((node) =>
        getComputedStyle(node).textDecorationLine.includes("line-through")
      );
    await this.waitUntil(struck, `the title of "${id}" is struck through`)
      .catch(async () => {
        assert.ok(await struck(), `the title of "${id}" is not struck through`);
      });
  },
);

Then(
  "the title of {string} is not struck through",
  async function (this: OlaiWorld, id: string) {
    const title = this.node(id).locator(NODE_TITLE).first();
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const plain = async (): Promise<boolean> =>
      await title.evaluate((node) =>
        !getComputedStyle(node).textDecorationLine.includes("line-through")
      );
    await this.waitUntil(plain, `the title of "${id}" is not struck through`)
      .catch(async () => {
        assert.ok(await plain(), `the title of "${id}" is struck through`);
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

// ── how long the work took, or is taking ────────────────────────────────
//
// The two states the chip can be in, asked the way the row reports them
// (web/src/client/TookChip.tsx): the SETTLED one is a value the set derived
// and the wire carried, so it is read off the chip's attributes like the
// rollup beside it; the RUNNING one ticks locally off the stored instant,
// so "live" is asked as the one thing a wire cannot answer — the words moved.

Then(
  "the node {string} shows a settled took chip",
  async function (this: OlaiWorld, id: string) {
    const chip = this.node(id).locator(NODE_GUTTER).locator(TOOK);
    await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The span is the attr: whole seconds, derived with the set. Which of the
    // two settling marks closed it is data-status.
    await this.waitUntil(
      async () => /^\d+$/.test((await chip.getAttribute("data-took")) ?? ""),
      `the node "${id}" wears a settled took chip (data-took of whole seconds)`,
    );
    // And the HOVER, which is the app's own tip now (the platform's `title`
    // ran off the window's right edge — web/src/client/Tip.tsx says why the
    // move). Every scenario here settles one round inside the minute, so the
    // tip's one line is the figure off the same attr plus the window the
    // record carried: `took 7s — the one round: <started> → <settled>`.
    const seconds = parseInt((await chip.getAttribute("data-took")) ?? "-1", 10);
    assert.ok(seconds >= 0 && seconds < 60, `"${id}"'s took attr is ${seconds}s`);
    await this.waitUntil(
      async () => {
        // The hover is RE-ASKED on every try, not trusted from before the
        // wait: a scroll — a fragment's reveal, an agent landing under the
        // pointer — retracts an opened tip by design (Tip.tsx: the pane
        // scrolling IS the leave), and no event says so. And the pointer
        // is moved AWAY first: a tip opens on `mouseenter` alone, and a
        // hover() over the point the pointer already rests fires none —
        // without the away the retry asks nothing and can never recover.
        await this.page.mouse.move(40, 40);
        await chip.hover();
        // EXACTLY one tip, and the story in it — the doubled-tooltip catch
        // navigation_steps.ts keeps: every TEXT assertion passed while two
        // copies of one sentence were on screen.
        const said = await this.page
          .locator(TIP)
          .allInnerTexts()
          .catch(() => [] as string[]);
        const [one] = said;
        return (
          said.length === 1 &&
          one !== undefined &&
          one.startsWith(`took ${seconds}s — the one round: `) &&
          one.includes(" → ")
        );
      },
      `the node "${id}"'s chip hovers the whole story ("took ${seconds}s — the one round: … → …")`,
    );
  },
);

Then(
  "the node {string} wears a start",
  async function (this: OlaiWorld, id: string) {
    const chip = this.node(id).locator(NODE_GUTTER).locator(TOOK);
    await this.waitUntil(
      async () => (await chip.getAttribute("data-started")) !== null,
      `the node "${id}"'s chip wears the instant it was stamped with`,
    );
    this.clockedStart = (await chip.getAttribute("data-started")) ?? undefined;
  },
);

Then(
  "the node {string} wears a fresh start, not that one",
  async function (this: OlaiWorld, id: string) {
    assert.ok(
      this.clockedStart !== undefined,
      `"wears a fresh start, not that one" has nothing to compare with — say "wears a start" first`,
    );
    // The rule it asserts is the planner's: EVERY start stamps anew, because
    // the round before this one is banked — so this is the one assertion a
    // first-start-keeping planner fails (the chip reads the wire, the wire
    // reads the record).
    const asked = this.clockedStart;
    const chip = this.node(id).locator(NODE_GUTTER).locator(TOOK);
    await this.waitUntil(
      async () => {
        const worn = await chip.getAttribute("data-started");
        return worn !== null && worn !== asked;
      },
      `the node "${id}" wears a fresh start — the first was ${asked}`,
    );
    this.clockedStart = undefined;
  },
);

Then(
  "{string} holds a node titled {string} with the rounds banked",
  async function (this: OlaiWorld, file: string, title: string) {
    // The BANK ON THE RECORD, asked where the chip can never be asked: on
    // disk. `worked` is a number the settle wrote — honestly zero when the
    // round closed inside one second, which is why the claim is presence
    // and never a figure.
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["title"] === title && typeof node["worked"] === "number",
        ),
      `${file} to hold a node titled ${JSON.stringify(title)} with \`worked\` banked`,
    );
  },
);

// Stamps are SECONDS-precise, so a pause the rule exists to exclude cannot
// be told from no pause at all inside one of them: the scenario dwells here
// to make two rounds' instants different strings — the thing "not that one"
// above is measured against.
When(
  "I let {int} seconds go by",
  async function (this: OlaiWorld, seconds: number) {
    await this.page.waitForTimeout(seconds * 1000);
  },
);

Then(
  "the node {string} is ticking",
  async function (this: OlaiWorld, id: string) {
    const chip = this.node(id).locator(NODE_GUTTER).locator(TOOK);
    await this.waitUntil(
      async () => (await chip.getAttribute("data-status")) === "doing",
      `the node "${id}" wears the running chip`,
    );
    // The words MOVED, and that is the whole assertion: the rule is that the
    // instant crosses once and the tick is local (web/src/client/took.ts, the
    // uptime chip's own seam) — a chip that shows the same reading twice has
    // a dead clock or a carried duration.
    const said = await chip.innerText();
    await this.waitUntil(
      async () => (await chip.innerText()) !== said,
      `the node "${id}"'s chip ticks (it read ${JSON.stringify(said)} for seconds)`,
    );
  },
);

Then(
  "the node {string} shows no took chip",
  async function (this: OlaiWorld, id: string) {
    // The jump-to-done, the bullet, and the row settled before spans existed:
    // no chip drawn is how the rule says there is nothing to tell.
    await drawsNothing(this, id, TOOK, "took chip");
  },
);

/**
 * WAITS, and that is the whole of what changed here. The badge is redrawn from
 * the snapshot, and every scenario that asks this has just made a write — so
 * the date on screen is a value on its way to its final one, and reading it
 * once is the first mistake `../README.md` lists.
 *
 * It bit under load: `⌘Z takes a picked date back` failed in 27ms, saying the
 * badge still read the date the chord had just taken back. The FILE already
 * said otherwise (the step before this one polls it) — which is the same
 * asymmetry the pointer's writes have, one step further along: the server
 * writes and publishes before the tab is redrawn, so the disk is always the
 * earlier reading.
 */
Then(
  "the node {string} shows the date {string}",
  async function (this: OlaiWorld, id: string, date: string) {
    const badge = this.node(id).locator(DATE).first();
    await badge.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The badge may PRINT the date any way it likes (`10 Aug`, `Monday`), so
    // the ISO value is looked for in the places a formatted badge keeps it as
    // well as in the text. What is being asserted is that the badge is about
    // THIS date — not how it chooses to say so.
    const shownOn = async (): Promise<string> =>
      await badge.evaluate((node) =>
        [
          node.textContent,
          node.getAttribute("datetime"),
          node.getAttribute("data-date"),
          node.getAttribute("title"),
        ]
          .filter((value): value is string => typeof value === "string")
          .join(" | "),
      );
    // The re-assert on timeout is `has the title`'s rule, for its reason: it
    // turns "waited 15s" into "says X, which does not mention Y".
    await this.waitUntil(
      async () => (await shownOn()).includes(date),
      `the date badge on "${id}" to be about ${date}`,
    ).catch(async () => {
      const shown = await shownOn();
      assert.ok(
        shown.includes(date),
        `the date badge on "${id}" says ${JSON.stringify(shown)}, which does not mention ${date}`,
      );
    });
  },
);

Then(
  "the node {string} shows no date",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await this.node(id).locator(DATE).count()) === 0,
      `"${id}" to show no date badge`,
    );
  },
);

Then(
  "the description of {string} renders bold text {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    // The preview is also `DESC` and is already visible; "visible" is not
    // "expanded". Wait for the markdown the expand is supposed to draw.
    const desc = this.node(id).locator(DESC).first();
    await this.waitUntil(async () => {
      const bold = await desc.locator("strong, b").allInnerTexts();
      return bold.some((value) => value.trim() === text);
    }, `the description of "${id}" to render bold text ${JSON.stringify(text)}`);
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

// ── the pilcrow: the door to a row's open state ────────────────────────
//
// A row is its title, so opening one is a press on the MARK beside that title
// rather than on a note that is not drawn (`client/note/Mark.tsx`). At `Cozy`
// the clamped line is a second door to the same state and the steps below still
// reach the mark, because "open this row" is one act and a scenario about
// something else should not have to know which density it is running under.

const noteMark = (world: OlaiWorld, id: string) =>
  world.within(id, NOTE_MARK);

/** The note ITSELF, which is a different control from the mark: the clamped
 *  line at `Cozy`, and the rendered body once the row is open. */
const noteControl = (world: OlaiWorld, id: string) =>
  world.node(id).locator(DESC).first();

/** Press the pilcrow, whichever way the row is currently folded, and wait for
 *  the row to say it moved. */
const pressMark = async (
  world: OlaiWorld,
  id: string,
  open: boolean,
  gesture: "click" | "tap",
): Promise<void> => {
  const row = world.node(id).first();
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if ((await row.getAttribute("data-note-open")) === String(open)) {
    await world.waitForFrame();
    return;
  }
  const mark = noteMark(world, id);
  await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await mark.scrollIntoViewIfNeeded();
  await world.press(mark, gesture);
  await world.waitUntil(
    async () =>
      (await world.node(id).first().getAttribute("data-note-open"))
        === String(open),
    `the row "${id}" is ${open ? "open" : "folded"}`,
  );
};

When(
  "I open the note of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressMark(this, id, true, "click");
  },
);

When(
  "I fold the note of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressMark(this, id, false, "click");
  },
);

When(
  "I tap the pilcrow of {string}",
  async function (this: OlaiWorld, id: string) {
    const mark = noteMark(this, id);
    await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await mark.scrollIntoViewIfNeeded();
    await this.press(mark, "tap");
  },
);

/** The keyboard's half of the same door: a `<button>` answers Space when it
 *  holds the caret, which is the only row-level focus this app has. */
When(
  "I press Space on the pilcrow of {string}",
  async function (this: OlaiWorld, id: string) {
    const mark = noteMark(this, id);
    await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await mark.focus();
    await pressed(this, " ");
  },
);

Then(
  "the row {string} is open",
  async function (this: OlaiWorld, id: string) {
    await this.expectNodeAttribute(id, "data-note-open", "true");
  },
);

Then(
  "the row {string} is folded",
  async function (this: OlaiWorld, id: string) {
    await this.expectNodeAttribute(id, "data-note-open", "false");
  },
);

Then(
  "the node {string} shows a pilcrow",
  async function (this: OlaiWorld, id: string) {
    await noteMark(this, id)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the node {string} shows no pilcrow",
  async function (this: OlaiWorld, id: string) {
    // Asked of the row's own LINE, because rows nest and a child's mark is
    // that child's business.
    await drawsNothing(this, id, NOTE_MARK, "pilcrow");
  },
);

/** The whole of what a folded row draws under its title, which at `Compact` is
 *  nothing at all: no clamped line, no properties, no references. */
Then(
  "the node {string} draws nothing under its title",
  async function (this: OlaiWorld, id: string) {
    const own = this.node(id).first();
    await own.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await own.locator(DESC).count()) === 0,
      `the node "${id}" to draw no note under its title`,
    );
  },
);
Then(
  "the node {string} says it is folding {string} finished rows",
  async function (this: OlaiWorld, id: string, count: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${FOLDED_DONE}`,
      "data-done",
      count,
      `the fold on "${id}"`,
    );
  },
);

Then(
  "the node {string} says nothing about folded finished rows",
  async function (this: OlaiWorld, id: string) {
    await drawsNothing(this, id, FOLDED_DONE, "folded-done count");
  },
);

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

/** One door, one measured end of it: what the clamp's "at the word the finger
 *  name" comes down to in a pointer. `position` is the press's own answer to
 *  "where IN the element" — the title's "near its start" holds the same
 *  arithmetic. */
When(
  "I click the note of {string} near its start",
  async function (this: OlaiWorld, id: string) {
    const control = noteControl(this, id);
    await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await control.click({ position: { x: 4, y: 3 } });
  },
);

When(
  "I click the note of {string} near its end",
  async function (this: OlaiWorld, id: string) {
    const control = noteControl(this, id);
    await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    if (box === null) throw new Error(`the note line of ${JSON.stringify(id)} has no box`);
    await control.click({ position: { x: box.width - 4, y: box.height - 3 } });
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
    // `clickAway` is the suite's one press on somewhere-else (support/world);
    // what this step adds on top is the note having actually folded.
    await this.clickAway();
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

/** ...and the titles where a `#…` is written and is NOT a tag: inside code,
 *  and inside a link (a URL fragment). A pill there would be pressable, and
 *  would filter the page by a word nobody tagged anything with. */
Then(
  "the title of {string} styles no tags",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await title.locator(TAG).count()) === 0,
      `the title of "${id}" to style no tags`,
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

/** The other emphasis, and it earns its own step for the reason the bug did:
 *  a title's loss check used to read `**b *c* d**` with regexes, so the ONE
 *  shape nobody could assert was an italic run inside a bold one. */
Then(
  "the title of {string} renders italic text {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await title.locator("em, i").allInnerTexts()).some(
          (value) => value.trim() === text,
        ),
      `the title of "${id}" to render ${JSON.stringify(text)} in italics`,
    );
  },
);

/** A link in a title, read by where it POINTS — the half of it a highlight
 *  must never reach, since a mark inside an attribute is a broken link rather
 *  than a loud one. Through `expectAttribute`, so a failure says the href it
 *  found and not only the one it wanted. */
Then(
  "the title of {string} links to {string}",
  async function (this: OlaiWorld, id: string, href: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${NODE_TITLE} a`,
      "href",
      href,
      `the link in the title of "${id}"`,
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
        `${NODE}${attr("data-node-id", id)} ${NODE}`,
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
      .locator(`${nodeSelector(id)}${attr("data-blocked", blocker, "~=")}`)
      .first()
      .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await this.node(id)
      .locator(BLOCKED)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * The WHOLE derived list, ids and count, in the order `Derived.blocked`
 * promises — and the drawn row counted against it.
 *
 * Its own step beside the membership one above rather than a stricter version
 * of it, because they answer different questions and both are asked: `~=` is
 * right for "this blocker is among them", and blind to a list naming one
 * blocker twice — which is exactly the shape that took a page down (a repeated
 * `after` target, or one edge spelled both ways round). So this one compares
 * the attribute WHOLE, and then counts the links the `blocked by` row draws:
 * the fact and the affordance come off one list, and a step that asked only
 * the attribute would pass over a row that drew it twice.
 */
Then(
  "the node {string} is blocked by exactly {string}",
  async function (this: OlaiWorld, id: string, blockers: string) {
    await this.expectNodeAttribute(id, "data-blocked", blockers);
    const named = blockers.split(" ").filter((one) => one.length > 0).length;
    await this.waitUntil(
      async () =>
        (await this.node(id).locator(BLOCKED).first().locator(NODE_REF).count()) ===
          named,
      `the \`blocked by\` row of "${id}" to draw ${named} link(s)`,
    );
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

// ── Workflowy gutter: hover-reveal, halo, menu ─────────────────────────

/** Force the row's hover gutter visible for assertions that would otherwise
 *  depend on a real pointer hover (opacity-0 until group-hover on desktop).
 *  Hovers the LINE, not the whole <li>: the group/row lives on the gutter,
 *  and an expanded parent li's centre is over nested children. */
export const revealGutter = async (
  world: OlaiWorld,
  id: string,
): Promise<void> => {
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
    // group-focus-within without a pointer hover, and `focusWithin` is where
    // that reasoning lives (support/world) — the `•••` is focused the same way.
    await this.focusWithin(id, TOGGLE);
  },
);

// ── a section holds its place ──────────────────────────────────────────
//
// A TOP-LEVEL row is a section heading, and it is `position: sticky` inside its
// own `<li>` — so it stays under the app bar for exactly as long as its own
// branch is on screen and lets go when the next section arrives
// (`client/Tree.tsx`). It is the third member of the family
// `the_header_sticks` and `the_sidebar_sticks` opened, and it fails the same
// way both of those did before they were pinned: silently, as a heading that
// scrolled off with a page a reader is still reading the middle of.
//
// The tolerance is the sidebar's, and for its reason: the seam is two boxes
// meeting, and sub-pixel layout puts them within a pixel of each other rather
// than exactly on it.
const SEAM_EDGE = 2;

/** Where the app bar's bottom edge is — what "pinned under the header" is
 *  measured against, asked of the bar rather than of `--height-header`, because
 *  the token and the bar disagreeing is one of the things this can catch. */
const headerSeam = async (world: OlaiWorld): Promise<number> => {
  const header = await world.box(world.page.locator(APP_HEADER), "the app header");
  return header.y + header.height;
};

Then(
  "the section heading of {string} is pinned under the header",
  async function (this: OlaiWorld, id: string) {
    const seam = await headerSeam(this);
    const line = await this.box(this.within(id, NODE_GUTTER), `the row "${id}"`);
    assert.ok(
      Math.abs(line.y - seam) <= SEAM_EDGE,
      `the section heading of "${id}" is at y=${Math.round(line.y)} and the ` +
        `header ends at ${Math.round(seam)} — in flow a heading leaves the ` +
        "screen with the first flick of the wheel, and a reader in the middle " +
        "of a long branch is then looking at rows with nothing saying which " +
        "section they are in",
    );
  },
);

/** The negative half, and it is what makes the claim mean anything: a row that
 *  is not a section does NOT hold the seam. Without it, a client that pinned
 *  every row in the tree — or drew the whole outline inside the viewport —
 *  would pass the assertion above. */
Then(
  "the row {string} is not pinned under the header",
  async function (this: OlaiWorld, id: string) {
    const seam = await headerSeam(this);
    const line = await this.box(this.within(id, NODE_GUTTER), `the row "${id}"`);
    assert.ok(
      Math.abs(line.y - seam) > SEAM_EDGE,
      `the row "${id}" is holding the seam at y=${Math.round(line.y)} — only a ` +
        "top-level row is a section, and a tree that pinned every row would " +
        "stack them all under the bar",
    );
  },
);

Then("the node titled {string} is shown", async function (this: OlaiWorld, title: string) {
  await this.waitUntil(async () => (await this.page.locator(NODE_TITLE).allInnerTexts()).includes(title),
    `a node titled ${JSON.stringify(title)} to be shown`);
});
