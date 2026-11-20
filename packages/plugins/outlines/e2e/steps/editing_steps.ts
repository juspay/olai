import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";

import { Then, When } from "@olai/tests/harness/runner.ts";

import { MARKS } from "@olai/format";

import { shiftDay } from "@olai/format";
import { isoDayOf, selector } from "@olai/web/testlib"
import { IDLE_COMMIT } from "../../src/testlib.ts"

import type { ElementHandle, Locator } from "@olai/tests/harness/playwright.ts";

import { leavingTheLine, nothingIsBeingTyped } from "@olai/tests/harness/caret.ts";
import { pressed, typed } from "@olai/tests/harness/settling.ts";
import { retypedAndTaken } from "@olai/tests/harness/atonce.ts";
import { announcedAs, saysNothing, saysThat } from "@olai/tests/harness/said.ts";
import {
  DESC_EDITOR,
  EDIT_REFUSAL,
  expectBefore,
  NEW_ROW,
  NODE,
  NODE_MENU,
  NODE_TITLE,
  nodeSelector,
  POLL_TIMEOUT,
  TAG,
  TITLE_EDITOR,
} from "@olai/tests/harness/world.ts";
import {
  EDIT_NUDGE,
  START_LINE,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When(
  "I click the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.intoReach(title);
    const box = await title.boundingBox();
    if (box === null) {
      throw new Error(`the title of ${JSON.stringify(id)} has no box`);
    }
    const tagged = (await title.locator(TAG).count()) > 0;
    if (tagged) {
      const line = title.locator("xpath=..");
      const lineBox = await line.boundingBox();
      if (lineBox === null) {
        throw new Error(`the line of ${JSON.stringify(id)} has no box`);
      }
      await line.click({
        position: {
          x: Math.min(
            box.x - lineBox.x + box.width + 8,
            Math.max(lineBox.width - 2, 0),
          ),
          y: lineBox.height / 2,
        },
      });
    } else {
      await title.click();
    }
    await this.waitForFrame();
    await this.page
      .locator(`${TITLE_EDITOR}:visible`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.page.locator(`${TITLE_EDITOR}:visible`).first().press("ControlOrMeta+End");
  },
);

When(
  "I click the title of {string} near its start",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.intoReach(title);
    const box = await title.boundingBox();
    if (box === null) {
      throw new Error(`the title of ${JSON.stringify(id)} has no box`);
    }
    await title.click({
      position: { x: Math.min(8, box.width / 4), y: box.height / 2 },
    });
    await this.waitForFrame();
    await this.page
      .locator(`${TITLE_EDITOR}:visible`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the empty outline {string}",
  async function (this: OlaiWorld, file: string) {
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
    .locator(`${TITLE_EDITOR}:visible`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I type {string}", async function (this: OlaiWorld, text: string) {
  await typed(this, text);
});

When(
  "I select all and type {string}",
  async function (this: OlaiWorld, text: string) {
    await pressed(this, "ControlOrMeta+a");
    if (text === "") await pressed(this, "Backspace");
    else await typed(this, text);
  },
);

When(
  "I retype the row as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await openEditor(this), text);
  },
);

When("I press {string}", async function (this: OlaiWorld, key: string) {
  await pressed(this, key);
});

When("a DOM reorder briefly removes and refocuses the title editor", async function (this: OlaiWorld) {
  await this.page.locator(`${TITLE_EDITOR}:visible`).first().evaluate((element) => {
    if (document.activeElement !== element) throw new Error("title editor is not focused");
    const parent = element.parentNode!;
    const next = element.nextSibling;
    parent.removeChild(element);
    parent.insertBefore(element, next);
    (element as HTMLElement).focus();
  });
});

When(
  "I press {string} without waiting",
  async function (this: OlaiWorld, key: string) {
    await this.page.keyboard.press(key);
  },
);

When(
  "I press {string} twice without waiting",
  async function (this: OlaiWorld, key: string) {
    await Promise.all([
      this.page.keyboard.press(key),
      this.page.keyboard.press(key),
    ]);
  },
);

const openEditor = async (world: OlaiWorld): Promise<Locator> => {
  const editor = world.page.locator(`${TITLE_EDITOR}:visible`).first();
  await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return editor;
};

const rangeOver = async (
  world: OlaiWorld,
  text: string,
  collapse: boolean,
): Promise<void> => {
  const editor = await openEditor(world);
  await editor.evaluate((element, [wanted, shut]) => {
    const field = element as HTMLInputElement;
    const at = field.value.indexOf(wanted);
    if (at === -1) {
      throw new Error(
        `the editor holds ${JSON.stringify(field.value)}, which does not contain ${
          JSON.stringify(wanted)
        }`,
      );
    }
    field.setSelectionRange(shut ? at + wanted.length : at, at + wanted.length);
  }, [text, collapse] as [string, boolean]);
};

When(
  "I put the caret after {string}",
  async function (this: OlaiWorld, prefix: string) {
    await rangeOver(this, prefix, true);
  },
);

When("I put the caret at the start of the line", async function (this: OlaiWorld) {
  const editor = await openEditor(this);
  await editor.evaluate((element) => {
    (element as HTMLInputElement).setSelectionRange(0, 0);
  });
});

When(
  "I select {string} in the line",
  async function (this: OlaiWorld, text: string) {
    await rangeOver(this, text, false);
  },
);

Then(
  "the caret is at offset {int}",
  async function (this: OlaiWorld, offset: number) {
    const editor = await openEditor(this);
    await this.waitUntil(
      async () =>
        (await editor.evaluate(
          (element) => (element as HTMLInputElement).selectionStart,
        )) === offset,
      `the caret to be at offset ${offset}`,
    );
  },
);

Then("the caret is near the start of the line", async function (this: OlaiWorld) {
  const editor = await openEditor(this);
  await this.waitUntil(async () => {
    const at = await editor.evaluate((element) => {
      const field = element as HTMLInputElement;
      return { start: field.selectionStart, length: field.value.length };
    });
    return at.start !== null && at.start <= 1 && at.start !== at.length;
  }, "the caret to sit at the start of the line, not the end");
});

When("I click the first new row", async function (this: OlaiWorld) {
  const row = this.page.locator(`${NEW_ROW} ${TITLE_EDITOR}`).first();
  await this.press(row);
});

When("I focus the first parked row and type {string} immediately", async function (this: OlaiWorld, text: string) {
  await this.page.locator(`${NEW_ROW} ${TITLE_EDITOR}`).first().evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.focus();
    input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }, text);
});

