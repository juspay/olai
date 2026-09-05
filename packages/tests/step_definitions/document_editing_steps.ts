/**
 * Editing documents: the editor a document page becomes, the two creation
 * doors, and the conflict a save meets when the file moved underneath it.
 *
 * Everything here drives the UI — the Edit control, the textarea, Save — and
 * asserts what came BACK on the wire: a rendered body that changed, a second
 * tab that followed, a refusal drawn in the ops layer's own words. Nothing
 * reads the disk directly, because nothing in the client does either.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { isoDayOf } from "@olai/web/testlib";
import type { Page } from "playwright";

import { saysThat } from "../support/said.ts";
import {
  DAY_MINT,
  DAY_MINT_SAID,
  DAY_PAGE,
  DOCUMENT_BODY,
  DOCUMENT_CANCEL,
  DOCUMENT_DRIFTED,
  DOCUMENT_EDIT,
  DOCUMENT_EDITOR,
  DOCUMENT_OVERWRITE,
  DOCUMENT_PAGE,
  DOCUMENT_SAID,
  DOCUMENT_SAVE,
  expectAbsent,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the editor ─────────────────────────────────────────────────────────

When("I start editing the document", async function (this: OlaiWorld) {
  const edit = this.page.locator(DOCUMENT_EDIT);
  // The hydration wait is its own: the control appears when the page has a
  // body to edit. `press` is the click and the frame after it.
  await edit.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(edit);
  await this.page
    .locator(DOCUMENT_EDITOR)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the document editor holds text containing {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.page.locator(DOCUMENT_EDITOR);
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const held = await editor.inputValue();
    assert.ok(
      held.includes(text),
      `the editor holds ${JSON.stringify(oneLine(held))}, which does not ` +
        `contain ${JSON.stringify(text)}`,
    );
  },
);

Then(
  "the document editor holds no text containing {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.page.locator(DOCUMENT_EDITOR);
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const held = await editor.inputValue();
    assert.ok(
      !held.includes(text),
      `the editor holds ${JSON.stringify(oneLine(held))}, which carries ` +
        `${JSON.stringify(text)} — a draft has followed its typist onto ` +
        "another file",
    );
  },
);

When("I retype the document as:", async function (this: OlaiWorld, source: string) {
  const editor = this.page.locator(DOCUMENT_EDITOR);
  await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await editor.fill(source);
});

When("I save the document", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DOCUMENT_SAVE));
});

When("I cancel the document editor", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DOCUMENT_CANCEL));
});

When("I overwrite the document anyway", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DOCUMENT_OVERWRITE));
});

Then("the document editor is open", async function (this: OlaiWorld) {
  await this.page
    .locator(DOCUMENT_EDITOR)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the document editor is gone", async function (this: OlaiWorld) {
  await this.page
    .locator(DOCUMENT_EDITOR)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

// ── the conflict story ─────────────────────────────────────────────────

Then("the editor notices the file changed on disk", async function (this: OlaiWorld) {
  await this.page
    .locator(DOCUMENT_DRIFTED)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the save is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    const refusal = this.page.locator(DOCUMENT_SAID);
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

// ── a second tab is just another reader ────────────────────────────────

/** The other tab of this scenario. Module state, reset by the Given that opens
 *  one: only the scenario that opened it reads it, and the browser context it
 *  belongs to is torn down with the scenario either way. */
let other: Page | undefined;

When("I switch to the other document tab", async function (this: OlaiWorld) {
  assert.ok(other !== undefined, "no second tab was opened");
  [this.page, other] = [other, this.page];
});

When("I draft {string} in document pane {int}", async function (this: OlaiWorld, text: string, index: number) {
  const pane = this.pane(index);
  await this.press(pane.locator(DOCUMENT_EDIT));
  await pane.locator(DOCUMENT_EDITOR).fill(text);
});

Then("document pane {int} holds draft {string}", async function (this: OlaiWorld, index: number, text: string) {
  const editor = this.pane(index).locator(DOCUMENT_EDITOR);
  await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await editor.inputValue(), text);
});

When("I save document pane {int}", async function (this: OlaiWorld, index: number) {
  await this.press(this.pane(index).locator(DOCUMENT_SAVE));
});

Then("document pane {int} has no editor", async function (this: OlaiWorld, index: number) {
  await this.pane(index).locator(DOCUMENT_EDITOR)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Given(
  "a second tab opens the document {string}",
  async function (this: OlaiWorld, file: string) {
    other = await this.context.newPage();
    await other.goto(`${this.baseUrl}/${file}`);
    await other
      .locator(DOCUMENT_EDITOR)
      .waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the second tab renders bold text {string}",
  async function (this: OlaiWorld, text: string) {
    assert.ok(other !== undefined, "no second tab was opened");
    await this.rendersBold(other.locator(DOCUMENT_BODY).first(), text);
  },
);

// ── the two creation doors ─────────────────────────────────────────────
//
// The sidebar half of them is `./new_file_steps.ts`, shared with the outline's
// own door: one control (`file/NewFile.tsx`) drawn twice, so one pair of steps
// over the kind. What stays here is the door that is only a DOCUMENT's — the
// day page's + day note, which mints that day's note. The calendar cell never
// writes: clicking a day navigates, and this button is the mint.

When("I press + day note", async function (this: OlaiWorld) {
  const mint = this.page.locator(DAY_MINT);
  await mint.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(mint);
});

Then("the + day note button is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(DAY_MINT)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the + day note button is waiting for its write", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(DAY_MINT).isDisabled(), true);
});

Then("the + day note button is ready", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(DAY_MINT).isEnabled(), true);
});

Then("the + day note button is gone", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    DAY_PAGE,
    DAY_MINT,
    "a day that already has a note is still offering to mint one",
  );
});

Then(
  "the day-note mint is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(
      this,
      DAY_MINT_SAID,
      said,
      "refusal beside + day note",
      "alarm",
    );
  },
);

/** Where the vault's own convention puts today's note: the newest existing
 *  daily note's directory with its date segments re-spelled, which for this
 *  fixture is `<root>/<yyyy>/<mm>/`. Computed rather than written out, since
 *  what day it is is not a thing a feature file can spell. */
Then(
  "the document open is today's note under {string}",
  async function (this: OlaiWorld, root: string) {
    const today = isoDayOf(new Date());
    const wanted = `${root}/${today.slice(0, 4)}/${today.slice(5, 7)}/${today}.md`;
    await this.expectAttribute(
      DOCUMENT_PAGE,
      "data-file",
      wanted,
      "the document page",
      HYDRATION_TIMEOUT,
    );
  },
);
