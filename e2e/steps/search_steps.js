// The search palette: opening it, typing in it, and walking what it found.
//
// Every wait here is a wait on the DOM. The box debounces and fetches its own
// results (the live-query attributes web/search draws), so a step that slept
// would be racing a swap; the locators below auto-wait for the markup that
// swap brings, which is the same wait spelled honestly.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

// The palette's own state, as an attribute: `hidden` is what the server draws
// and what search.js flips, so there is one word for closed and both sides
// spell it.
const PANEL = "[data-search-panel]";
const OPEN = `${PANEL}:not([hidden])`;
const BOX = `${PANEL} .ol-search-input`;
const HIT = "[data-search-hit]";

// The way in that is not a keystroke: a row in the sidebar, where the other
// ways around the outline are. Nothing of the palette is on the screen until
// it is asked for, so there is nothing else to press.
const TOGGLE = ".ol-sidebar-nav [data-search-toggle]";

// ---- opening it -------------------------------------------------------------

When("I press slash", async function () {
  await this.page.keyboard.press("/");
});

When("I press the search button", async function () {
  await this.page.locator(TOGGLE).click();
});

When("I open the search page for {string}", async function (query) {
  await this.open(`/search?q=${encodeURIComponent(query)}`);
});

// Whatever state the palette is in, this leaves it open with `query` typed and
// the hits for it on the way: what a scenario means by "search for" is the
// act, not the four gestures it takes.
When("I search for {string}", async function (query) {
  if (await this.page.locator(OPEN).count() === 0) {
    await this.page.locator(TOGGLE).click();
  }
  await this.page.locator(BOX).fill(query);
});

// ---- the keyboard -----------------------------------------------------------

When("I press the down arrow", async function () {
  await this.page.keyboard.press("ArrowDown");
});

When("I press escape", async function () {
  await this.page.keyboard.press("Escape");
});

// Enter from the BOX means the first hit, and Enter on a hit is the browser
// following a link. Both land on a node, so both wait for the swap the same
// way a click does (world.settle).
When("I press Enter in the search box", async function () {
  await this.settle(() => this.page.keyboard.press("Enter"));
});

When("I press Enter on the focused hit", async function () {
  await this.settle(() => this.page.keyboard.press("Enter"));
});

When("I tap the first hit", async function () {
  await this.follow(this.page.locator(HIT).first());
});

// ---- what it says -----------------------------------------------------------

Then("the search box has the focus", async function () {
  await this.page.locator(OPEN).waitFor({ state: "visible" });
  const focused = await this.page.evaluate(
    (sel) => document.activeElement === document.querySelector(sel), BOX);
  assert.equal(focused, true, "the box is open but nothing is typing into it");
});

Then("the search palette is open", async function () {
  await this.page.locator(OPEN).waitFor({ state: "visible" });
});

Then("the search palette is closed", async function () {
  await this.page.locator(OPEN).waitFor({ state: "detached" });
});

Then("the search results name {string}", async function (title) {
  await this.page
    .locator(HIT, { hasText: title })
    .first()
    .waitFor({ state: "visible" });
});

Then("the search says nothing matches", async function () {
  await this.page.locator(".ol-search-empty").filter({ hasText: "No node matches" })
    .waitFor({ state: "visible" });
});

// A hit found by its note shows the note: the line under the title is what the
// query landed in, and a hit found by its title does not carry one.
Then("the hit shows the note it was found by", async function () {
  await this.page.locator(`${HIT} .ol-search-note`).first()
    .waitFor({ state: "visible" });
});

// The focused hit IS the picked one — there is no class of ours to read, which
// is the whole point of moving the browser's focus rather than a highlight.
Then("the second hit has the focus", async function () {
  const which = await this.page.evaluate((sel) => {
    const hits = [...document.querySelectorAll(sel)];
    return hits.indexOf(document.activeElement);
  }, HIT);
  assert.equal(which, 1, `the focus is on hit ${which}, not the second one`);
});

// ---- the same palette, on a phone -------------------------------------------

Then("every search control is at least {int} pixels tall", async function (px) {
  const controls = await this.page.evaluate((sel) =>
    [...document.querySelectorAll(`${sel} button, ${sel} input`)]
      .map((el) => ({ what: (el.textContent || el.placeholder || "").trim(),
                      h: Math.round(el.getBoundingClientRect().height) }))
      .filter((c) => c.h > 0), PANEL);
  const under = controls.filter((c) => c.h < px);
  assert.deepEqual(under, [], `${under.map((c) => `"${c.what}" is ${c.h}px`).join(", ")}`);
});

Then("the search box is at least {int} pixels of type", async function (px) {
  const size = await this.page.evaluate(
    (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize), BOX);
  assert.ok(size >= px, `the box's type is ${size}px, under the ${px}px iOS zooms at`);
});

Then("the search palette fits the screen", async function () {
  const m = await this.page.evaluate((sel) => {
    const box = document.querySelector(sel).getBoundingClientRect();
    return { left: box.left, right: box.right, screen: window.innerWidth };
  }, PANEL);
  assert.ok(m.left >= 0 && m.right <= m.screen,
    `the palette runs from ${m.left}px to ${m.right}px on a ${m.screen}px screen`);
});