When("I click the page away from the drafts", async function (this: OlaiWorld) {
  await this.page.locator("main").click({ position: { x: 4, y: 4 } });
  await this.waitForFrame();
  await this.waitUntil(async () => {
    const inADraft = await this.page.evaluate((sel) => {
      const el = document.activeElement;
      return el !== null && el.matches(sel);
    }, TITLE_EDITOR);
    return !inADraft;
  }, "focus to leave the drafts");
});

When("I click away from the editor", async function (this: OlaiWorld) {
  await leavingTheLine(
    this,
    async () => {
      await this.page.locator("main").click({ position: { x: 4, y: 4 } });
      await this.waitForFrame();
    },
    "the caret to leave the line the click was away from",
  );
});

Then(
  "the row being typed holds {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.page.locator(`${TITLE_EDITOR}:visible`).first();
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await editor.inputValue()) === text,
      `the row being typed to hold ${JSON.stringify(text)}`,
    );
  },
);

Then("the row being typed has the focus", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      this.page.evaluate(
        (sel) => document.activeElement?.matches(sel) ?? false,
        TITLE_EDITOR,
      ),
    "the caret to be in the row being typed",
  );
});

When("I return to the row being typed", async function (this: OlaiWorld) {
  await this.press(this.page.locator(`${TITLE_EDITOR}:visible`).first());
});

const textLeftOf = async (world: OlaiWorld, locator: Locator): Promise<number> => {
  const box = await world.box(locator, "the line");
  return box.x;
};

