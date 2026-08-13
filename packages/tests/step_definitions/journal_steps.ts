/**
 * The month in the sidebar, and one day as a page.
 *
 * Two things these steps are careful about. What a day cell IS — something on
 * it, a note of its own, today, the one being read — is read off `data-`
 * attributes rather than off the colour it is painted, because the marks are a
 * promise and the palette is a styling decision a refactor may change; the
 * cell's four facts are asked through the world's own `expectDayMark`, which
 * is what keeps this file and `daily_notes_steps.ts` asking one widget one
 * way. And "today" is asked of
 * the clock with the same function the client uses (`client/clock.ts`),
 * imported rather than re-spelled: a suite that computed the day its own way
 * would disagree with the browser at exactly midnight, in one time zone, on
 * somebody else's machine.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { isoDayOf } from "@olai/web/src/client/clock.ts";

import {
  CALENDAR,
  CALENDAR_NEXT,
  CALENDAR_PREV,
  CRUMB,
  DATE,
  DAY_EMPTY,
  DAY_GROUP,
  DAY_PAGE,
  drawn,
  expectDrawn,
  NODE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  readable,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── opening a day ──────────────────────────────────────────────────────

/** A day's own page, cold. Registered once and read as either keyword —
 *  Cucumber matches on the text — because a day is either what a scenario is
 *  about or where it starts from, and the sentence says the same thing. */
Given("I open the day {string}", async function (this: OlaiWorld, date: string) {
  await this.openDayPage(date);
});

When("I open today", async function (this: OlaiWorld) {
  await this.open("/today");
});

Then("the day open is {string}", async function (this: OlaiWorld, date: string) {
  await this.expectAttribute(DAY_PAGE, "data-date", date, "the day page");
});

Then("the day is empty", async function (this: OlaiWorld) {
  await this.page
    .locator(DAY_EMPTY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── what a day holds ───────────────────────────────────────────────────

/** The outlines that had something on this day, in the order they are drawn. */
Then(
  "the day groups are {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(this.page.locator(DAY_GROUP), "data-file", expected);
  },
);

/** Every node on the day, in DOM order — across the groups, because the order
 *  within a group and the order of the groups are one reading. */
Then(
  "the day lists {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(
      this.page.locator(`${DAY_PAGE} ${NODE}`),
      "data-node-id",
      expected,
    );
  },
);

/** WHY a node is on the day being read: the date badge says which of the
 *  node's dates put it there — the `date` field it is scheduled for, or the
 *  mark that is dated it. A `data-` fact, like the day cell's marks, because
 *  what the badge PRINTS is a styling decision and which date it is about is
 *  the promise. */
Then(
  "the node {string} is on the day for its {string}",
  async function (this: OlaiWorld, id: string, occasion: string) {
    // `expectAttribute` rather than one `getAttribute`: it waits on a selector
    // that only matches once the badge says so, which is what survives the
    // render between clicking a day and that day's rows arriving — a one-shot
    // read is free to answer with the day before's badge.
    await this.expectAttribute(
      `${nodeSelector(id)} ${DATE}`,
      "data-occasion",
      occasion,
      `the date badge on "${id}"`,
    );
  },
);

/** The context a day gives a node: its canonical ancestry, root first. Text
 *  rather than an attribute, because what a crumb promises is what it READS —
 *  and the file is not among these: the group heading has already said it, and
 *  saying it twice on one screen is what the optional crumb exists to avoid. */
Then(
  "the ancestors of {string} are {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const crumbs = await drawn(this.node(id).locator(CRUMB));
    assert.deepStrictEqual(
      (await crumbs.allInnerTexts()).map(readable),
      expected.split(",").map((crumb) => readable(crumb.trim())),
    );
  },
);

// ── the month ──────────────────────────────────────────────────────────

Then("the month shown is {string}", async function (this: OlaiWorld, month: string) {
  await this.expectAttribute(CALENDAR, "data-month", month, "the calendar");
});

