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

// What the cell looks like under the pointer BEFORE it is the one you are on.
// Kept so the assertion below can say the two are different things — see it.
When("I put the pointer on today's cell", async function () {
  const cell = this.page.locator(TODAY_CELL);
  await cell.hover();
  this.hoverPaint = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
});

// The day you are READING, which is not the same fact as which day is today —
// the report this exists for is a browser in which the two were
// indistinguishable. A class and the ARIA that means it, so the mark is not
// only paint...
//
// ...and then the paint, because the class was there all along and the human
// still could not see it: a click leaves the pointer ON the cell, and the
// hover rule outranked the fill, so the mark disappeared at the one moment it
// exists for. Two computed values compared against each other — no colour is
// named here, and a pixel is never snapshotted.
Then("today's cell is marked as the one I am on", async function () {
  const cell = this.page.locator(`${TODAY_CELL}.is-current`);
  await cell.waitFor({ state: "visible" });
  assert.equal(await cell.getAttribute("aria-current"), "page");
  await cell.hover();
  const paint = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.notEqual(
    paint,
    this.hoverPaint,
    "the day you are on is painted like any cell under the pointer",
  );
});

Then("no day is marked as the one I am on", async function () {
  assert.equal(await this.page.locator(`${CAL} .is-current`).count(), 0);
});

When("I follow today's cell", async function () {
  await this.follow(this.page.locator(TODAY_CELL));
});

When("I follow the calendar's month", async function () {
  await this.follow(this.page.locator(`${CAL} a.ol-cal-title`));
});