Then(
  "the row being typed lines up with the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const draft = await textLeftOf(
      this,
      this.page.locator(`${NEW_ROW} ${TITLE_EDITOR}`).first(),
    );
    const row = await textLeftOf(this, this.nodeTitle(id));
    assert.ok(
      Math.abs(draft - row) < 1,
      `the line being typed starts at x=${draft} and the row it will join at x=${row} — a line typed at one depth and committed at another`,
    );
  },
);

Then(
  "the row {string} holds the caret",
  async function (this: OlaiWorld, id: string) {
    await this.expectNodeAttribute(id, "data-editing", "true");
  },
);

Then("no other row holds the caret", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(`${NODE}[data-editing="true"]`).count(),
    1,
    "more than one row says it holds the caret",
  );
});

Then(
  "the note being typed holds the source of {string}",
  async function (this: OlaiWorld, id: string) {
    const editor = this.within(id, DESC_EDITOR);
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = await editor.inputValue();
    assert.ok(
      text.includes("**walnut**"),
      `the note editor holds ${JSON.stringify(text)}, which is not the markdown the file holds`,
    );
  },
);

Then(
  "the note's caret is at offset {int}",
  async function (this: OlaiWorld, offset: number) {
    const editor = this.page.locator(DESC_EDITOR).first();
    await this.waitUntil(
      async () =>
        (await editor.evaluate(
          (element) => (element as HTMLTextAreaElement).selectionStart,
        )) === offset,
      `the note's caret to be at offset ${offset}`,
    );
  },
);

Then("no row is being edited", async function (this: OlaiWorld) {
  await nothingIsBeingTyped(this);
});

Then("a new row is being typed", async function (this: OlaiWorld) {
  await this.page
    .locator(NEW_ROW)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("{int} new rows are being typed", async function (this: OlaiWorld, n: number) {
  await this.waitUntil(
    async () => (await this.frontLane().locator(`${NEW_ROW}:visible`).count()) === n,
    `${n} new rows to be on the page`,
  );
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

Then("the refusal says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, EDIT_REFUSAL, said, "refusal", "alarm");
});

Then("the nudge says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, EDIT_NUDGE, said, "nudge", "aside");
});

Then("the refusal is announced at once", async function (this: OlaiWorld) {
  await announcedAs(this, EDIT_REFUSAL, "at once", "refusal");
});

Then("the nudge is announced politely", async function (this: OlaiWorld) {
  await announcedAs(this, EDIT_NUDGE, "politely", "nudge");
});

Then("nothing is being said about the row", async function (this: OlaiWorld) {
  await saysNothing(
    this,
    [EDIT_NUDGE, EDIT_REFUSAL],
    "the row to have nothing said about it",
  );
});

Then(
  "the node {string} comes before {string}",
  async function (this: OlaiWorld, first: string, second: string) {
    await expectBefore(
      this,
      this.page.locator(`${nodeSelector(first)}, ${nodeSelector(second)}`),
      "data-node-id",
      first,
      second,
    );
  },
);

Then(
  "the node titled {string} comes before {string}",
  async function (this: OlaiWorld, title: string, second: string) {
    await this.waitUntil(async () => {
      const first = await idTitled(this, title);
      if (first === null) return false;
      const drawn = await this.page
        .locator(NODE)
        .evaluateAll((all) => all.map((element) => element.getAttribute("data-node-id")));
      return drawn.indexOf(first) !== -1 && drawn.indexOf(first) < drawn.indexOf(second);
    }, `the node titled ${JSON.stringify(title)} to be drawn above "${second}"`);
  },
);

Then(
  "the node titled {string} comes before the node titled {string}",
  async function (this: OlaiWorld, firstTitle: string, secondTitle: string) {
    await this.waitUntil(async () => {
      const first = await idTitled(this, firstTitle);
      const second = await idTitled(this, secondTitle);
      if (first === null || second === null) return false;
      const drawn = await this.page
        .locator(NODE)
        .evaluateAll((all) => all.map((element) => element.getAttribute("data-node-id")));
      return drawn.indexOf(first) !== -1 && drawn.indexOf(first) < drawn.indexOf(second);
    }, `the node titled ${JSON.stringify(firstTitle)} to be drawn above ${JSON.stringify(secondTitle)}`);
  },
);

const idTitled = async (world: OlaiWorld, title: string): Promise<string | null> =>
  world.page.locator(NODE).evaluateAll((rows, selectors) => {
    for (const row of rows) {
      const cell = row.querySelector(selectors.shown);
      const field = cell?.querySelector(selectors.typing);
      const text = field instanceof HTMLInputElement ? field.value : cell?.textContent;
      if (text?.includes(selectors.title)) return row.getAttribute("data-node-id");
    }
    return null;
  }, { shown: NODE_TITLE, typing: TITLE_EDITOR, title });
Then(
  "the row being typed is drawn immediately above the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => {
      const editor = this.page.locator(`${NEW_ROW}:focus-within`).first();
      if ((await editor.count()) === 0) return false;
      const above = await editor.boundingBox();
      const of = await title.boundingBox();
      if (above === null || of === null) return false;
      const gap = of.y - (above.y + above.height);
      return gap >= -2 && gap < 40;
    }, `the draft to sit immediately above the title of "${id}", not below its subtree`);
  },
);

