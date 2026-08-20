/**
 * The ⌘K palette: opening it, what it lists, what it writes, what it asks and
 * what it said.
 *
 * Its own file because the palette is no longer a shell — the same move
 * `./menu_steps.ts` made away from `./outline_tree_steps.ts`, for the same
 * reason. It has op rows that write the directory, a question before the one
 * verb with a blast radius, a capture line that keeps the modal up on purpose,
 * and two moods to say things in.
 *
 * TONE is the thing these steps are careful about, exactly as the menu's are:
 * a refusal in the ops layer's own words and a remark from a write that landed
 * are drawn in one slot, and a scenario that could not tell them apart would
 * pass against a client that alarmed about a nudge. So `data-tone` is asserted
 * rather than a colour.
 *
 * The other care is that CHOOSING an op row must not assume the palette
 * closes: a write with something to say leaves it up, which is the whole of
 * the silent-errors promise here. `I pick the palette item` (which waits for
 * the modal to go) is kept for the rows that navigate; the writes use
 * `I choose … from the palette`.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { saysThat } from "../support/said.ts";
import {
  attr,
  HYDRATION_TIMEOUT,
  oneLine,
  PALETTE,
  PALETTE_ASK_ERROR,
  PALETTE_CAPTURE,
  PALETTE_CONFIRM,
  PALETTE_INPUT,
  PALETTE_ITEM,
  PALETTE_SAID,
  PALETTE_SCRIM,
  POLL_TIMEOUT,
  SHORTCUTS,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── opening it, and typing into it ─────────────────────────────────────

When("I press the palette shortcut", async function (this: OlaiWorld) {
  // `ControlOrMeta` is Playwright's own name for the platform modifier — Meta
  // on Darwin, where Ctrl+K is kill-line, Control elsewhere — which is exactly
  // the test `web/src/client/keys.ts` makes. The suite already presses chords
  // that way (`I press "ControlOrMeta+z"`).
  await this.page.keyboard.press("ControlOrMeta+k");
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the command palette is open", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the command palette is closed", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

/** The keyboard-shortcuts dialog, which the palette opens and which had no
 *  way out but its scrim until the one-stack work (`palette/Shortcuts.tsx`). */
Then("the shortcuts are showing", async function (this: OlaiWorld) {
  await this.page
    .locator(SHORTCUTS)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the shortcuts are put away", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SHORTCUTS).count()) === 0,
    "the shortcuts dialog to be gone",
  );
});

/** The palette's own way out for a pointer: the full-screen scrim behind its
 *  card. It covers the page, so it is also a press outside every panel
 *  underneath — which is what `dismiss_stack.feature` asks it about. */
When("I press the palette scrim", async function (this: OlaiWorld) {
  // A CORNER of it, not the middle: the scrim covers the viewport, and the
  // middle of the viewport is where the palette's own card is drawn — so the
  // default centre press lands on the card and puts nothing away.
  await this.page.locator(PALETTE_SCRIM).click({ position: { x: 20, y: 20 } });
  await this.waitForFrame();
});

/** Escape rather than the chord: a scenario that has just captured is holding
 *  a palette whose box has the caret, and ⌘K there would toggle it shut and
 *  make the step below it read as a race. This is also the gesture a person
 *  makes when they are done capturing. */
