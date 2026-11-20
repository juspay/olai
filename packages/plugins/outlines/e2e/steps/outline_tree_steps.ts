import * as assert from "node:assert";
import { TESTID as LAYOUT_TESTID } from "olai-plugin-layout/testids";
import { TESTID as HARNESS_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { childOf, notChildOf } from "@olai/tests/harness/nesting.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import {
  APP_HEADER,
  attr,
  BLOCKED,
  DATE,
  DESC,
  expectGone,
  FOLDED_DONE,
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
} from "@olai/tests/harness/world.ts";
import {
  CHECKBOX,
  HOT_FACT,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the tree is shown", async function (this: OlaiWorld) {
  await this.frontLane()
    .locator(OUTLINE_TREE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no outline tree is shown", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.frontLane().locator(OUTLINE_TREE).count(),
    0,
    "a tree is on screen; an invalid set shows the error view INSTEAD of one",
  );
});

Then("the node {string} is shown", async function (this: OlaiWorld, id: string) {
  await this.node(id)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

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

const titleBox = async (world: OlaiWorld, id: string) => {
  const title = world.nodeTitle(id);
  await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await title.evaluate((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return {
      top: box.top,
      width: box.width,
      height: box.height,
      line: Number.parseFloat(style.lineHeight),
      clipped: node.scrollWidth > node.clientWidth + 1 || style.textOverflow === "ellipsis" ||
        style.whiteSpace === "nowrap",
    };
  });
};

Then(
  "the title of {string} wraps onto more than one line, cut off nowhere",
  async function (this: OlaiWorld, id: string) {
    const says = async () => {
      const box = await titleBox(this, id);
      return { lines: Math.round(box.height / box.line), clipped: box.clipped };
    };
    await this.waitUntil(
      async () => {
        const now = await says();
        return now.lines > 1 && !now.clipped;
      },
      `the title of "${id}" to run onto a second line, whole`,
    ).catch(async () => {
      const now = await says();
      assert.ok(
        now.lines > 1 && !now.clipped,
        `the title of "${id}" is ${now.lines} line(s)${now.clipped ? " and clipped" : ""} — a long title wraps rather than being cut off`,
      );
    });
  },
);

Then(
  "the title of {string} is one line",
  async function (this: OlaiWorld, id: string) {
    const box = await titleBox(this, id);
    assert.strictEqual(Math.round(box.height / box.line), 1, `the title of "${id}" is ${box.height}px tall`);
  },
);

Then(
  "the bullet of {string} sits beside the first line of its title",
  async function (this: OlaiWorld, id: string) {
    const bullet = this.within(id, ZOOM);
    await bullet.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const at = await bullet.boundingBox();
    assert.ok(at !== null, `the bullet of "${id}" has no box`);
    const middle = at.y + at.height / 2;
    const title = await titleBox(this, id);
    assert.ok(
      middle >= title.top && middle <= title.top + title.line,
      `the bullet of "${id}" is centred at y=${middle}, and the first line of its title runs ${title.top}–${title.top + title.line}`,
    );
  },
);

Then(
  "the title of {string} takes most of the width of its row",
  async function (this: OlaiWorld, id: string) {
    const row = this.within(id, NODE_GUTTER);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const line = await row.boundingBox();
    assert.ok(line !== null, `the row of "${id}" has no box`);
    const title = await titleBox(this, id);
    assert.ok(
      title.width >= line.width * 0.6,
      `the title of "${id}" is ${title.width}px of a ${line.width}px row — the facts beside it are squeezing the words`,
    );
  },
);

Then(
  "the node {string} has no status",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttributeAbsent(nodeSelector(id), "data-status", `node "${id}"`);
  },
);

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
    await drawsNothing(this, id, CHECKBOX, "checkbox");
  },
);

Then(
  "the node {string} shows the progress {string}",
  async function (this: OlaiWorld, id: string, progress: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${PROGRESS}`,
      "data-progress",
      progress,
      `node "${id}"`,
    );
  },
);

Then(
  "the node {string} shows a settled took chip",
  async function (this: OlaiWorld, id: string) {
    const chip = this.node(id).locator(NODE_GUTTER).locator(TOOK);
    await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => /^\d+$/.test((await chip.getAttribute("data-took")) ?? ""),
      `the node "${id}" wears a settled took chip (data-took of whole seconds)`,
    );
    const seconds = parseInt((await chip.getAttribute("data-took")) ?? "-1", 10);
    assert.ok(seconds >= 0 && seconds < 60, `"${id}"'s took attr is ${seconds}s`);
    await this.waitUntil(
      async () => {
        await this.page.mouse.move(40, 40);
        await chip.hover();
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
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["title"] === title && typeof node["worked"] === "number",
        ),
      `${file} to hold a node titled ${JSON.stringify(title)} with \`worked\` banked`,
    );
  },
);

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
    await drawsNothing(this, id, TOOK, "took chip");
  },
);

