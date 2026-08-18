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

import { AUTOSAVE_IDLE } from "@olai/web/src/client/edit/autosave.ts";

import { chunkOf } from "../support/chunks.ts";
import {
  DESC_EDITOR,
  EDIT_REFUSAL,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
  PREVIEWING,
  TAG,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/**
 * The editor, once it is live-previewed — the PAGE's, since there is exactly
 * one draft in a tab because there is exactly one caret.
 *
 * Waiting on the FACE rather than on a timeout: until the chunk lands, a caret
 * lands in the textarea this app shipped before live preview, where every
 * marker is visible — a correct editor and the wrong subject.
 */
const previewing = (world: OlaiWorld) =>
  world.page.locator(`${DESC_EDITOR}${PREVIEWING}`).first();

const drawn = async (world: OlaiWorld): Promise<string> => {
  const editor = previewing(world);
  await editor.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return await world.editorDraws(editor);
};

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
    const editor = previewing(this);
    await editor.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
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
    const tags = previewing(this).locator(TAG);
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

// ── autosave, which is a pause rather than a verb ──────────────────────

/** The idle the write is keyed on, plus the round trip it starts. There is
 *  nothing to press: what a scenario waits for is the file, and the step after
 *  this one asks the disk. Three times the pause, because what is being waited
 *  out is a debounce and a server, not a debounce. */
When("I wait for the autosave", async function (this: OlaiWorld) {
  await this.page.waitForTimeout(AUTOSAVE_IDLE * 3);
  await this.waitForFrame();
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
 *  `Said`). Spelled here rather than reached for from `editing_steps.ts`
 *  because the scenario reads better as a sentence about the WRITE. */
Then(
  "the autosave is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    const refusal = this.page.locator(EDIT_REFUSAL).first();
    await refusal.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await refusal.getAttribute("data-tone"), "alarm");
    const text = oneLine(await refusal.innerText());
    assert.ok(
      text.includes(said),
      `the refusal reads ${JSON.stringify(text)}, which does not say ` +
        `${JSON.stringify(said)} — the ops layer's own words are the answer`,
    );
  },
);
