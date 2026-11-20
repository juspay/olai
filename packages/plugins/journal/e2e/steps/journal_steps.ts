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
  AGENDA_FOLD,
  AGENDA_OWED,
  AGENDA_PAGE,
  AGENDA_ROWS,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

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
    [AGENDA_ROWS, "owed rows"],
    [AGENDA_FOLD, "fold's chevron"],
  ] as const) {
    assert.strictEqual(
      await this.page.locator(selector).count(),
      0,
      `the journal plugin is disabled, but the ${label} is drawn`,
    );
  }
});

Then("no journal page is drawn", async function (this: OlaiWorld) {
  await this.frontLane()
    .locator(OUTLINE_TREE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(DAY_PAGE).count(), 0);
  assert.strictEqual(await this.page.locator(AGENDA_PAGE).count(), 0);
});

Then(
  "the day groups are {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(this, this.page.locator(DAY_GROUP), "data-file", expected);
  },
);

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

Then(
  "the node {string} is on the day for its {string}",
  async function (this: OlaiWorld, id: string, occasion: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${DATE}`,
      "data-occasion",
      occasion,
      `the date badge on "${id}"`,
    );
  },
);

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

Then("the month shown is {string}", async function (this: OlaiWorld, month: string) {
  await this.openCalendar();
  await this.expectChromeAttribute(CALENDAR, "data-month", month, "the calendar");
});

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

Then("the day {string} is unmarked", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-dated", false);
  await this.expectDayMark(date, "data-noted", false);
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
  const rung = await this.page
    .locator(`${CALENDAR} [data-today="true"]`)
    .evaluateAll((found) => found.map((day) => day.getAttribute("data-date")));
  assert.deepStrictEqual(rung, [today]);
});

Then("today is the one being read", async function (this: OlaiWorld) {
  const today = isoDayOf(new Date());
  await this.expectDayMark(today, "data-today", true);
  await this.expectDayMark(today, "data-open", true);
});

Then("today is not the one being read", async function (this: OlaiWorld) {
  await this.expectDayMark(isoDayOf(new Date()), "data-open", false);
});

Then("today has something on it", async function (this: OlaiWorld) {
  await this.expectDayMark(isoDayOf(new Date()), "data-dated", true);
});

When("I click the day {string}", async function (this: OlaiWorld, date: string) {
  await this.showSidebar();
  await this.openCalendar();
  await this.press(this.dayLink(date));
});

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

Then("the Today row sits directly under Agenda", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(CALENDAR_ROW).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const order = await this.page
    .locator(`${SIDEBAR_BODY} ${AGENDA_LINK}, ${SIDEBAR_BODY} ${CALENDAR_ROW}, ${SIDEBAR_BODY} h2`)
    .evaluateAll((all) => all.map((one) => one.getAttribute("data-testid") ?? one.tagName));
  assert.deepStrictEqual(order.slice(0, 2), ["agenda-link", "calendar-row"]);
});
