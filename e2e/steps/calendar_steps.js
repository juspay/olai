// The sidebar's month: what it draws for the day journal, and where its cells
// go.
//
// Which day is today is the SERVER's answer (world.today) — the harness never
// decides one — and the month label is that answer read out, not a second
// clock's.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

const CAL = "#ol-sidebar .ol-cal";
const TODAY_CELL = `${CAL} .ol-cal-day.is-today`;

// "2026-08-07" -> "August 2026", which is what the header reads. Built from
// the parts rather than parsed: `new Date("2026-08-07")` is UTC midnight, and
// west of Greenwich that is the day before.
function monthLabel(day) {
  const [year, month] = day.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

Then("the calendar shows this month", async function () {
  const title = this.page.locator(`${CAL} .ol-cal-title`);
  await title.waitFor({ state: "visible" });
  assert.equal((await title.innerText()).trim(), monthLabel(await this.today()));
});

// Marked, and a link: `olai daily` wrote today's node before the server came
// up, so this is the day the journal HAS.
Then("today's cell is marked", async function () {
  const cell = this.page.locator(TODAY_CELL);
  await cell.waitFor({ state: "visible" });
  const day = await this.today();
  assert.equal(await cell.getAttribute("title"), day);
  assert.equal(await cell.evaluate((el) => el.tagName), "A");
  assert.equal(Number(await cell.innerText()), Number(day.slice(8)));
});

// The ruling this feature is about: an empty day is inert. Not a link, and not
// a control of any other kind — there is no page to open and this pane writes
// nothing.
Then("a day the journal has nothing for is not a link", async function () {
  const empty = this.page.locator(`${CAL} .ol-cal-empty`);
  assert.ok((await empty.count()) > 0, "every day of this month has a node");
  const tags = await empty.evaluateAll((els) => [
    ...new Set(els.map((el) => el.tagName)),
  ]);
  assert.deepEqual(tags, ["SPAN"]);
});

When("I follow today's cell", async function () {
  await this.follow(this.page.locator(TODAY_CELL));
});

When("I follow the calendar's month", async function () {
  await this.follow(this.page.locator(`${CAL} a.ol-cal-title`));
});
