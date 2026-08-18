/**
 * Live preview: what the caret SEES, what the file KEEPS, and the two things
 * that ride on the same editor — autosave and vim.
 *
 * The whole subject here is the difference between those first two, so every
 * step is careful about which one it is asking. What the editor DRAWS is read
 * off the page (`world.editorDraws`), because the markers being hidden is a
 * fact about pixels; what the file HOLDS is asked of the disk, because "the
 * bytes did not move" is a claim no page can make about itself.
 *
 * IT IS ALL ABOUT DOCUMENTS. A `.md` page is this editor and nothing else
 * (`client/document/DocEditor.tsx`); a note is the textarea it has always
 * been, and making it this editor too is its own item. So the steps say "the
 * document" — the surface they drive is a page, and a step that said "the
 * note" would be a promise this PR did not make.
 *
 * `AUTOSAVE_IDLE` is imported from the client rather than spelled here — one
 * number, so a pause tuned in one place cannot leave this suite waiting the
 * wrong amount of time in the other.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { chunkOf } from "../support/chunks.ts";
import {
  DOCUMENT_EDITOR,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
  PREVIEWING,
  TAG,
  WRITING,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** What the document's live-previewed surface is DRAWING — the two halves this
 *  file asks about together, and both are the world's (`support/world.ts`:
 *  `previewing` waits for the face, `editorDraws` reads it). */
const drawn = async (world: OlaiWorld): Promise<string> =>
  await world.editorDraws(await world.previewing());

// ── what the caret shows and hides ─────────────────────────────────────

Then(
  "the document being typed shows the markers around {string}",
  async function (this: OlaiWorld, word: string) {
    const text = await drawn(this);
    assert.ok(
      text.includes(`**${word}**`),
      `the editor draws ${JSON.stringify(oneLine(text))} — the caret is in ` +
        `${JSON.stringify(word)} and its markers are still hidden, so there ` +
        "is nothing there to edit",
    );
  },
);

Then(
  "the document hides the markers around {string}",
  async function (this: OlaiWorld, word: string) {
    const text = await drawn(this);
    assert.ok(
      text.includes(word),
      `the editor draws ${JSON.stringify(oneLine(text))}, which does not ` +
        `hold ${JSON.stringify(word)} at all`,
    );
    assert.ok(
      !text.includes(`*${word}*`),
      `the editor draws ${JSON.stringify(oneLine(text))} — the markers are ` +
        "on screen with the caret nowhere near them",
    );
  },
);

When(
  "I put the caret in the document's word {string}",
  async function (this: OlaiWorld, word: string) {
    const editor = await this.previewing();
    const at = editor.getByText(word, { exact: true }).first();
    await at.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await at.click();
    await this.waitForFrame();
  },
);

