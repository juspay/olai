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
import { isoDayOf } from "@olai/web/src/client/clock.ts";
import type { Page } from "playwright";

import {
  CALENDAR_MINT,
  DOCUMENT_BODY,
  DOCUMENT_CANCEL,
  DOCUMENT_DRIFTED,
  DOCUMENT_EDIT,
  DOCUMENT_EDITOR,
  DOCUMENT_OVERWRITE,
  DOCUMENT_PAGE,
  DOCUMENT_SAID,
  DOCUMENT_SAVE,
  HYDRATION_TIMEOUT,
  NEW_DOCUMENT,
  NEW_DOCUMENT_PATH,
  NEW_DOCUMENT_SAID,
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

Given(
  "a second tab opens the document {string}",
  async function (this: OlaiWorld, file: string) {
    other = await this.context.newPage();
    await other.goto(`${this.baseUrl}/doc/${file}`);
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

When(
  "I create the document {string} from the sidebar",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    const open = this.page.locator(NEW_DOCUMENT);
    await open.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await open.click();
    const box = this.page.locator(NEW_DOCUMENT_PATH);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await box.fill(file);
    await box.press("Enter");
  },
);

Then(
  "the creation is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    const refusal = this.page.locator(NEW_DOCUMENT_SAID);
    await refusal.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = oneLine(await refusal.innerText());
    assert.ok(
      text.includes(said),
      `the refusal reads ${JSON.stringify(text)}, which does not say ` +
        `${JSON.stringify(said)}`,
    );
  },
);

When(
  "I press the bare day {string}",
  async function (this: OlaiWorld, date: string) {
    await this.showSidebar();
    const mint = this.calendarDay(date).locator(CALENDAR_MINT);
    await mint.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.press(mint);
  },
);

/**
 * TODAY's cell — the one bare day a page that is not a day page is certain to
 * be showing, because the month a calendar anchors to with no day open is
 * today's (`Calendar.tsx`), and nothing in the journal fixture is dated this
 * century. Asked of the clock the same way the client asks it, so the two
 * cannot disagree about which day it is at a local midnight.
 */
When("I press today's bare day", async function (this: OlaiWorld) {
  await this.showSidebar();
  const mint = this.calendarDay(isoDayOf(new Date())).locator(CALENDAR_MINT);
  await mint.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(mint);
});

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