Then(
  "the row being typed is drawn at the child depth of {string}",
  async function (this: OlaiWorld, id: string) {
    const row = this.node(id);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => {
      const draft = this.page.locator(`${NEW_ROW}:focus-within`).first();
      if ((await draft.count()) === 0) return false;
      const box = await draft.boundingBox();
      const li = await row.boundingBox();
      if (box === null || li === null) return false;
      return box.x > li.x + 4 && box.y > li.y + 4;
    }, `the new row to be drawn at a child depth of "${id}"`);
  },
);

Then(
  "the row being typed stands the same line below {string} as that row stands below {string}",
  async function (this: OlaiWorld, below: string, above: string) {
    const belowTitle = this.nodeTitle(below);
    const aboveTitle = this.nodeTitle(above);
    await belowTitle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await aboveTitle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => {
      const editor = this.page.locator(`${TITLE_EDITOR}:visible`).first();
      if ((await editor.count()) === 0) return false;
      const b = await belowTitle.boundingBox();
      const a = await aboveTitle.boundingBox();
      const g = await editor.boundingBox();
      if (a === null || b === null || g === null) return false;
      const rhythm = b.y - a.y;
      const stood = g.y - b.y;
      return Math.abs(stood - rhythm) <= 2;
    }, `the draft to stand one line below "${below}" — the spacing a row keeps`);
  },
);

Then(
  "the row being typed is drawn immediately after {string}",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(async () => {
      const rows = await this.page
        .locator(NODE)
        .evaluateAll((found) =>
          found.map((row) => [
            row.getAttribute("data-node-id") ?? "",
            row.getAttribute("data-editing") === "true",
          ] as const),
        );
      const at = rows.findIndex(([node]) => node === id);
      return at !== -1 && rows[at + 1]?.[1] === true;
    }, `the row holding the caret to be drawn immediately after "${id}"`);
  },
);

const titlesIn = (world: OlaiWorld, file: string): ReadonlyArray<string> =>
  world.servedNodesSoFar(file).map((node) => String(node["title"] ?? ""));

Then(
  "{string} holds a node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () => titlesIn(this, file).includes(title),
      `${file} to hold a node titled ${JSON.stringify(title)}`,
    );
  },
);

Then(
  "{string} holds exactly {int} node(s) titled {string}",
  async function (this: OlaiWorld, file: string, many: number, title: string) {
    const counted = () => titlesIn(this, file).filter((one) => one === title).length;
    await this.waitUntil(
      async () => counted() === many,
      `${file} to hold exactly ${many} × ${JSON.stringify(title)}`,
    );
    await this.page.waitForTimeout(HELD);
    assert.strictEqual(
      counted(),
      many,
      `${file} held ${many} × ${JSON.stringify(title)} and then did not`,
    );
  },
);

