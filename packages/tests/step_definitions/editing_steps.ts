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

import { MARKS } from "@olai/format";

import { IDLE_COMMIT } from "@olai/web/src/client/edit/draft.ts";

import type { Locator } from "playwright";

import { saysNothing, saysThat } from "../support/said.ts";
import {
  DESC_EDITOR,
  EDIT_NUDGE,
  EDIT_REFUSAL,
  NEW_ROW,
  NODE,
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
  if (key === "Alt+Shift+ArrowUp" || key === "Alt+Shift+ArrowDown") {
    // A move remounts the row. The next key (⌘Enter) is for the caret
    // that has to come back; one frame is not that, under load.
    await this.page
      .locator(TITLE_EDITOR)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
});

/** The same key, with nothing waited for afterwards — which is how a person
 *  types: faster than a round trip. What the scenario then asserts is that the
 *  writes still landed in the order the keys were pressed, which is the write
 *  queue's whole job. */
When(
  "I press {string} without waiting",
  async function (this: OlaiWorld, key: string) {
    await this.page.keyboard.press(key);
  },
);

// ── where in the line the caret is ─────────────────────────────────────

/** The open title editor, waited for. Two of the keys mean different things
 *  depending on where in it the caret sits, so these steps say that outright
 *  rather than counting `ArrowLeft` presses — what a scenario is about is
 *  "mid-word", not "five characters in". */
const openEditor = async (world: OlaiWorld): Promise<Locator> => {
  const editor = world.page.locator(TITLE_EDITOR).first();
  await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return editor;
};

When(
  "I put the caret after {string}",
  async function (this: OlaiWorld, prefix: string) {
    const editor = await openEditor(this);
    await editor.evaluate((element, text) => {
      const field = element as HTMLInputElement;
      const at = field.value.indexOf(text);
      if (at === -1) {
        throw new Error(
          `the editor holds ${JSON.stringify(field.value)}, which does not contain ${
            JSON.stringify(text)
          }`,
        );
      }
      field.setSelectionRange(at + text.length, at + text.length);
    }, prefix);
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
    const editor = await openEditor(this);
    await editor.evaluate((element, wanted) => {
      const field = element as HTMLInputElement;
      const at = field.value.indexOf(wanted);
      if (at === -1) {
        throw new Error(
          `the editor holds ${JSON.stringify(field.value)}, which does not contain ${
            JSON.stringify(wanted)
          }`,
        );
      }
      field.setSelectionRange(at, at + wanted.length);
    }, text);
  },
);

/** Where the caret ENDED UP, which is the whole promise of both compound keys:
 *  a split leaves it at the head of the half that came off, a merge at the seam
 *  the two were joined at. A person whose caret jumped to the end of the line
 *  has lost their place, and nothing else on screen would say so. */
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

/** Where a line's text starts, on screen. What "the same depth" means to a
 *  person reading the outline: two lines whose text begins at the same x. */
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
    // The SOURCE, not the rendering: a note is markdown, and what an editor
    // holds is what the record holds.
    const editor = this.within(id, DESC_EDITOR);
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = await editor.inputValue();
    assert.ok(
      text.includes("**walnut**"),
      `the note editor holds ${JSON.stringify(text)}, which is not the markdown the file holds`,
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

/** What the line under the editor says. A refusal and a nudge are the same
 *  assertion about two moods, and so is the line an undo draws over the page —
 *  which is why the ritual itself lives in `support/said.ts` and this file
 *  holds the two steps that name the two locators. */
Then("the refusal says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, EDIT_REFUSAL, said, "refusal");
});

Then("the nudge says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, EDIT_NUDGE, said, "nudge");
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

/** WHERE the row a split made is drawn — asked of the page in document order,
 *  because the node it names has an id nobody chose and a title assertion
 *  cannot say which line it is on. The half that came off has to be the very
 *  next line, or the split has put it somewhere a reader would have to go
 *  looking for it. */
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

/** The same, plus WHERE — the half presence cannot answer, asked by TITLE
 *  because a row a keystroke created carries an id nobody chose. A restore
 *  that put every id back at the top level would satisfy the step above and
 *  fail this one. */
Then(
  "{string} holds a node titled {string} under {string}",
  async function (this: OlaiWorld, file: string, title: string, parent: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).some(
          (node) => node["title"] === title && node["parent"] === parent,
        ),
      `${file} to hold ${JSON.stringify(title)} under ${JSON.stringify(parent)}`,
    );
  },
);

/** Nothing was written, and it STAYS unwritten for a while — read once, this
 *  would pass against a client that wrote a moment later, which is exactly the
 *  thing "a draft is not a write" claims did not happen. The window is a
 *  fraction of the idle commit's, because idling is one of the three moments
 *  that DOES write (see the step below it). */
