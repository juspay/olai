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
 *
 * And every key here waits for the CLIENT'S own answer to it before the next
 * gesture is aimed at the page — one wait, whichever key it was, off the count
 * the app shell publishes. What it promises and what it deliberately does not
 * is `support/settling.ts`.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { MARKS } from "@olai/format";

import { shiftDay } from "@olai/format";
import { IDLE_COMMIT, isoDayOf, TESTID } from "@olai/web/testlib";

import type { Locator } from "playwright";

import { leavingTheLine, nothingIsBeingTyped } from "../support/caret.ts";
import { pressed, typed } from "../support/settling.ts";
import { retypedAndTaken } from "../support/atonce.ts";
import { announcedAs, saysNothing, saysThat } from "../support/said.ts";
import {
  DESC_EDITOR,
  EDIT_NUDGE,
  EDIT_REFUSAL,
  expectBefore,
  NEW_ROW,
  NODE,
  nodeSelector,
  POLL_TIMEOUT,
  START_LINE,
  TAG,
  TITLE_EDITOR,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── opening an editor ──────────────────────────────────────────────────

/**
 * CLICK AWAY FIRST WHEN SWITCHING ROWS. The wait below is for ANY title editor
 * (`.first()`), not for THIS row's — so with a draft already open on another
 * row it is satisfied the instant it is called, by the editor that is already
 * there. The click may then not have landed where the step says, and every key
 * the scenario presses afterwards goes to the old row.
 *
 * It fails loudly in the common case — the click is swallowed by the open
 * draft, no editor opens on the named row, and the NEXT step times out — which
 * is how the convention was found rather than reasoned out (`set_doing`
 * refuses, 2026-08-15). It would fail QUIETLY if the two rows happened to
 * accept the same keys.
 *
 * So: `I click away from the editor` (or `Escape`) between two `I click the
 * title of` steps. Scenarios that interleave ⌘Z need it anyway — undo is
 * answered from a page with no caret in a row.
 *
 * The fix that would retire the ritual is scoping this wait to the row
 * (`[data-node-id=…] [data-testid=title-editor]`), which is a change to a step
 * ~100 scenarios press and is deliberately not made here (grok, review of
 * a41e74cc: "out of scope unless you are already touching the step").
 */
When(
  "I click the title of {string}",
  async function (this: OlaiWorld, id: string) {
    // The END of the title, not Playwright's centre. A click now puts the
    // caret where it landed (`client/edit/point.ts`), so a press in the
    // middle of "choose the handles" would make the next Enter a SPLIT
    // rather than an add — and a hundred scenarios mean "open this row".
    //
    // A `#tag` at that end is a FILTER, not a caret (`Tree.tsx`'s `onATag`).
    // `kitchen remodel #home` is the one that taught this: the last pixels
    // of the title ARE the tag, and the filler past the glyphs is the end
    // of the LINE (`edit/point.ts`).
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
      await title.click({
        position: { x: Math.max(box.width - 2, 0), y: box.height / 2 },
      });
    }
    await this.waitForFrame();
    await this.page
      .locator(TITLE_EDITOR)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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
  await typed(this, text);
});

When(
  "I select all and type {string}",
  async function (this: OlaiWorld, text: string) {
    // Select-all inside the field, which is what a person retyping a title
    // does. An empty `text` is the whole point of one scenario: the field is
    // cleared and the write is refused.
    //
    // ⌘A is waited for like every other key, and it is the one that most
    // wanted it: pressed at a row the client has not taken the caret back for,
    // it selects the PAGE, and what is typed after it lands beside the title
    // rather than replacing it.
    await pressed(this, "ControlOrMeta+a");
    if (text === "") await pressed(this, "Backspace");
    else await typed(this, text);
  },
);

/** The window `../support/atonce.ts` opens, at this door — the whole title
 *  retyped rather than a character appended, because what has to move inside
 *  the settle is the trigger's own QUERY. */
When(
  "I retype the row as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await openEditor(this), text);
  },
);

// ── the keys ───────────────────────────────────────────────────────────

When("I press {string}", async function (this: OlaiWorld, key: string) {
  await pressed(this, key);
});

/** The same key, with nothing waited for afterwards — which is how a person
 *  types: faster than a round trip. What the scenario then asserts is that the
 *  writes still landed in the order the keys were pressed, which is the write
 *  queue's whole job.
 *
 *  The two steps that say `without waiting` are the two that MEAN the race,
 *  and they are the whole of the exception: everything else in this suite goes
 *  through `../support/settling.ts`. */
When(
  "I press {string} without waiting",
  async function (this: OlaiWorld, key: string) {
    await this.page.keyboard.press(key);
  },
);