Then(
  "the node {string} shows the date {string}",
  async function (this: OlaiWorld, id: string, date: string) {
    const badge = this.node(id).locator(DATE).first();
    await badge.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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
    assert.ok(
      !text.includes("**"),
      `the description of "${id}" still contains markdown source: ${JSON.stringify(text)}`,
    );
  },
);

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

Then(
  "the description of {string} is clamped to one line",
  async function (this: OlaiWorld, id: string) {
    const desc = this.node(id).locator(DESC).first();
    await desc.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await desc.boundingBox();
    assert.ok(box !== null, `the description of "${id}" has no box`);
    assert.ok(
      box.height <= 32,
      `the description of "${id}" is ${Math.round(box.height)}px tall — ` +
        "a one-line clamp should be a single line of text",
    );
  },
);

const noteMark = (world: OlaiWorld, id: string) =>
  world.within(id, NOTE_MARK);

const noteControl = (world: OlaiWorld, id: string) =>
  world.node(id).locator(DESC).first();

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
    await drawsNothing(this, id, NOTE_MARK, "pilcrow");
  },
);

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

const clickToggle = (world: OlaiWorld, id: string): Promise<void> =>
  world.clickWithin(id, TOGGLE);

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

Then(
  "the node {string} is marked as a mirror",
  async function (this: OlaiWorld, id: string) {
    await this.expectNodeAttribute(id, "data-kind", "mirror");
  },
);

Then(
  "the node {string} is blocked by {string}",
  async function (this: OlaiWorld, id: string, blocker: string) {
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
    const face = await mark.locator("[data-face]").first().getAttribute("data-face");
    assert.strictEqual(
      face,
      "waiting",
      `the waiting mark on "${id}" does not carry data-face=waiting`,
    );
  },
);

Then(
  "the mark column of {string} is named {string}",
  async function (this: OlaiWorld, id: string, name: string) {
    const zoom = this.within(id, ZOOM);
    await zoom.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await zoom
          .and(this.page.getByRole("link", { name, exact: true }))
          .count()) === 1,
      `the mark column of "${id}" to be named ${JSON.stringify(name)}`,
    );
  },
);

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

const controlOpacity = async (
  world: OlaiWorld,
  id: string,
  control: string,
): Promise<number> => {
  const el = world.within(id, control);
  await el.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  return el.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity));
};

const clearHover = async (world: OlaiWorld): Promise<void> => {
  await world.page.locator("body").hover({ position: { x: 2, y: 2 } });
  await world.waitForFrame();
};

Then(
  "the node menu of {string} is revealed",
  async function (this: OlaiWorld, id: string) {
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
    await this.focusWithin(id, TOGGLE);
  },
);

const SEAM_EDGE = 2;

const headerSeam = async (world: OlaiWorld): Promise<number> => {
  const strip = world.page.locator(selector(LAYOUT_TESTID.mainStrip));
  const header = await world.box(await strip.count() ? strip : world.page.locator(APP_HEADER), "the main-column chrome");
  return header.y + header.height;
};

Then(
  "the section heading of {string} is pinned under the main-column chrome",
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

When("I scroll to the end of the outline", async function (this: OlaiWorld) {
  const tree = this.frontLane().locator(OUTLINE_TREE).first();
  await this.waitUntil(async () => {
    await tree.evaluate((element) => {
      window.scrollTo(0, scrollY + element.getBoundingClientRect().bottom - innerHeight);
    });
    await this.waitForFrame();
    return tree.evaluate((element) => scrollY > 0 && Math.abs(element.getBoundingClientRect().bottom - innerHeight) <= 2);
  }, "the outline's last row to sit at the bottom of the window");
});

Then(
  "the row {string} is not pinned under the main-column chrome",
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

const offerOn = (world: OlaiWorld, id: string) =>
  world.page.locator(`${selector(HARNESS_TESTID.agentStart)}${attr("data-agent", world.nodeId(id))}`);
const standingOn = (world: OlaiWorld, id: string) =>
  world.page.locator(`${selector(HARNESS_TESTID.agentStanding)}${attr("data-agent", world.nodeId(id))}`);

When("I tap the title of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, NODE_TITLE), "tap");
});

Then("the agent offer on {string} is not drawn", async function (this: OlaiWorld, id: string) {
  const offer = offerOn(this, id);
  await offer.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => !(await offer.isVisible()), `the agent offer on "${id}" to be put away`);
});

Then("the agent offer on {string} is drawn", async function (this: OlaiWorld, id: string) {
  await offerOn(this, id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the agent standing on {string} is drawn", async function (this: OlaiWorld, id: string) {
  await standingOn(this, id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