Then(
  "{string} holds a node titled {string} under {string}",
  async function (this: OlaiWorld, file: string, title: string, parent: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["title"] === title && node["parent"] === parent,
        ),
      `${file} to hold ${JSON.stringify(title)} under ${JSON.stringify(parent)}`,
    );
  },
);

const HELD = Math.floor(IDLE_COMMIT / 3);

Then(
  "{string} holds a node marked {word} titled {string}",
  async function (this: OlaiWorld, file: string, mark: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["title"] === title && node[mark] !== undefined,
        ),
      `${file} to hold a node titled ${JSON.stringify(title)} that is marked ${mark}`,
    );
  },
);

Then(
  "{string} holds a node whose note ends {string}",
  async function (this: OlaiWorld, file: string, ending: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some((node) =>
          String(node["desc"] ?? "").trimEnd().endsWith(ending)
        ),
      `${file} to hold a node whose note ends ${JSON.stringify(ending)}`,
    );
  },
);

Then(
  "{string} holds the node {string}",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () => this.servedNodesSoFar(file).some((node) => node["id"] === id),
      `${file} to hold the node ${JSON.stringify(id)}`,
    );
  },
);

Then(
  "{string} no longer holds the node {string}",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () => !this.servedNodesSoFar(file).some((node) => node["id"] === id),
      `${file} to have let go of the node ${JSON.stringify(id)}`,
    );
  },
);

Then(
  "{string} holds a mirror of {string} under {string}",
  async function (this: OlaiWorld, file: string, target: string, parent: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["mirror"] === target && node["parent"] === parent,
        ),
      `${file} to hold a mirror of ${JSON.stringify(target)} under ${
        JSON.stringify(parent)
      }`,
    );
  },
);

Then(
  "{string} holds no mirror of {string}",
  async function (this: OlaiWorld, file: string, target: string) {
    await this.waitUntil(
      async () => !this.servedNodesSoFar(file).some((node) => node["mirror"] === target),
      `${file} to hold no placement of ${JSON.stringify(target)}`,
    );
  },
);

Then(
  "{string} holds the node {string} dated {string}",
  async function (this: OlaiWorld, file: string, id: string, date: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["date"] === date,
        ),
      `${file} to hold ${JSON.stringify(id)} with \`date\` exactly ${JSON.stringify(date)}`,
    );
  },
);

Then(
  "{string} holds a node titled {string} dated {string}",
  async function (this: OlaiWorld, file: string, title: string, date: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["title"] === title && node["date"] === date,
        ),
      `${file} to hold ${JSON.stringify(title)} dated ${JSON.stringify(date)}`,
    );
  },
);

Then(
  "{string} holds the node {string} dated tomorrow",
  async function (this: OlaiWorld, file: string, id: string) {
    const wanted = shiftDay(isoDayOf(new Date()), 1);
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["date"] === wanted,
        ),
      `${file} to hold ${JSON.stringify(id)} dated ${JSON.stringify(wanted)}`,
    );
  },
);

Then(
  "{string} holds the node {string} with no date",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["date"] === undefined,
        ),
      `${file} to hold ${JSON.stringify(id)} with no \`date\` field`,
    );
  },
);

Then(
  "{string} holds the node {string} with no mark",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) =>
            node["id"] === id && MARKS.every((mark) => node[mark] === undefined),
        ),
      `${file} to hold ${JSON.stringify(id)} carrying none of ${MARKS.join(", ")}`,
    );
  },
);

Then(
  "{string} holds a node with no note titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["title"] === title && node["desc"] === undefined,
        ),
      `${file} to hold a node titled ${JSON.stringify(title)} carrying no note`,
    );
  },
);

Then(
  "{string} holds a bare node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) =>
            node["title"] === title &&
            Object.keys(node).every((field) =>
              ["id", "parent", "ord", "title", "created"].includes(field)
            ),
        ),
      `${file} to hold ${JSON.stringify(title)} carrying nothing but its placement`,
    );
  },
);