Then(
  "the document styles the tag {string}",
  async function (this: OlaiWorld, tag: string) {
    // The SAME assertion a row's title takes (`outline_tree_steps.ts`), over
    // the same test id: the pill in the editor and the pill on the row are one
    // decision, delegated to one walk of the format (`client/mde/tags.ts`).
    const tags = (await this.previewing()).locator(TAG);
    await tags
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    const found = (await tags.allInnerTexts()).map((value) =>
      value.replace(/^[#@]/, "").trim(),
    );
    assert.ok(
      found.includes(tag),
      `the document styles ${JSON.stringify(found)}, expected a tag ` + JSON.stringify(tag),
    );
  },
);

Then(
  "the document being typed ends with {string}",
  async function (this: OlaiWorld, ending: string) {
    const text = await drawn(this);
    assert.ok(
      text.trimEnd().endsWith(ending),
      `the editor draws ${JSON.stringify(oneLine(text))}, which does not end ` +
        `${JSON.stringify(ending)} — a refused write must keep the draft`,
    );
  },
);

/**
 * To the END of the document, in the surface the caret is already in.
 *
 * It has to be said out loud: clicking a document puts the caret WHERE THE
 * CLICK LANDED (`client/mde/Mde.tsx`), which is the point of the reading
 * surface being the editor — so a scenario that means "type at the end" has to
 * go there rather than assume it.
 */
When("I put the caret at the end of the document", async function (this: OlaiWorld) {
  // Into the surface first: a page opens READING, so there is no caret to move
  // until somebody has clicked in. The click lands wherever it lands and this
  // step then says where it meant.
  await this.press(await this.previewing());
  await this.page.keyboard.press("ControlOrMeta+End");
  await this.waitForFrame();
});

/**
 * The caret at the end of one LINE, named by words on it.
 *
 * The end of the document is `Control+End`; this is the other place a scenario
 * about Enter has to be able to stand — at the end of a LIST ITEM, which is
 * where the markup commands this editor refuses would have continued the list.
 */
When(
  "I put the caret at the end of the document's line {string}",
  async function (this: OlaiWorld, words: string) {
    const editor = await this.previewing();
    const line = editor.locator(".cm-line").filter({ hasText: words }).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await line.boundingBox();
    assert.ok(box !== null, `the line holding ${JSON.stringify(words)} is not laid out`);
    // Past the last character rather than at a measured offset: a click beyond
    // the text of a line lands at its end, which is what "the end of this line"
    // means to a person.
    await this.page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
    await this.waitForFrame();
  },
);

// ── autosave, which is a pause rather than a verb ──────────────────────

/** There is nothing to press: what a scenario waits for is the file, and the
 *  step after this one asks the disk. Same wait as the document feature's own
 *  phrasing, because it is the same clock (`support/world.ts`). */
When("I wait for the autosave", async function (this: OlaiWorld) {
  await this.settleAutosave();
});

// ── vim, which owns one key ────────────────────────────────────────────

/**
 * Escape, pressed with no expectation of what it does.
 *
 * The ordinary `I press "Escape"` waits for a draft to CLOSE
 * (`support/caret.ts`), which is the right wait for every editor this app had
 * before vim and the wrong one for the case this exists for: inside a vim
 * editor Escape is the mode switch, and the whole assertion is that the caret
 * is still there afterwards.
 */
When("I press Escape where I am", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Escape");
  await this.waitForFrame();
});

// ── the editor as a chunk ──────────────────────────────────────────────

/**
 * CodeMirror, its markdown grammar, the live-preview plugins and vim — split
 * out by the `import()` in `client/mde/chunk.ts`, so the URL is derived from
 * that module's name exactly as the other two chunks' are
 * (`support/chunks.ts`).
 */
const EDITOR = chunkOf("the markdown editor", "codemirror");

Given("the markdown editor never arrives", async function (this: OlaiWorld) {
  await EDITOR.neverArrives(this);
});

Then("nothing has asked for the markdown editor", function (this: OlaiWorld) {
  const requested = EDITOR.asked(this);
  assert.deepStrictEqual(
    [...requested],
    [],
    `this page fetched the markdown editor it should not need:\n  ${requested.join("\n  ")}`,
  );
});

// ── one surface, two modes ─────────────────────────────────────────────

/**
 * The document's surface, whichever mode it is in — and the assertion that it
 * IS the live-preview one rather than the page's rendering.
 *
 * A document page is the editor, mounted readonly (`client/mde/`); the
 * rendering is what it falls back to while that chunk is in the air. Both
 * carry `document-body`, so what tells them apart is the face.
 */
Then("the document is the live-preview surface", async function (this: OlaiWorld) {
  const body = this.page.locator(`${DOCUMENT_EDITOR}${PREVIEWING}`).first();
  await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // ...and WHERE it is, for whatever asks next whether it moved. Taken here
  // because this is the step that establishes the reading surface, which is
  // the "before" any no-jump claim is about.
  box = await body.boundingBox();
});

/**
 * WHERE THE SURFACE IS, remembered — and then asserted to be the same place.
 *
 * "No visual jump" is a number or it is a slogan: this takes the surface's box
 * before the click that puts a caret in it and after, and insists on zero. It
 * is the one promise the two-DOM shape could not make, because a rendering and
 * an editor are never laid out identically.
 */
let box: { x: number; y: number; width: number; height: number } | null = null;

When("I click the document's word {string}", async function (this: OlaiWorld, word: string) {
  const body = this.page.locator(`${DOCUMENT_EDITOR}${PREVIEWING}`).first();
  await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  box = await body.boundingBox();
  // THE WORD'S OWN BOX, found by RANGE rather than by element, because in this
  // surface a word usually is not one: the editor is a string with decorations
  // over it, so "gloss" in the middle of a line is a run of a text node and
  // `getByText` has nothing to hand back. A range around the word has a
  // rectangle, and that rectangle is what a pointer aimed at the word means.
  const at = await body.evaluate((root, needle) => {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
      const index = (node.textContent ?? "").indexOf(needle as string);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + (needle as string).length);
      const rect = range.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
    return null;
  }, word);
  assert.ok(at !== null, `the document draws no word ${JSON.stringify(word)}`);
  await this.page.mouse.click(at.x, at.y);
  await this.waitForFrame();
});

Then("the document did not move when the caret arrived", async function (this: OlaiWorld) {
  assert.ok(box !== null, "nothing measured the document before the click");
  const now = await this.page.locator(DOCUMENT_EDITOR).first().boundingBox();
  assert.ok(now !== null, "the document is not laid out");
  const moved = { x: now.x - box.x, y: now.y - box.y, w: now.width - box.width };
  assert.deepStrictEqual(
    moved,
    { x: 0, y: 0, w: 0 },
    `the document moved by ${JSON.stringify(moved)} when the caret arrived — ` +
      "the surface was replaced rather than switched",
  );
});

Then("the document is not being typed", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(`${DOCUMENT_EDITOR}${WRITING}`).count(),
    0,
    "the document says it is being typed, with no caret in it",
  );
});