When("I close the palette", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Escape");
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

/** Type into the palette box, waiting for it first — the one spelling every
 *  step that puts words in it is written in terms of. */
const fillPalette = async (world: OlaiWorld, text: string) => {
  const input = world.page.locator(PALETTE_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await input.fill(text);
  return input;
};

/** Fill without Enter — search runs as you type; Enter would pick a row. */
When(
  "I type {string} into the palette",
  async function (this: OlaiWorld, text: string) {
    await fillPalette(this, text);
  },
);

When(
  "I ask the palette {string}",
  async function (this: OlaiWorld, text: string) {
    const input = await fillPalette(this, text);
    await input.press("Enter");
    await this.waitForFrame();
  },
);

Then("the palette shows an ask error", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE_ASK_ERROR)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the palette box holds {string}",
  async function (this: OlaiWorld, text: string) {
    // WAITED FOR, not read once. What empties this box after a capture is the
    // write landing, which is a round trip — and the step before this one waits
    // a frame, which on a loaded runner is not the same thing. Reading once
    // asserted on whichever frame the poll happened to catch.
    const box = this.page.locator(PALETTE_INPUT);
    await this.waitUntil(
      async () => (await box.inputValue()) === text,
      `the palette box to hold ${JSON.stringify(text)}`,
    ).catch(() => undefined);
    assert.strictEqual(await box.inputValue(), text, "the palette box");
  },
);

// ── the rows ───────────────────────────────────────────────────────────

/** Every row's label, in the order they are drawn. The confirm's two buttons
 *  carry the same testid, so while a question is up these are its two ways
 *  out — which is what lets `I choose … from the palette` answer one. */
const rowsOf = async (world: OlaiWorld): Promise<ReadonlyArray<string>> => {
  await world.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return (await world.page.locator(PALETTE_ITEM).allInnerTexts()).map(oneLine);
};

Then(
  "the palette offers {string}",
  async function (this: OlaiWorld, label: string) {
    await this.waitUntil(
      async () => (await rowsOf(this)).some((row) => row.includes(label)),
      `the palette to offer ${JSON.stringify(label)}`,
    );
  },
);

Then(
  "the palette does not offer {string}",
  async function (this: OlaiWorld, label: string) {
    // Read after a frame rather than polled: the absence has to be true NOW,
    // and waiting for it would pass on a palette that dropped the row later.
    await this.waitForFrame();
    const rows = await rowsOf(this);
    assert.ok(
      !rows.some((row) => row.includes(label)),
      `the palette offers ${JSON.stringify(label)}: ${rows.join(" | ")}`,
    );
  },
);

Then(
  "the palette lists the node {string}",
  async function (this: OlaiWorld, title: string) {
    // A debounce and one server round trip sit between the keystroke and the
    // row, so this waits rather than reads. A row's id is its ADDRESS, and a
    // node's address is a bare fragment — so `hit-#` tells a node hit from a
    // document row and from a shell item that happens to share a word.
    await this.page
      .locator(`${PALETTE_ITEM}[data-id^="hit-#"]`)
      .filter({ hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the palette lists the document {string}",
  async function (this: OlaiWorld, file: string) {
    // Gripped by its `data-id` rather than by the text: the row's label is the
    // document's TITLE, and the id is its address, which is the thing a
    // scenario means. It waits like a node hit does, and for the same reason —
    // one reading answers both kinds now (`@olai/format`'s
    // `matchingDocuments`), so a document row is a debounce and a round trip
    // away exactly as a record's is.
    await this.page
      .locator(`${PALETTE_ITEM}${attr("data-id", `hit-${file}`)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the palette lists no document {string}",
  async function (this: OlaiWorld, file: string) {
    // Read after a frame rather than polled, for `the palette does not offer`'s
    // reason: the absence has to be true NOW. Asked of the row's own id rather
    // than of the list's text, because a node hit may well NAME the file this
    // step is claiming has no row of its own — a top-level node's place line is
    // the outline it lives in.
    await this.waitForFrame();
    const rows = await this.page
      .locator(`${PALETTE_ITEM}${attr("data-id", `hit-${file}`)}`)
      .count();
    assert.strictEqual(rows, 0, `the palette lists ${JSON.stringify(file)}`);
  },
);

/** A row that NAVIGATES: it closes the palette, and waiting for that is what
 *  keeps the next step from racing the frame. */
When(
  "I pick the palette item {string}",
  async function (this: OlaiWorld, label: string) {
    const item = this.page.locator(PALETTE_ITEM).filter({ hasText: label });
    await item.click();
    await this.page
      .locator(PALETTE)
      .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

/**
 * A row that WRITES, and the click's own RECEIPT.
 *
 * A frame is not an answer — `support/caret.ts`'s whole argument, one key
 * layer down — so this waits for the thing the palette DOES about the row
 * rather than for a repaint. There are exactly four, and every row this step
 * is pointed at produces one of them:
 *
 *   - the palette GOES — a write that landed with nothing to add;
 *   - it SAYS something — a refusal in the ops layer's own words, or a nudge;
 *   - it ASKS, or stops asking — the one verb with a question, and `Cancel`;
 *   - the BOX changes — the capture row, whose whole answer is the primed
 *     prefix and a caret after it.
 *
 * Without this the step after it is the first thing that waits, and the one
 * that reads rather than polls — `the palette does not offer …` — would be
 * asking before the click had landed.
 */
/**
 * What the palette's box holds RIGHT NOW, or `null` when there is no box.
 *
 * The four conditions the wait below is made of are read one after another, so
 * the page moves underneath them: the palette can be gone by the time the
 * fourth is asked, and `inputValue` on a locator that matches nothing BLOCKS
 * for the default timeout instead of answering. That is a 30-second stall
 * inside a poll, reported as if the step itself had timed out — which is what
 * it did twice on a loaded runner before this, in two different scenarios,
 * while the thing it was waiting for had already happened.
 */
const boxHolds = async (world: OlaiWorld): Promise<string | null> => {
  const box = world.page.locator(PALETTE_INPUT);
  if ((await box.count()) === 0) return null;
  return await box.inputValue().catch(() => null);
};

When(
  "I choose {string} from the palette",
  async function (this: OlaiWorld, label: string) {
    const before = {
      asking: await this.page.locator(PALETTE_CONFIRM).count(),
      box: await boxHolds(this),
    };
    await this.page
      .locator(PALETTE_ITEM)
      .filter({ hasText: label })
      .first()
      .click();
    await this.waitUntil(
      async () =>
        (await this.page.locator(PALETTE).count()) === 0 ||
        (await this.page.locator(PALETTE_SAID).count()) > 0 ||
        (await this.page.locator(PALETTE_CONFIRM).count()) !== before.asking ||
        (await boxHolds(this)) !== before.box,
      `the palette to answer ${JSON.stringify(label)}`,
    );
  },
);

// ── the question, and what it said ─────────────────────────────────────

Then(
  "the palette asks {string}",
  async function (this: OlaiWorld, question: string) {
    const asking = this.page.locator(PALETTE_CONFIRM);
    await asking.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await asking.innerText()), question);
  },
);

/**
 * WHERE THE KEYBOARD IS — asked of `document.activeElement`'s own `data-id`,
 * which is the fact the markup publishes about a row or a way out.
 *
 * A question nobody's keyboard can reach is a question only a mouse may
 * answer, and the palette's Tab trap made that literal until the confirm
 * learned to take the caret (review, 2026-08-14). So the caret is asserted
 * rather than assumed — a screen reader's reading of this panel is the focus
 * moving into it.
 */
Then(
  "the palette's caret is on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () =>
        (await this.page.evaluate(() =>
          document.activeElement?.getAttribute("data-id") ?? null
        )) === id,
      `the palette's caret to be on ${JSON.stringify(id)}`,
    );
  },
);

/** Back into the box on purpose — the only way to be typing while a question
 *  is up, and the setup for what Enter means there. */
When("I click the palette box", async function (this: OlaiWorld) {
  await this.page.locator(PALETTE_INPUT).click();
});

Then("the palette is not asking anything", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE_CONFIRM)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

/** What it SAID, in the mood it said it — through `../support/said.ts`, which
 *  is where "wait for the line, read it, check `data-tone`" is spelled for
 *  every surface in this app that says something about a write. Two steps
 *  rather than one with a word, because a refusal and a remark are read by
 *  different scenarios for different reasons. */
Then(
  "the palette says {string}",
  async function (this: OlaiWorld, text: string) {
    await saysThat(this, PALETTE_SAID, text, "palette line", "alarm");
  },
);

Then(
  "the palette remarks {string}",
  async function (this: OlaiWorld, text: string) {
    await saysThat(this, PALETTE_SAID, text, "palette line", "aside");
  },
);

// ── quick capture ──────────────────────────────────────────────────────

/**
 * The whole gesture, as a person makes it: the `+` prefix, the line, Enter —
 * and then the palette's own answer, which is what makes a SECOND capture a
 * gesture rather than a race.
 *
 * The palette takes ONE WRITE AT A TIME (`palette/Palette.tsx`'s `sending`,
 * the date picker's rule), and a capture that arrives while the last one is
 * still out is dropped where it stands: no write, no sentence, nothing on
 * screen. The file having the first line does not close that window — the
 * server writes, publishes and only then answers, so a scenario that reads the
 * disk is reading a fact this TAB has not been told yet. Measured under load:
 * `A second capture goes into the inbox that now exists` was one of the
 * scenarios this suite dropped, on the second capture, as a fifteen-second
 * wait for a line nobody had written.
 *
 * The answer is the slot, either mood — the remark a landed capture makes
 * (`captured “…” to <file>`) or the ops layer's refusal — because both are set
 * in the `.then` of the round trip and neither is there while it is out. The
 * scenario next door already says this in words (`⌘Z takes back a capture`:
 * *the palette's own line rather than the disk … it is said in the answer that
 * files the inverse*); here it is the step's, so every caller gets it.
 */
When(
  "I capture {string} from the palette",
  async function (this: OlaiWorld, line: string) {
    const input = await fillPalette(this, `+ ${line}`);
    await input.press("Enter");
    // The frame first: the send clears the slot synchronously, so a poll
    // started before it would find the LAST capture's remark and stop there.
    await this.waitForFrame();
    await this.waitUntil(
      async () => (await this.page.locator(PALETTE_SAID).count()) > 0,
      `the palette to say what came of capturing ${JSON.stringify(line)}`,
    );
  },
);

Then(
  "the palette previews the capture {string}",
  async function (this: OlaiWorld, text: string) {
    const preview = this.page.locator(PALETTE_CAPTURE);
    await preview.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await preview.innerText()), text);
  },
);