/**
 * The same key TWICE, both keys out before either can be answered.
 *
 * Two of the step above is not the same thing, and that is the whole reason
 * this exists: each `press` is a round trip to the browser, and the write the
 * first key starts is a round trip to a server on this same machine — so on a
 * loaded box the answer can land in the GAP between the two presses, and the
 * scenario stops being about what it says it is about.
 *
 * `A second Enter on the first capture is not a second write` is where that
 * showed: with the first capture already landed, the palette has re-primed its
 * box to `+ ` (`palette/Palette.tsx`'s `sendCapture`), so the second Enter is a
 * capture of a BLANK line — refused in the ops layer's own words, over the
 * remark the scenario is asserting on. Measured at 2 in 15 loaded runs, and it
 * got MORE likely rather than less when this suite's port bands stopped being
 * shared (they used to be; `freePortIn` walked an exclusive band, and an
 * exclusive band is a faster spawn and so a faster round trip to beat).
 *
 * Issued together, the two keydowns reach the page with no round trip between
 * them, which is the claim `without waiting` was always making.
 */
When(
  "I press {string} twice without waiting",
  async function (this: OlaiWorld, key: string) {
    await Promise.all([
      this.page.keyboard.press(key),
      this.page.keyboard.press(key),
    ]);
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

/** A range over some text the editor holds — collapsed after it (a caret) or
 *  spanning it (a selection). One walk, because "put the caret after X" and
 *  "select X" are the same lookup with the same failure and differ only in
 *  whether the range is shut. */
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
  // Parked ghosts are drawn before the live one, so the first new-row is
  // the oldest blank — the one resume has to re-find after a commit re-aims
  // it. Pointer writes are not on the key counter; the next step waits for
  // what the click wrote.
  const row = this.page.locator(`${NEW_ROW} ${TITLE_EDITOR}`).first();
  await this.press(row);
});

When("I click the page away from the drafts", async function (this: OlaiWorld) {
  // Not `I click away from the editor`: that wait names the caret by the
  // first title-editor in the document, and parked ghosts keep one of those
  // standing, so the place never changes. Focus leaving the live input is
  // the receipt that the empty drafts were parked rather than closed.
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
  // Somewhere in the pane that is not a row: a blur, and nothing else — and
  // then the caret LEAVES, which is the same receipt the keys wait for and for
  // the same reason: a blur commits through the same queue, so a draft still
  // open on that line is this tab still waiting to hear.
  await leavingTheLine(
    this,
    async () => {
      await this.page.locator("main").click({ position: { x: 4, y: 4 } });
      await this.waitForFrame();
    },
    "the caret to leave the line the click was away from",
  );
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
  // The same question `Escape` is waited on with, asked as a promise — one
  // spelling of "a page with no caret in a row", which is the state ⌘Z is
  // answered from and the one these two would drift apart about.
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
    async () => (await this.page.locator(NEW_ROW).count()) === n,
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

/** What the line under the editor says. A refusal and a nudge are the same
 *  assertion about two moods, and so is the line an undo draws over the page —
 *  which is why the ritual itself lives in `support/said.ts` and this file
 *  holds the two steps that name the two locators. */
Then("the refusal says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, EDIT_REFUSAL, said, "refusal", "alarm");
});

Then("the nudge says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, EDIT_NUDGE, said, "nudge", "aside");
});

/** ...and HOW each of them reaches a screen reader, which is the half of the
 *  two moods that is not on screen at all. Asked apart from the sentence
 *  because it is a different kind of claim — the words are what a reader sees,
 *  and this is whether they are delivered over the top of whatever was being
 *  read. */
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
    // Sibling order as the page draws it, which is the `ord` the write
    // produced — read by position rather than by attribute, because "which is
    // above which" is what a reader is looking at.
    await expectBefore(
      this,
      this.page.locator(`${nodeSelector(first)}, ${nodeSelector(second)}`),
      "data-node-id",
      first,
      second,
    );
  },
);

/** A row a keystroke minted, by the title it was given — the id is nobody's
 *  to choose, and "comes before" is still the page's sibling order. */
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
  world.page.locator(NODE).evaluateAll(
    (all, [want, titleId]) => {
      for (const element of all) {
        const own = element.querySelector(`[data-testid="${titleId}"]`);
        if (own !== null && (own.textContent ?? "").includes(want)) {
          return element.getAttribute("data-node-id");
        }
      }
      return null;
    },
    [title, TESTID.nodeTitle] as [string, string],
  );

/** WHERE a draft opened at column 0 is drawn — above the title you were in,
 *  not after that row's whole subtree. Asked of boxes on the page: a new row
 *  is not a node (nothing has been written), so document order of `[data-node-id]`
 *  cannot see it. The caret's editor sits in the draft; that draft's top
 *  edge has to meet the title it was opened above. */
Then(
  "the row being typed is drawn immediately above the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => {
      const editor = this.page.locator(TITLE_EDITOR).first();
      if ((await editor.count()) === 0) return false;
      const draft = editor.locator(
        `xpath=ancestor::*[@data-testid='${TESTID.newRow}'][1]`,
      );
      if ((await draft.count()) === 0) return false;
      const above = await draft.boundingBox();
      const of = await title.boundingBox();
      if (above === null || of === null) return false;
      // Adjacent and above: one row's padding, not a layout assertion. The
      // teleport this exists to catch is a large negative gap — the draft
      // sits below the whole subtree.
      const gap = of.y - (above.y + above.height);
      return gap >= -2 && gap < 40;
    }, `the draft to sit immediately above the title of "${id}", not below its subtree`);
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
 *  is that a keystroke reached a file through the ops layer.
 *
 *  Through `servedNodesSoFar`, which is where the reason lives: `_olai/Trash.olai`
 *  is written by the write that archives the first thing, so a step polling for
 *  a node to ARRIVE in it is polling for the file too — and a reader that threw
 *  ENOENT turned that wait into an error on the first attempt. It tolerates a
 *  missing file and NOTHING ELSE, which is the half that matters: a blanket
 *  catch would read a malformed outline as an empty one and pass a step that
 *  should have failed loudly. */
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

