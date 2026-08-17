/**
 * The day's own note: the second mark in the month, the rendering above the
 * day's nodes, and the relative link that has to know which FILE it was written
 * in rather than which page it is drawn on.
 *
 * Two things these steps are careful about. Which mark a day cell wears is read
 * off `data-noted` and `data-dated` separately, never off the colour or off one
 * combined fact — they are two different sentences about a day and a cell may
 * say both — and through the same `expectDayMark` the journal's own steps use,
 * because the cell is one widget however many features ask about it. And
 * "today" is asked of the clock with the same function the client uses
 * (`client/clock.ts`), imported rather than re-spelled, for the reason
 * `journal_steps.ts` gives: a suite that computed the day its own way would
 * disagree with the browser at exactly midnight in one time zone.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { isoDayOf } from "@olai/web/src/client/clock.ts";

import {
  DAY_EMPTY,
  DAY_GROUP,
  DAY_NOTE,
  DAY_NOTE_LINK,
  DAY_PAGE,
  daySelector,
  expectAbsent,
  expectDrawn,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Where a scenario's own note goes: the layout the human's vault keeps, so
 *  the path this writes is the shape the detection is claimed to match. */
const dailyNote = (date: string): string => `Daily/${date}.md`;

// ── the note on the page ───────────────────────────────────────────────

/** The note as a `data-` fact rather than as text: WHICH document turned out
 *  to be the day's is the promise, and what is inside it is the markdown
 *  pipeline's, asserted by the document steps this feature reuses. */
const expectNote = async (world: OlaiWorld, file: string): Promise<void> => {
  await world.expectAttribute(
    DAY_NOTE,
    "data-file",
    file,
    "the day's note",
    HYDRATION_TIMEOUT,
  );
};

Then(
  "the day shows the note {string}",
  async function (this: OlaiWorld, file: string) {
    await expectNote(this, file);
  },
);

Then("the day shows today's note", async function (this: OlaiWorld) {
  await expectNote(this, dailyNote(isoDayOf(new Date())));
});

/** EVERY note on the day, in the order they are drawn — which is the whole of
 *  the two-claimants promise. Asked as an ordered list rather than as "the
 *  first one is X", because the bug this holds shut is a second file being
 *  dropped, and a page showing one of two passes every assertion about that
 *  one. */
Then(
  "the day shows the notes {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(this.page.locator(DAY_NOTE), "data-file", expected);
  },
);

// One half of the day is absent, asked once the OTHER half is on screen: an
// empty count is a perfectly plausible wrong answer on a page that has not been
// drawn yet, and a day page has no single moment of being finished. The reading
// is `support/world.ts`'s now that the filter gave three more pages a sentence
// they must NOT say while they are narrowed.

Then("the day shows no note", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    DAY_GROUP,
    DAY_NOTE,
    "a day with no document named for it is drawing a note",
  );
});

Then("the day has no dated nodes", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    DAY_NOTE,
    DAY_GROUP,
    "this day has nothing dated it, so it must draw no groups",
  );
});

/** The line a day says when it holds NOTHING — and a day holding a note does
 *  not hold nothing, nor does a day a query narrowed to nothing ("no matches"
 *  is a claim about the query, and the bar makes it). Read off the PAGE, so it
 *  is asked of a day that has drawn one. */
Then("the day does not say it is empty", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    DAY_PAGE,
    DAY_EMPTY,
    "a day is telling the reader it is empty when it is not",
  );
});

When("I follow the note's heading", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DAY_NOTE_LINK).first());
});

/**
 * Follow a link inside RENDERED MARKDOWN, by the words it is set in.
 *
 * By text, because that is the only handle it has: rendered markdown carries no
 * testids — its tags come out of a file on disk — and the whole question here is
 * where an ordinary `[…](…)` somebody wrote goes. The rendering it is in is not
 * named either, deliberately: this is asked of a note on a day page and of the
 * same file on its own page, and the step says the same thing both times.
 */
When(
  "I follow the link {string} in the rendered markdown",
  async function (this: OlaiWorld, text: string) {
    const link = this.page.locator(`main a`, { hasText: text }).first();
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.press(link);
  },
);

// ── the mark in the month ──────────────────────────────────────────────
//
// Through the world's own `expectDayMark` (`support/world.ts`), which
// `journal_steps.ts` asks the other three marks with: one widget, one way of
// asking, and one union of facts to widen when the cell learns to say
// something more.

Then("the day {string} has a note", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-noted", true);
});

Then("the day {string} has no note", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-noted", false);
});

/** The other half of "has something on it", split out: a note-day has nothing
 *  DATED it and is still a day that goes somewhere, so the two facts cannot be
 *  asked by one step any more. */
Then(
  "the day {string} has nothing on it",
  async function (this: OlaiWorld, date: string) {
    await this.expectDayMark(date, "data-dated", false);
  },
);

/** Either mark makes the cell a link — the day has something to show, whether
 *  the reader wrote it or the set did. */
Then("the day {string} is a link", async function (this: OlaiWorld, date: string) {
  const link = this.dayLink(date);
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await link.count(), 1);
});

/**
 * What the cell says OUT LOUD, which is the only form the two marks reach a
 * reader who cannot see them in.
 *
 * The `aria-label` and not the shape: a corner fold and a dot are pseudo-
 * elements with no text, so a suite that only asserted `data-noted` would stay
 * green on a calendar that announced every live day identically. Read off the
 * LINK, because the label is the link's — a bare day is a BUTTON now (the
 * mint, `document_editing.feature`), with its own label about creating the
 * day's note rather than about what is on it.
 */
Then(
  "the day {string} is announced as {string}",
  async function (this: OlaiWorld, date: string, said: string) {
    await this.expectAttribute(
      `${daySelector(date)} a`,
      "aria-label",
      said,
      `the day ${date}`,
    );
  },
);

Then("today has a note", async function (this: OlaiWorld) {
  await this.expectDayMark(isoDayOf(new Date()), "data-noted", true);
});

Then("today has no note", async function (this: OlaiWorld) {
  await this.expectDayMark(isoDayOf(new Date()), "data-noted", false);
});

// ── a note written while the page is open ──────────────────────────────

/** Drop today's note into the served directory, as a person with an editor
 *  would. Nothing here tells the store to look — the watcher does. */
Given("I write today's note", function (this: OlaiWorld) {
  this.writeServed(
    dailyNote(isoDayOf(new Date())),
    [
      "# Today",
      "",
      "Written into the directory while the page was **open**, which is the only",
      "way a fixture can have a note on a day nobody knew in advance.",
    ].join("\n"),
  );
});