Then(
  "{string} no longer holds a node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () => !titlesIn(this, file).includes(title),
      `${file} to have let go of the node titled ${JSON.stringify(title)}`,
    );
  },
);

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

Then("the selected text in the line is {string}", async function (this: OlaiWorld, expected: string) {
  const field = await openEditor(this);
  const selected = () => field.evaluate((element) => {
    const input = element as HTMLInputElement;
    return input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
  });
  await this.waitUntil(async () => await selected() === expected,
    `the selected text to remain ${JSON.stringify(expected)}`).catch(async () => {
      assert.strictEqual(await selected(), expected);
    });
});

When("I select {string} backwards in the note", async function (this: OlaiWorld, text: string) {
  const field = this.page.locator(DESC_EDITOR).first();
  await field.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await field.evaluate((element, wanted) => {
    const input = element as HTMLTextAreaElement;
    const start = input.value.indexOf(wanted);
    if (start < 0) throw new Error(`the note does not contain ${JSON.stringify(wanted)}`);
    input.setSelectionRange(start, start + wanted.length, "backward");
  }, text);
});

Then("the note retains the backward selection {string}", async function (this: OlaiWorld, expected: string) {
  const field = this.page.locator(DESC_EDITOR).first();
  await field.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(() => field.evaluate((element, text) => {
    const input = element as HTMLTextAreaElement;
    return input.value.slice(input.selectionStart, input.selectionEnd) === text
      && input.selectionDirection === "backward";
  }, expected), `the note to retain its backward selection of ${JSON.stringify(expected)}`);
});

const parkedInputs = new WeakMap<OlaiWorld, import("@olai/tests/harness/playwright.ts").ElementHandle<HTMLElement | SVGElement>>();
When("I remember the first parked input", async function (this: OlaiWorld) {
  const input = await this.page.locator(`${NEW_ROW} ${TITLE_EDITOR}`).first().elementHandle();
  assert.ok(input);
  parkedInputs.set(this, input);
});
Then("the remembered parked input still holds the caret", async function (this: OlaiWorld) {
  const input = parkedInputs.get(this);
  assert.ok(input);
  const state = await input.evaluate((element) => ({
    connected: element.isConnected,
    focused: document.activeElement === element,
    active: document.activeElement?.outerHTML,
    remembered: element.outerHTML,
  }));
  assert.ok(state.connected && state.focused, JSON.stringify(state));
});

const NOTE_MARK = selector(TESTID.noteMark);
const AGENT_CHIP = selector(TESTID.agentStart);

type Sat = {
  readonly what: string;
  readonly element: ElementHandle<HTMLElement | SVGElement>;
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
};
const facts = new WeakMap<OlaiWorld, ReadonlyArray<Sat>>();

const WHAT_FACTS: ReadonlyArray<readonly [string, string]> = [
  ["the title cell", NODE_TITLE],
  ["the note mark", NOTE_MARK],
  ["the plugin chip", AGENT_CHIP],
];

When("I write down where the facts of {string} sit", async function (this: OlaiWorld, id: string) {
  const row = this.node(id);
  const written: Array<Sat> = [];
  for (const [what, control] of WHAT_FACTS) {
    const element = await row.locator(control).first().elementHandle();
    assert.ok(element !== null, `${what} of "${id}" is not on the line to write down`);
    const box = await element.boundingBox();
    assert.ok(box !== null, `${what} of "${id}" has no box`);
    written.push({ what, element, box });
  }
  facts.set(this, written);
});

const movedOf = async (world: OlaiWorld, id: string): Promise<string | null> => {
  const written = facts.get(world);
  assert.ok(written !== undefined, "no `I write down where the facts of … sit` came first");
  for (const one of written) {
    if (!(await one.element.evaluate((element) => element.isConnected))) {
      return `${one.what} was taken off the line and made again`;
    }
    const box = await one.element.boundingBox();
    if (box === null) return `${one.what} has no box any more`;
    for (const edge of ["x", "y", "width", "height"] as const) {
      const written = one.box[edge];
      if (Math.abs(box[edge] - written) > 1) {
        return `${one.what} moved: its ${edge} was ${written} and is ${box[edge]}`;
      }
    }
  }
  return null;
};