const HELD = Math.floor(IDLE_COMMIT / 3);

/** The mark is a WORD in the step rather than three steps, because the format
 *  has three of them and a menu that can write all three should be asked about
 *  all three the same way. The field IS the mark's name on disk, which is why
 *  no table translates it. */
Then(
  "{string} holds a node marked {word} titled {string}",
  async function (this: OlaiWorld, file: string, mark: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).some(
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
        this.servedNodes(file).some((node) =>
          String(node["desc"] ?? "").trimEnd().endsWith(ending)
        ),
      `${file} to hold a node whose note ends ${JSON.stringify(ending)}`,
    );
  },
);

/**
 * The records of a file that may not exist yet.
 *
 * `Archive.jsonl` is written by the write that archives the first thing, so a
 * scenario polling for a node to arrive in it is polling for the FILE too. A
 * missing file is "nothing there yet" for exactly that reason, and it is safe
 * to read it that way here: every step below waits, so a file that never
 * arrives fails as the assertion that was actually being made rather than as
 * an ENOENT from a helper.
 */
const recordsIn = (
  world: OlaiWorld,
  file: string,
): ReadonlyArray<Record<string, unknown>> => {
  try {
    return world.servedNodes(file);
  } catch {
    return [];
  }
};

/** BY ID, which is the half a title cannot answer. Archiving keeps a node's
 *  id — that is what makes it a trash rather than a shredder, since a mirror
 *  or an `after` naming it goes on resolving — and a placement has no title to
 *  be found by at all. */
Then(
  "{string} holds the node {string}",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () => recordsIn(this, file).some((node) => node["id"] === id),
      `${file} to hold the node ${JSON.stringify(id)}`,
    );
  },
);

Then(
  "{string} no longer holds the node {string}",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () => !recordsIn(this, file).some((node) => node["id"] === id),
      `${file} to have let go of the node ${JSON.stringify(id)}`,
    );
  },
);

/**
 * The `date` field, as the EXACT string on disk — the pair to the step below,
 * and beside it for that reason.
 *
 * Exact is the whole assertion: what a picked day claims is that it reaches
 * the record as the ten characters that were picked, so a client that put the
 * value through an instant on the way would write `2026-09-01T00:00:00.000Z`,
 * which every date-SHAPED assertion but this one would happily pass.
 */
Then(
  "{string} holds the node {string} dated {string}",
  async function (this: OlaiWorld, file: string, id: string, date: string) {
    await this.waitUntil(
      async () =>
        recordsIn(this, file).some(
          (node) => node["id"] === id && node["date"] === date,
        ),
      `${file} to hold ${JSON.stringify(id)} with \`date\` exactly ${JSON.stringify(date)}`,
    );
  },
);

Then(
  "{string} holds the node {string} with no date",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () =>
        recordsIn(this, file).some(
          (node) => node["id"] === id && node["date"] === undefined,
        ),
      `${file} to hold ${JSON.stringify(id)} with no \`date\` field`,
    );
  },
);

/**
 * A record carrying NONE of the three marks — which is what "unmarked" is on
 * disk, and the answer the format draws as no box at all.
 *
 * Asked of the record rather than of the page, because the page can only say
 * that no box is drawn and the claim being made is stronger: the field is gone.
 * Over `MARKS` rather than three named fields, so a fourth mark could not
 * arrive and leave this quietly passing.
 */
Then(
  "{string} holds the node {string} with no mark",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () =>
        recordsIn(this, file).some(
          (node) =>
            node["id"] === id && MARKS.every((mark) => node[mark] === undefined),
        ),
      `${file} to hold ${JSON.stringify(id)} carrying none of ${MARKS.join(", ")}`,
    );
  },
);

/** A node with no `desc` KEY at all — which is what an emptied note is on
 *  disk, and a different fact from one holding an empty string. The format
 *  spells absent by omitting the field, so this asks the records. */
Then(
  "{string} holds a node with no note titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).some(
          (node) => node["title"] === title && node["desc"] === undefined,
        ),
      `${file} to hold a node titled ${JSON.stringify(title)} carrying no note`,
    );
  },
);

/**
 * A record carrying NOTHING but its placement and its title — which is what a
 * node a split brought into being is, and the one assertion that says so about
 * every field at once.
 *
 * Over the KEYS rather than over a list of fields nobody may have thought of:
 * a tail that inherited the head's mark, date, note, `doc` or edges fails here
 * whichever of them it was, and so would a field this format grows later.
 */
Then(
  "{string} holds a bare node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).some(
          (node) =>
            node["title"] === title &&
            Object.keys(node).every((field) =>
              ["id", "parent", "ord", "title"].includes(field)
            ),
        ),
      `${file} to hold ${JSON.stringify(title)} carrying nothing but its placement`,
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
