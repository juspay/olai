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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// "2026-08-07" -> "August 2026", which is what the header reads.
function monthLabel(day) {
  const [year, month] = day.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

// Case-folded: the header is uppercased by the skin, the way the file label it
// replaced was, and which case a label is drawn in is not what this asserts.
Then("the calendar shows this month", async function () {
  const title = this.page.locator(`${CAL} .ol-cal-title`);
  await title.waitFor({ state: "visible" });
  assert.equal(
    (await title.innerText()).trim().toLowerCase(),
    monthLabel(await this.today()).toLowerCase(),
  );
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
  assert.equal(await this.page.locator(`${CAL} a.ol-cal-empty`).count(), 0);
});

When("I follow today's cell", async function () {
  await this.follow(this.page.locator(TODAY_CELL));
});

When("I follow the calendar's month", async function () {
  await this.follow(this.page.locator(`${CAL} a.ol-cal-title`));
});

// The entry the calendar REPLACED. Read off the whole column, because what is
// gone is a line of text and not a link a locator could name.
Then("the sidebar does not name {string}", async function (label) {
  const text = await this.page.locator("#ol-sidebar").innerText();
  assert.ok(!text.includes(label), `${label} is still in the sidebar`);
});