Then("the facts of {string} sit where they sat", async function (this: OlaiWorld, id: string) {
  await this.waitUntil(
    async () => (await movedOf(this, id)) === null,
    `the facts of "${id}" to sit where they sat`,
  ).catch(async () => {
    assert.fail(`"${id}": ${await movedOf(this, id)}`);
  });
});

Then("the title of {string} is being typed", async function (this: OlaiWorld, id: string) {
  await this.node(id).locator(NODE_TITLE).first().locator(`${TITLE_EDITOR}:visible`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no row is pointed at", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(`${NODE}[data-focused="true"]`).count()) === 0,
    "no row to wear the ring a reference puts on the row it points at",
  );
});

Then("the row being typed is the one pointed at", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      await this.page.evaluate(
        ([editor, node]) => {
          const field = document.activeElement;
          const row = field === null ? null : field.closest(node);
          return row !== null && row.getAttribute("data-focused") === "true";
        },
        [TITLE_EDITOR, NODE] as [string, string],
      ),
    "the line being typed to hold the caret AND the ring, as one row",
  );
});

const GLYPH = `${selector(TESTID.newRowGlyph)}, ${selector(TESTID.zoom)}`;

type LineBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
const lineBoxes = new WeakMap<OlaiWorld, { readonly glyph: LineBox; readonly field: LineBox }>();

const readyBox = async (world: OlaiWorld, where: Locator, what: string): Promise<LineBox> => {
  await where.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const box = await where.boundingBox();
  assert.ok(box !== null, `${what} has no box`);
  return box;
};

When("I write down the boxes of the line being typed", async function (this: OlaiWorld) {
  const blank = this.frontLane().locator(`${NEW_ROW}:visible`).first();
  lineBoxes.set(this, {
    glyph: await readyBox(this, blank.locator(GLYPH).first(), "the bullet of the line being typed"),
    field: await readyBox(this, blank.locator(`${TITLE_EDITOR}:visible`).first(), "the caret of the line being typed"),
  });
});

Then("the row it became stands in the same boxes", async function (this: OlaiWorld) {
  const written = lineBoxes.get(this);
  assert.ok(written !== undefined, "no boxes were written down first");
  const id = await caretRow(this);
  const row = this.node(id);
  const now = {
    glyph: await readyBox(this, row.locator(GLYPH).first(), `the bullet of "${id}"`),
    field: await readyBox(this, row.locator(`${TITLE_EDITOR}:visible`).first(), `the caret of "${id}"`),
  };
  const WHAT = { glyph: "bullet", field: "caret" } as const;
  const moved: Array<string> = [];
  for (const which of ["glyph", "field"] as const) {
    for (const edge of ["x", "y", "height"] as const) {
      const was = written[which][edge];
      const is = now[which][edge];
      if (Math.abs(is - was) > 1) {
        moved.push(`the ${WHAT[which]}'s ${edge} was ${was} in the blank and is ${is} on the row`);
      }
    }
  }
  assert.deepStrictEqual(moved, [], `the line moved when it landed: ${moved.join("; ")}`);
});

const HIDDEN_UNTIL_HOVERED: ReadonlyArray<readonly [string, string]> = [
  ["the •••", NODE_MENU],
  ["the plugin chip", AGENT_CHIP],
];

const caretRow = async (world: OlaiWorld): Promise<string> => {
  const id = await world.page.evaluate((editor) => {
    const field = document.activeElement;
    return field !== null && field.matches(editor)
      ? field.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null
      : null;
  }, TITLE_EDITOR);
  assert.ok(id !== null, "the caret is not in a row's title");
  return id;
};