/** Today's month, asked of the clock — the month the calendar falls back to
 *  when the page it is chrome for names no day of its own. */
Then("the month shown is this month", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CALENDAR,
    "data-month",
    isoDayOf(new Date()).slice(0, "YYYY-MM".length),
    "the calendar",
  );
});

Then(
  "the day {string} has something on it",
  async function (this: OlaiWorld, date: string) {
    await this.expectDayMark(date, "data-dated", true);
    // A day with something on it is the only kind that goes anywhere.
    assert.strictEqual(
      await this.dayLink(date).count(),
      1,
      `the day ${date} has something on it, so it must be a link to that day`,
    );
  },
);

/** Inert is NEITHER mark, and both halves are asked: a day bearing a note has
 *  nothing dated it either, and a step that only counted the nodes would call
 *  it inert while it sat there as a link (`features/daily_notes.feature`). */
Then("the day {string} is inert", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-dated", false);
  await this.expectDayMark(date, "data-noted", false);
  // Not a LINK: there is nothing to read on it. What a bare day carries
  // instead is the mint affordance — a button that creates the day's note
  // (`document_editing.feature`) — so "inert" means "nowhere to go", not
  // "nothing to press".
  assert.strictEqual(
    await this.dayLink(date).count(),
    0,
    `the day ${date} has nothing on it and no note, so it must not be a link`,
  );
});

Then(
  "the day {string} is the one being read",
  async function (this: OlaiWorld, date: string) {
    await this.expectDayMark(date, "data-open", true);
  },
);

Then(
  "the day {string} is not the one being read",
  async function (this: OlaiWorld, date: string) {
    await this.expectDayMark(date, "data-open", false);
  },
);

Then("today wears the ring", async function (this: OlaiWorld) {
  const today = isoDayOf(new Date());
  await this.expectDayMark(today, "data-today", true);
  // And nothing else does: a ring on two days is a calendar that has stopped
  // saying which day it is.
  const rung = await this.page
    .locator(`${CALENDAR} [data-today="true"]`)
    .evaluateAll((found) => found.map((day) => day.getAttribute("data-date")));
  assert.deepStrictEqual(rung, [today]);
});

/** Today AND open — the one cell that has to carry both marks at once. Asked
 *  as two facts of the same `[data-date]` cell rather than as one combined
 *  attribute: they are two different things stacking (the ring says which day
 *  it is, the fill says you are on it), and a cell that lost either one is a
 *  different failure. */
Then("today is the one being read", async function (this: OlaiWorld) {
  const today = isoDayOf(new Date());
  await this.expectDayMark(today, "data-today", true);
  await this.expectDayMark(today, "data-open", true);
});

Then("today is not the one being read", async function (this: OlaiWorld) {
  await this.expectDayMark(isoDayOf(new Date()), "data-open", false);
});

/** Today, with something on it — asked of the clock rather than written down,
 *  because the only way a fixture has something on TODAY is that a write put
 *  it there while the scenario was running. */
Then("today has something on it", async function (this: OlaiWorld) {
  await this.expectDayMark(isoDayOf(new Date()), "data-dated", true);
});

When("I click the day {string}", async function (this: OlaiWorld, date: string) {
  await this.press(this.calendarDay(date).locator("a"));
});

const pageMonth = async (world: OlaiWorld, control: string): Promise<void> => {
  const shown = await world.page.locator(CALENDAR).getAttribute("data-month");
  await world.page.locator(control).click();
  await world.waitUntil(
    async () =>
      (await world.page.locator(CALENDAR).getAttribute("data-month")) !== shown,
    `the calendar to move off ${oneLine(String(shown))}`,
  );
};

When("I page the calendar back", async function (this: OlaiWorld) {
  await pageMonth(this, CALENDAR_PREV);
});

When("I page the calendar forward", async function (this: OlaiWorld) {
  await pageMonth(this, CALENDAR_NEXT);
});
