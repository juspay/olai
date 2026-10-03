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
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { isoDayOf } from "@olai/web/testlib";

import {
  AGENDA_LINK,
  CALENDAR,
  CALENDAR_NEXT,
  CALENDAR_PREV,
  CALENDAR_ROW,
  CALENDAR_TODAY,
  CALENDAR_TOGGLE,
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
  OUTLINE_TREE,
  POLL_TIMEOUT,
  readable,
  SIDEBAR_BODY,
} from "@olai/tests/harness/world.ts";
import {
  AGENDA_OWED,
  AGENDA_PAGE,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

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

/** The plugin's whole shell contribution, absent together when its row was not
 * composed. Wait for core's sidebar before counting so an undrawn app cannot
 * satisfy an absence assertion. */
Then("the journal chrome is absent", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitForFrame();
  for (const [selector, label] of [
    [CALENDAR_ROW, "Today row"],
    [CALENDAR, "calendar"],
    [AGENDA_LINK, "Agenda entry"],
    [AGENDA_OWED, "owed badge"],
  ] as const) {
    assert.strictEqual(
      await this.page.locator(selector).count(),
      0,
      `the journal plugin is disabled, but the ${label} is drawn`,
    );
  }
});

/** `/today`, `/d/...` and `/agenda` fall through to core's home route when the
 * tenant is absent. Require the outliner before checking that neither plugin
 * page appeared. */
Then("no journal page is drawn", async function (this: OlaiWorld) {
  await this.frontLane()
    .locator(OUTLINE_TREE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(DAY_PAGE).count(), 0);
  assert.strictEqual(await this.page.locator(AGENDA_PAGE).count(), 0);
});

// ── what a day holds ───────────────────────────────────────────────────

/** The outlines that had something on this day, in the order they are drawn. */
Then(
  "the day groups are {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(this, this.page.locator(DAY_GROUP), "data-file", expected);
  },
);

/** Every node on the day, in DOM order — across the groups, because the order
 *  within a group and the order of the groups are one reading. */
Then(
  "the day lists {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(
      this,
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
  await this.openCalendar();
  await this.expectChromeAttribute(CALENDAR, "data-month", month, "the calendar");
});

/** Today's month, asked of the clock — the month the calendar falls back to
 *  when the page it is chrome for names no day of its own. */
Then("the month shown is this month", async function (this: OlaiWorld) {
  await this.openCalendar();
  await this.expectChromeAttribute(
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
    assert.strictEqual(
      await this.dayLink(date).count(),
      1,
      `the day ${date} has something on it, so it must be a link to that day`,
    );
  },
);

/** Unmarked is NEITHER of the first two marks, and both halves are asked: a
 *  day bearing a note has nothing dated it either, and a step that only
 *  counted the nodes would call it unmarked while it sat there wearing a
 *  fold (`packages/plugins/journal/e2e/features/daily_notes.feature`). Every unmarked cell is still a
 *  link — quiet, not inert. */
Then("the day {string} is unmarked", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-dated", false);
  await this.expectDayMark(date, "data-noted", false);
  // Quiet marks, not a missing link: every day goes to `/d/<date>`, and an
  // empty one is the page that says so. Creating the note is that page's
  // (`document_editing.feature`), not this cell's.
  assert.strictEqual(
    await this.dayLink(date).count(),
    1,
    `the day ${date} has nothing on it and no note, and it must still be a link to that day`,
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
  await this.showSidebar();
  await this.openCalendar();
  await this.press(this.dayLink(date));
});

/** Today, in the month the calendar is showing — asked of the clock the same
 *  way the client asks it, so the two cannot disagree about which day it is
 *  at a local midnight. */
When("I click today", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.openCalendar();
  await this.press(this.dayLink(isoDayOf(new Date())));
});

const pageMonth = async (world: OlaiWorld, control: string): Promise<void> => {
  await world.openCalendar();
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

// ── the Today row the month folds under ──────────────────────────────

/** Whether the month is unfolded, read off the chevron's own `aria-expanded`
 *  AND off the grid being there — a chevron that turned while the grid stayed
 *  is the failure the two halves exist to catch. */
const calendarFolded = async (world: OlaiWorld, open: boolean): Promise<void> => {
  await world.showSidebar();
  await world.page.locator(CALENDAR_TOGGLE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.expectChromeAttribute(CALENDAR_TOGGLE, "aria-expanded", String(open), "the month's chevron");
  await world.page.locator(CALENDAR).waitFor({ state: open ? "visible" : "detached", timeout: POLL_TIMEOUT });
};

Then("the month is folded under the Today row", async function (this: OlaiWorld) {
  await calendarFolded(this, false);
});

Then("the month is unfolded under the Today row", async function (this: OlaiWorld) {
  await calendarFolded(this, true);
});

Given("the calendar is open", async function (this: OlaiWorld) {
  await this.openCalendar();
});

/** The row's own words: `Today`, and the date the clock says, in the row's
 *  short form — asked of the same clock the client reads. */
Then("the Today row names today", async function (this: OlaiWorld) {
  await this.showSidebar();
  const today = isoDayOf(new Date());
  const row = this.page.locator(CALENDAR_TODAY);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const short = `${months[Number(today.slice(5, 7)) - 1]} ${Number(today.slice(8, 10))}`;
  await this.waitUntil(async () => oneLine(await row.innerText()) === `Today ${short}`, `the Today row to read "Today ${short}"`);
});

Then("the day open is today", async function (this: OlaiWorld) {
  await this.expectAttribute(DAY_PAGE, "data-date", isoDayOf(new Date()), "the day page");
});

Then("the Today row and its chevron are at least a finger's size", async function (this: OlaiWorld) {
  for (const [target, what] of [[CALENDAR_TODAY, "Today row"], [CALENDAR_TOGGLE, "month's chevron"]] as const) {
    const box = await this.page.locator(target).boundingBox();
    assert.ok(box !== null && box.height >= 44 && box.width >= 44, `the ${what} is ${box?.width}×${box?.height}px, under the 44px target`);
  }
});

When("I follow the Today row", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(CALENDAR_TODAY));
});

Then("the Today row is the current page", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.expectChromeAttribute(CALENDAR_TODAY, "aria-current", "page", "the Today row");
});

/** By keyboard, the way a reader without a pointer reaches it: focus the
 *  chevron and press the key a button answers to. */
When("I press {string} on the month's chevron", async function (this: OlaiWorld, key: string) {
  await this.showSidebar();
  const toggle = this.page.locator(CALENDAR_TOGGLE);
  await toggle.focus();
  await toggle.press(key);
});

When("I press the month's chevron", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(CALENDAR_TOGGLE).click();
});

/** Directly under Agenda, before any other door or heading of the column. */
Then("the Today row sits directly under Agenda", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(CALENDAR_ROW).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const order = await this.page
    .locator(`${SIDEBAR_BODY} ${AGENDA_LINK}, ${SIDEBAR_BODY} ${CALENDAR_ROW}, ${SIDEBAR_BODY} h2`)
    .evaluateAll((all) => all.map((one) => one.getAttribute("data-testid") ?? one.tagName));
  assert.deepStrictEqual(order.slice(0, 2), ["agenda-link", "calendar-row"]);
});
