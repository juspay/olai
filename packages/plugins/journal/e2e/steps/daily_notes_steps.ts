import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { isoDayOf } from "@olai/web/testlib";

import {
  DAY_EMPTY,
  DAY_GROUP,
  DAY_PAGE,
  daySelector,
  expectAbsent,
  expectDrawn,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  DAY_NOTE,
  DAY_NOTE_LINK,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const dailyNote = (date: string): string => `Daily/${date}.md`;

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

Then(
  "the day shows the notes {string}",
  async function (this: OlaiWorld, expected: string) {
    await expectDrawn(this, this.page.locator(DAY_NOTE), "data-file", expected);
  },
);

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

When(
  "I follow the link {string} in the rendered markdown",
  async function (this: OlaiWorld, text: string) {
    const link = this.page.locator(`main a`, { hasText: text }).first();
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.press(link);
  },
);

Then("the day {string} has a note", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-noted", true);
});

Then("the day {string} has no note", async function (this: OlaiWorld, date: string) {
  await this.expectDayMark(date, "data-noted", false);
});

Then(
  "the day {string} has nothing on it",
  async function (this: OlaiWorld, date: string) {
    await this.expectDayMark(date, "data-dated", false);
  },
);

Then("the day {string} is a link", async function (this: OlaiWorld, date: string) {
  await this.openCalendar();
  const link = this.dayLink(date);
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await link.count(), 1);
});

Then(
  "the day {string} is announced as {string}",
  async function (this: OlaiWorld, date: string, said: string) {
    await this.openCalendar();
    await this.expectChromeAttribute(
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