const revealsOf = async (
  world: OlaiWorld,
  id: string,
): Promise<ReadonlyArray<readonly [string, number | null]>> => {
  const out: Array<readonly [string, number | null]> = [];
  for (const [what, control] of HIDDEN_UNTIL_HOVERED) {
    const where = world.within(id, control);
    out.push([
      what,
      (await where.count()) === 0
        ? null
        : await where.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)),
    ]);
  }
  return out;
};

When("the pointer is off every row", async function (this: OlaiWorld) {
  await this.page.locator("body").hover({ position: { x: 2, y: 2 } });
  await this.waitForFrame();
});

Then("the row being typed hides its furniture", async function (this: OlaiWorld) {
  const id = await caretRow(this);
  await this.waitUntil(async () => {
    const reveals = await revealsOf(this, id);
    return reveals.every(([, opacity]) => opacity === null || opacity < 0.1);
  }, `the ••• and the chip of "${id}" to stay hidden while its title is typed`).catch(async () => {
    assert.fail(`"${id}": ${JSON.stringify(await revealsOf(this, id))} — the caret is not a hand`);
  });
});

When("I hover the row being typed", async function (this: OlaiWorld) {
  await this.node(await caretRow(this)).hover();
  await this.waitForFrame();
});

Then("the row being typed shows its furniture", async function (this: OlaiWorld) {
  const id = await caretRow(this);
  await this.waitUntil(async () => {
    const reveals = await revealsOf(this, id);
    return reveals.some(([, opacity]) => opacity !== null) &&
      reveals.every(([, opacity]) => opacity === null || opacity > 0.5);
  }, `the ••• and the chip of "${id}" to be revealed by a hand on the row`).catch(async () => {
    assert.fail(`"${id}": ${JSON.stringify(await revealsOf(this, id))}`);
  });
});

When("I watch the line being typed", async function (this: OlaiWorld) {
  await this.page.evaluate((editor) => {
    const seen: Array<{ editors: number; focused: boolean }> = []
    const look = () => {
      seen.push({
        editors: document.querySelectorAll(editor).length,
        focused: document.activeElement?.matches(editor) ?? false,
      })
      frame = requestAnimationFrame(look)
    }
    let frame = requestAnimationFrame(look)
    Object.assign(window, { __lineWatch: { seen, stop: () => cancelAnimationFrame(frame) } })
  }, TITLE_EDITOR)
});

Then("the line being typed never stopped being an editor", async function (this: OlaiWorld) {
  const seen = await this.page.evaluate(() => {
    const held = (window as unknown as {
      readonly __lineWatch?: {
        readonly seen: Array<{ editors: number; focused: boolean }>
        readonly stop: () => void
      }
    }).__lineWatch
    if (held === undefined) return null
    held.stop()
    return held.seen
  })
  assert.ok(
    seen !== null,
    "nothing was watching the line: `I watch the line being typed` has to come before this",
  );
  assert.ok(seen.length > 0, "the watch saw no frames at all, so it claims nothing");
  const gone = seen.filter((one) => one.editors === 0);
  assert.strictEqual(
    gone.length,
    0,
    `the line was not an editor for ${gone.length} of ${seen.length} frames — the caret was on ` +
      `the document body and anything typed there went nowhere`,
  );
  const lost = seen.filter((one) => one.editors > 0 && !one.focused);
  assert.strictEqual(
    lost.length,
    0,
    `the caret was outside every editor for ${lost.length} of ${seen.length} frames — the ` +
      `line was on screen and what was typed went past it`,
  );
});

Then(
  "the line being typed has become the row holding {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () =>
        await this.page.evaluate(
          ([editor, ghost, wanted]) => {
            const field = document.activeElement as HTMLInputElement | null
            return field !== null && field.matches(editor) && field.closest(ghost) === null &&
              field.value === wanted
          },
          [TITLE_EDITOR, NEW_ROW, text] as [string, string, string],
        ),
      `the line being typed to be drawn as a row holding ${JSON.stringify(text)}`,
    )
  },
);

Then(
  "the row {string} is not pointed at",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttributeAbsent(nodeSelector(this.nodeId(id)), "data-focused", `node "${id}"`);
  },
);