/**
 * HOW MANY of them — the half presence cannot answer either, and the half a
 * race is about.
 *
 * It waits for the count and then HOLDS it, because the failure this exists
 * for arrives late: a second write in flight behind the first lands a moment
 * after the first one has, so a count read once would see the right number on
 * its way to the wrong one. The window is the same fraction of the idle commit
 * the "nothing was written" step uses, for the same reason.
 */
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

/** The same, plus WHERE — the half presence cannot answer, asked by TITLE
 *  because a row a keystroke created carries an id nobody chose. A restore
 *  that put every id back at the top level would satisfy the step above and
 *  fail this one. */
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

/** Nothing was written, and it STAYS unwritten for a while — read once, this
 *  would pass against a client that wrote a moment later, which is exactly the
 *  thing "a draft is not a write" claims did not happen. The window is a
 *  fraction of the idle commit's, because idling is one of the three moments
 *  that DOES write (see the step below it). */
const HELD = Math.floor(IDLE_COMMIT / 3);

/** The mark is a WORD in the step rather than one step per mark, because the
 *  format has four of them and a menu that can write all four should be asked
 *  about all four the same way. The field IS the mark's name on disk, which is
 *  why no table translates it — and why `cancelled` needed nothing here. */
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

/** BY ID, which is the half a title cannot answer. Archiving keeps a node's
 *  id — that is what makes it a trash rather than a shredder, since a mirror
 *  or an `after` naming it goes on resolving — and a placement has no title to
 *  be found by at all. */
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

/**
 * A PLACEMENT the file holds, named by what it shows and where it sits.
 *
 * Not by its own id, which is the whole point: `add_mirror` mints one, this
 * surface names no ids (`@olai/surface`'s edit.ts), and a scenario that asked
 * for a chosen id would be asking for a thing the `((` widget cannot send. So
 * the assertion is the record's SHAPE — a `mirror` of that target, under that
 * parent — which is also exactly what the format says a placement is.
 */
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
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["date"] === date,
        ),
      `${file} to hold ${JSON.stringify(id)} with \`date\` exactly ${JSON.stringify(date)}`,
    );
  },
);

/** The same field, on a node named by its TITLE — which is the only way to
 *  name a row a keystroke has just minted, since the id is the set's. */
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

/**
 * The same field, against a day only the CLOCK can name — the `!` widget's
 * natural-language half, end to end.
 *
 * `tomorrow` cannot be written into a feature file, so the suite works it out
 * the way the client does: today from `@olai/web`'s own clock, one day on with
 * `@olai/web`'s own day arithmetic. Two spellings of "the day after today"
 * would be a scenario that passes on 364 days of the year — which is exactly
 * the class of bug this arithmetic exists to make impossible.
 */
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

/**
 * A record carrying NONE of the marks — which is what "unmarked" is on disk,
 * and the answer the format draws as no box at all.
 *
 * Asked of the record rather than of the page, because the page can only say
 * that no box is drawn and the claim being made is stronger: the field is gone.
 * Over `MARKS` rather than named fields, so a fourth mark could not arrive and
 * leave this quietly passing — and one did, and it did not.
 */
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

/** A node with no `desc` KEY at all — which is what an emptied note is on
 *  disk, and a different fact from one holding an empty string. The format
 *  spells absent by omitting the field, so this asks the records. */
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

/**
 * A record carrying NOTHING but its placement and its title — which is what a
 * node a split brought into being is, and the one assertion that says so about
 * every field at once.
 *
 * Over the KEYS rather than over a list of fields nobody may have thought of:
 * a tail that inherited the head's mark, date, note, `doc` or edges fails here
 * whichever of them it was, and so would a field this format grows later.
 *
 * `created` is in the allowed set and is the one addition since: it is not
 * something the tail INHERITED, it is the stamp that says the node came into
 * being just now, which is exactly what a split's tail is. A `changed` here
 * would be the failure this step is written to catch — nothing has been written
 * to it since it was made.
 */
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

/**
 * The row has GONE — WAITED for, which is the opposite of the step below it.
 *
 * The two read almost the same and mean opposite things, and confusing them is
 * a flaky test rather than a wrong one: "nothing should have been written" has
 * to HOLD across the commit window, and "the write took it away" has to WAIT
 * for a round trip. `undo.feature` asked the holding form of ⌘Z — which passes
 * only when the archive happens to land inside one animation frame, and fails
 * whenever the machine is busy.
 *
 * BY TITLE, where the pair further up is by id: a row a keystroke created
 * carries an id nobody chose, so its title is the only thing a scenario can
 * name it by.
 */
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
