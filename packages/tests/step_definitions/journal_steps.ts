/**
 * The month in the sidebar, and one day as a page.
 *
 * Two things these steps are careful about. What a day cell IS — something on
 * it, today, the one being read — is read off `data-` attributes rather than
 * off the colour it is painted, because the marks are a promise and the
 * palette is a styling decision a refactor may change. And "today" is asked of
 * the clock with the same function the client uses (`calendar/clock.ts`),
 * imported rather than re-spelled: a suite that computed the day its own way
 * would disagree with the browser at exactly midnight, in one time zone, on
 * somebody else's machine.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { isoDayOf } from "@olai/web/src/client/calendar/clock.ts";

import {
  CALENDAR,
  CALENDAR_NEXT,
  CALENDAR_PREV,
  CRUMB,
  DAY_EMPTY,
  DAY_GROUP,
  DAY_PAGE,
  daySelector,
  NODE,
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

/** The outlines that had something on this day, in the order they are drawn.
 *  Asserting the whole list rather than "contains X" is the point: the
 *  grouping IS the promise, and a file that should not be there is exactly the
 *  bug. */
Then(
  "the day groups are {string}",
  async function (this: OlaiWorld, expected: string) {
    const groups = this.page.locator(DAY_GROUP);
    await groups
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.deepStrictEqual(
      await groups.evaluateAll((found) =>
        found.map((group) => group.getAttribute("data-file")),
      ),
      expected.split(",").map((file) => file.trim()),
    );
  },
);

/** Every node on the day, in DOM order — across the groups, because the order
 *  within a group and the order of the groups are one reading. */
Then(
  "the day lists {string}",
  async function (this: OlaiWorld, expected: string) {
    const nodes = this.page.locator(`${DAY_PAGE} ${NODE}`);
    await nodes
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.deepStrictEqual(
      await nodes.evaluateAll((found) =>
        found.map((node) => node.getAttribute("data-node-id")),
      ),
      expected.split(",").map((id) => id.trim()),
    );
  },
);

/** The context a day gives a node: its canonical ancestry, root first. The
 *  file is NOT among the crumbs here — the group heading has already said it,
 *  and saying it twice on one screen is what the optional crumb exists to
 *  avoid. */
Then(
  "the ancestors of {string} are {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const crumbs = this.node(id).locator(CRUMB);
    await crumbs
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
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

/** What a day cell says about itself. One helper for all three marks, so a
 *  failure names the day and the fact rather than a selector. */
const expectDay = async (
  world: OlaiWorld,
  date: string,
  fact: "data-dated" | "data-today" | "data-open",
  expected: boolean,
): Promise<void> => {
  await world.expectAttribute(
    daySelector(date),
    fact,
    String(expected),
    `the day ${date}`,
  );
};

Then(
  "the day {string} has something on it",
  async function (this: OlaiWorld, date: string) {
    await expectDay(this, date, "data-dated", true);
    // A day with something on it is the only kind that goes anywhere.
    assert.strictEqual(
      await this.calendarDay(date).locator("a").count(),
      1,
      `the day ${date} has something on it, so it must be a link to that day`,
    );
  },
);

Then("the day {string} is inert", async function (this: OlaiWorld, date: string) {
  await expectDay(this, date, "data-dated", false);
  // Nothing to press: pressing it could only mean "write something here", and
  // this pane writes nothing.
  assert.strictEqual(
    await this.calendarDay(date).locator("a").count(),
    0,
    `the day ${date} has nothing on it, so it must not be a link`,
  );
});

Then(
  "the day {string} is the one being read",
  async function (this: OlaiWorld, date: string) {
    await expectDay(this, date, "data-open", true);
  },
);

Then(
  "the day {string} is not the one being read",
  async function (this: OlaiWorld, date: string) {
    await expectDay(this, date, "data-open", false);
  },
);

Then("today wears the ring", async function (this: OlaiWorld) {
  const today = isoDayOf(new Date());
  await expectDay(this, today, "data-today", true);
  // And nothing else does: a ring on two days is a calendar that has stopped
  // saying which day it is.
  const rung = await this.page
    .locator(`${CALENDAR} [data-today="true"]`)
    .evaluateAll((found) => found.map((day) => day.getAttribute("data-date")));
  assert.deepStrictEqual(rung, [today]);
});

Then("today is not the one being read", async function (this: OlaiWorld) {
  await expectDay(this, isoDayOf(new Date()), "data-open", false);
});

When("I click the day {string}", async function (this: OlaiWorld, date: string) {
  const day = this.calendarDay(date).locator("a");
  await day.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await day.click();
  await this.waitForFrame();
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
