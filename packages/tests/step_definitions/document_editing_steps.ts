/**
 * Editing documents: the editor a document page becomes, the two creation
 * doors, and the conflict a write meets when the file moved underneath it.
 *
 * Everything here drives the UI — a click into the prose, the pause that arms
 * the autosave — and asserts what came BACK on the wire: a body that changed,
 * a second tab that followed, a refusal drawn in the ops layer's own words.
 * Nothing reads the disk directly, because nothing in the client does either
 * (the one exception says why it is one: the line-ending claim below).
 *
 * THERE IS NO EDIT VERB EITHER (ruled 2026-08-18, documents-only pass). The
 * page IS the editor, mounted reading, so "start editing" is a CLICK IN THE
 * PROSE and "leave" is looking somewhere else. What a scenario asks about is
 * therefore the MODE (`data-writing`) rather than whether an element exists.
 *
 * THERE IS NO SAVE STEP, and its absence is the ruling (2026-08-18): a
 * document is written on a pause and when the caret leaves, so what a scenario
 * does is wait — `AUTOSAVE_IDLE` is imported from the client rather than
 * spelled here, so a number changed in one place cannot leave this suite
 * asserting against the other.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { isoDayOf } from "@olai/web/src/client/clock.ts";
import type { Page } from "playwright";

import {
  CALENDAR_MINT,
  DOCUMENT_BODY,
  DOCUMENT_DRIFTED,
  DOCUMENT_EDITOR,
  DOCUMENT_OVERWRITE,
  DOCUMENT_PAGE,
  DOCUMENT_SAID,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
  WRITING,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the editor ─────────────────────────────────────────────────────────

/** A CLICK IN THE PROSE, which is the whole gesture: the surface a reader is
 *  looking at becomes the one they are typing in, at the character they hit.
 *  The hydration wait is its own — the body arrives a frame behind the
 *  heading. */
