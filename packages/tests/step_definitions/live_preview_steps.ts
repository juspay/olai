/**
 * Live preview: what the caret SEES, what the file KEEPS, and the two things
 * that ride on the same editor — autosave and vim.
 *
 * The whole subject here is the difference between those first two, so every
 * step is careful about which one it is asking. What the editor DRAWS is read
 * off the page (`world.editorDraws`), because the markers being hidden is a
 * fact about pixels; what the file HOLDS is asked of the disk by the steps that
 * already exist for it (`editing_steps.ts`), because "the bytes did not move"
 * is a claim no page can make about itself.
 *
 * `AUTOSAVE_IDLE` is imported from the client rather than spelled here — one
 * number, so a pause tuned in one place cannot leave this suite waiting the
 * wrong amount of time in the other.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { chunkOf } from "../support/chunks.ts";
import { saysThat } from "../support/said.ts";
import {
  DESC_EDITOR,
  EDIT_REFUSAL,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
  PREVIEWING,
  TAG,
  WRITING,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** What the note's live-previewed editor is DRAWING — the two halves this
 *  file asks about together, and both are the world's (`support/world.ts`:
 *  `previewing` waits for the face, `editorDraws` reads it). */
const drawn = async (world: OlaiWorld): Promise<string> =>
  await world.editorDraws(await world.previewing());

// ── what the caret shows and hides ─────────────────────────────────────

Then(
  "the note being typed shows the markers around {string}",
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
  "the note being typed hides the markers around {string}",
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
  "I put the caret in the note's word {string}",
  async function (this: OlaiWorld, word: string) {
    const editor = await this.previewing();
    const at = editor.getByText(word, { exact: true }).first();
    await at.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await at.click();
    await this.waitForFrame();
  },
);

Then(
  "the note being typed styles the tag {string}",
  async function (this: OlaiWorld, tag: string) {
    // The SAME assertion the row's own title takes (`outline_tree_steps.ts`),
    // over the same test id: the pill in the editor and the pill on the row
    // are one decision, delegated to one walk of the format
    // (`client/mde/tags.ts`).
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
      `the note being typed styles ${JSON.stringify(found)}, expected a tag ` +
        JSON.stringify(tag),
    );
  },
);

Then(
  "the note being typed ends with {string}",
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
 * To the END of the note, in the surface the caret is already in.
 *
 * It has to be said out loud now: clicking a note puts the caret WHERE THE
 * CLICK LANDED (`client/mde/Mde.tsx`), which is the point of the reading
 * surface being the editor — so a scenario that means "type at the end" has to
 * go there rather than assume it.
 */
When("I put the caret at the end of the note", async function (this: OlaiWorld) {
  await this.previewing();
  await this.page.keyboard.press("ControlOrMeta+End");
  await this.waitForFrame();
});

// ── autosave, which is a pause rather than a verb ──────────────────────

/** There is nothing to press: what a scenario waits for is the file, and the
 *  step after this one asks the disk (`support/world.ts` holds the wait, since
 *  the document's phrasing waits the same amount). */
When("I wait for the autosave", async function (this: OlaiWorld) {
  await this.settleAutosave();
});

// ── vim, which owns one key ────────────────────────────────────────────

/**
 * Escape, pressed with no expectation of what it does.
 *
 * The ordinary `I press "Escape"` waits for the draft to CLOSE
 * (`support/caret.ts`), which is the right wait for every editor this app had
 * before vim and the wrong one for the case this exists for: inside a vim
 * editor Escape is the mode switch, and the whole assertion is that the editor
 * is still there afterwards.
 */
When("I press Escape in the note", async function (this: OlaiWorld) {
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

/** What the refusal under the row says — the note editor's own line, which is
 *  where an autosave that was refused surfaces (`client/edit/RowEditor.tsx`'s
 *  `Said`). The PHRASE is its own because the scenario reads as a sentence
 *  about the write; the assertion is `support/said.ts`'s, like every other
 *  question about what a surface said. */
Then(
  "the autosave is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, EDIT_REFUSAL, said, "autosave refusal", "alarm");
  },
);

// ── one surface, two modes ─────────────────────────────────────────────

/**
 * The note's surface, whichever mode it is in — and the assertion that it IS
 * the live-preview one rather than the page's rendering.
 *
 * A note the reader opened is the editor, mounted readonly (`client/mde/`);
 * everywhere a caret cannot go it is `markdown/render.ts`'s output. Both carry
 * `desc`, so what tells them apart is the face.
 */
Then(
  "the note of {string} is the live-preview surface",
  async function (this: OlaiWorld, id: string) {
    const note = this.within(id, `${DESC_EDITOR}${PREVIEWING}`);
    await note.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // ...and WHERE it is, for whatever asks next whether it moved. Taken here
    // because this is the step that establishes the reading surface, which is
    // the "before" any no-jump claim is about.
    box = await note.boundingBox();
  },
);

Then(
  "the note of {string} is not being typed",
  async function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      await this.node(id).locator(`${DESC_EDITOR}${WRITING}`).count(),
      0,
      `the note on "${id}" says it is being typed, with no caret in it`,
    );
  },
);

/**
 * WHERE THE SURFACE IS, remembered — and then asserted to be the same place.
 *
 * "No visual jump" is a number or it is a slogan: this takes the note's box
 * before the click that puts a caret in it and after, and insists on zero. It
 * is the one promise the two-DOM shape could not make, because a rendering and
 * an editor are never laid out identically.
 */
let box: { x: number; y: number; width: number; height: number } | null = null;

When("I click the note's word {string}", async function (this: OlaiWorld, word: string) {
  const note = this.page.locator(`${DESC_EDITOR}${PREVIEWING}`).first();
  await note.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  box = await note.boundingBox();
  // The word's own box, so the click lands IN it — which is the whole subject:
  // a pointer aimed at a word, and a caret that arrives there.
  await note.getByText(word, { exact: true }).first().click();
  await this.waitForFrame();
});

Then(
  "the note of {string} did not move when the caret arrived",
  async function (this: OlaiWorld, id: string) {
    assert.ok(box !== null, "nothing measured the note before the click");
    const now = await this.within(id, DESC_EDITOR).boundingBox();
    assert.ok(now !== null, "the note is not laid out");
    const moved = { x: now.x - box.x, y: now.y - box.y, w: now.width - box.width };
    assert.deepStrictEqual(
      moved,
      { x: 0, y: 0, w: 0 },
      `the note moved by ${JSON.stringify(moved)} when the caret arrived — the ` +
        "surface was replaced rather than switched",
    );
  },
);