When("I start editing the document", async function (this: OlaiWorld) {
  const surface = this.page.locator(DOCUMENT_BODY).first();
  await surface.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(surface);
  await this.page
    .locator(`${DOCUMENT_EDITOR}${WRITING}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the document editor holds text containing {string}",
  async function (this: OlaiWorld, text: string) {
    const held = await this.editorDraws(this.page.locator(DOCUMENT_EDITOR));
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
    const held = await this.editorDraws(this.page.locator(DOCUMENT_EDITOR));
    assert.ok(
      !held.includes(text),
      `the editor holds ${JSON.stringify(oneLine(held))}, which carries ` +
        `${JSON.stringify(text)} — a draft has followed its typist onto ` +
        "another file",
    );
  },
);

When("I retype the document as:", async function (this: OlaiWorld, source: string) {
  await this.retypeEditor(this.page.locator(DOCUMENT_EDITOR), source);
});

/** There is no verb to press: what a scenario waits for is the file, and every
 *  step after this one asks the page or the disk what happened. The wait
 *  itself is `support/world.ts`'s — one number, one multiplier, both
 *  surfaces. */
When("the document autosaves", async function (this: OlaiWorld) {
  await this.settleAutosave();
});

/** Look somewhere else — the page's own heading, which is on every document
 *  page and can hold no caret. There is no Done verb to press: the blur IS the
 *  leaving, and it flushes what is owed (`client/document/DocEditor.tsx`). */
When("I leave the document editor", async function (this: OlaiWorld) {
  await this.press(this.page.locator(`${DOCUMENT_PAGE} h1`).first());
});

/** The caret's own way out — the same door Done is, said with a key. It is the
 *  one key `client/keys.ts` claims in a document, and inside a vim editor it
 *  is not claimed at all. */
When("I press Escape in the document editor", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DOCUMENT_EDITOR));
  await this.page.keyboard.press("Escape");
  await this.waitForFrame();
});

When("I overwrite the document anyway", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DOCUMENT_OVERWRITE));
});

Then("the document is being typed", async function (this: OlaiWorld) {
  await this.page
    .locator(`${DOCUMENT_EDITOR}${WRITING}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/** NOT "the editor is gone": the surface stays, because it is the page's body.
 *  What ends is the caret being in it — and while the editor's chunk is still
 *  in the air that really is an element going, since what a reader gets there
 *  is the page's own rendering. Both are "nobody is typing in this". */
Then("the document is no longer being typed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(`${DOCUMENT_EDITOR}${WRITING}`).count()) === 0,
    "the caret to leave the document",
  );
});

// ── the conflict story ─────────────────────────────────────────────────

Then("the editor notices the file changed on disk", async function (this: OlaiWorld) {
  await this.page
    .locator(DOCUMENT_DRIFTED)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the write is refused saying {string}",
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

/**
 * WHAT THE FILE SAYS, asked of the disk.
 *
 * The one assertion here that does not go through the page, and the reason is
 * the whole verbatim law: what a live-preview editor DRAWS is markers hidden
 * and words drawn, and the claim these scenarios make is about the bytes
 * underneath. A page cannot make that claim about itself.
 *
 * `\n` in a feature file is a backslash and an n — Gherkin unescapes nothing —
 * so it is read here as the line break a scenario means by it, which is what
 * lets one step say "this line, then that one, and nothing between them".
 */
const onDisk = (text: string): string => text.replaceAll("\\n", "\n");

Then(
  "{string} holds the text {string}",
  async function (this: OlaiWorld, file: string, text: string) {
    await this.waitUntil(
      () => Promise.resolve(this.readServed(file).includes(onDisk(text))),
      `${file} to hold ${JSON.stringify(text)}`,
    );
  },
);

/** ...and the same question asked the other way, which is how a scenario says
 *  a keystroke landed WHERE THE FINGER WAS: the line it went into is not the
 *  line the file used to have. */
Then(
  "{string} no longer holds the text {string}",
  async function (this: OlaiWorld, file: string, text: string) {
    await this.waitUntil(
      () => Promise.resolve(!this.readServed(file).includes(onDisk(text))),
      `${file} to stop holding ${JSON.stringify(text)}`,
    );
  },
);

/**
 * THE LINE ENDINGS ON DISK, asked of the bytes.
 *
 * A file written in CRLF that comes back in LF is every line changed by a
 * keystroke that was about one word — the verbatim law breaking through the
 * breaks rather than through the markup (`client/mde/separator.ts`). So this
 * counts them: every break is a CRLF, and none is a bare LF.
 */
Then(
  "{string} still uses CRLF line endings",
  async function (this: OlaiWorld, file: string) {
    await this.waitUntil(async () => {
      const text = this.readServed(file);
      const breaks = text.split("\n").length - 1;
      const crlf = text.split("\r\n").length - 1;
      return breaks > 0 && breaks === crlf;
    }, `${file} to still end its lines with CRLF`);
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
    // Reading, and nothing more: a tab that opened a document has its body on
    // screen and no caret in it.
    await other
      .locator(DOCUMENT_BODY)
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
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
// over the kind. What stays here is the door that is only a DOCUMENT's — a
// bare calendar day, which mints that day's note.

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

/** The other side of the drift line: NOT noticed, which is what a document
 *  nobody is typing in must say when the file moves under it. A re-read is not
 *  a conflict (`client/document/DocEditor.tsx`), and a page that alarmed about
 *  one would be teaching readers to ignore the line that matters. */
Then("the editor has not noticed a conflict", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(DOCUMENT_DRIFTED).count(),
    0,
    "the page says the file changed under an editor nobody was typing in",
  );
});

/** NOTHING SAID, which is the assertion an autosave chain's own next write
 *  needs: a refusal drawn under a document nobody else touched would be the
 *  editor conflicting with itself (`client/document/DocEditor.tsx` advances
 *  the baseline on every write that lands). */
Then("nothing was refused", async function (this: OlaiWorld) {
  const said = this.page.locator(DOCUMENT_SAID);
  // The line is READ only if it is there: a message that asks a locator that
  // matches nothing for its text is a step that times out instead of passing.
  const drawn = (await said.count()) === 0 ? "" : oneLine(await said.first().innerText());
  assert.strictEqual(drawn, "", `the page refused a write, saying ${JSON.stringify(drawn)}`);
});
