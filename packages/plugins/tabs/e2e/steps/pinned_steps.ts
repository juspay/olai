/** Geometry of the tabs in the bar and the reading beneath it. These checks
 * measure rendered boxes independently of the CSS tokens under test: the bar
 * is the one band above a page, the tabs stand inside it, and everything a
 * page pins clears the bar's bottom edge and nothing more. */
import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import {
  APP_HEADER, NODE, NODE_GUTTER, NODE_MENU,
  NODE_MENU_PANEL, NODE_MENU_ITEM, PANE_HEADER, TIP,
  ZOOM_TITLE, POLL_TIMEOUT, ZOOM,
} from "@olai/tests/harness/world.ts";
import type { Box, OlaiWorld } from "@olai/tests/harness/world.ts";
import { TESTID as LAYOUT_TESTID } from "olai-plugin-layout/testids";
import { selector } from "@olai/web/testlib";

import { TAB } from "../selectors.ts";

const stripOf = (world: OlaiWorld) => world.page.locator(selector(LAYOUT_TESTID.mainStrip));
const barBox = (world: OlaiWorld) => world.box(world.page.locator(APP_HEADER), "the bar");
const bottom = (box: Box): number => box.y + box.height;
const readingMenu = (world: OlaiWorld, pane: number, row: number) =>
  world.pane(pane).locator(`${NODE}${attr("data-node-id", `pinned-child-${row}`)} ${NODE_MENU}`);

/** THE TABS ARE IN THE BAR: the seat's box lies inside the header's, the
 *  header is at the top of the window, and the seat is what the pointer finds
 *  there — a page scrolling under the bar must not paint over a tab. */
Then("the tabs stand in the app header", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const header = await barBox(this);
    const strip = await stripOf(this).boundingBox();
    return strip !== null && strip.height > 0 && Math.abs(header.y) <= 1
      && strip.y >= header.y - 1 && bottom(strip) <= bottom(header) + 1;
  }, "the tabs to stand inside the bar at the top of the window");
  assert.ok(await stripOf(this).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + 12, box.y + box.height / 2));
  }), "the tabs must take the pointer above scrolling content");
});

/** THE TAB IN FRONT IS THE TOP OF ITS PAGE: its foot is the bar's foot, and
 *  at its foot the pointer finds the tab rather than the bar's hairline. */
Then("the front tab meets the page", async function (this: OlaiWorld) {
  const tab = this.page.locator(`${TAB}[data-tab-front="true"]`);
  const header = await barBox(this);
  const box = await this.box(tab, "the front tab");
  assert.ok(Math.abs(bottom(box) - bottom(header)) <= 1,
    `the front tab ends at y=${bottom(box)} and the bar at y=${bottom(header)}`);
  assert.ok(await tab.evaluate((element) => {
    const at = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(at.x + at.width / 2, at.bottom - 0.5));
  }), "the bar's hairline is drawn across the front tab's foot");
});

/** WHAT A JUMP CLEARS is the bar: one band, whatever the tabs are doing. */
Then("the main-column reserve equals the visible chrome", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const header = await barBox(this);
    const padding = await this.page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
    return Math.abs(padding - header.height) <= 2;
  }, "the reserve to be the bar's height, without reloading");
});

Then("the heading {string} lands just below the bar", async function (this: OlaiWorld, text: string) {
  const heading = this.documentBody().locator("h1, h2, h3, h4, h5, h6").filter({ hasText: text }).first();
  await this.waitUntil(async () => {
    const bar = await barBox(this);
    const box = await heading.boundingBox();
    return box !== null && box.y >= bottom(bar) - 1
      && box.y < bottom(bar) + 10 && await this.page.evaluate(() => scrollY > 0);
  }, "the heading jump to land just below the bar");
});

Then("the split fills the viewport below the bar", async function (this: OlaiWorld) {
  const bar = await barBox(this);
  const panes = await this.page.locator(PANE_HEADER).evaluateAll((elements) => elements.map((element) => {
    const box = element.parentElement!.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  const viewport = await this.page.evaluate(() => ({ height: innerHeight, total: document.documentElement.scrollHeight, scroll: scrollY }));
  assert.equal(panes.length, 2);
  for (const pane of panes) {
    assert.ok(Math.abs(pane.top - bottom(bar)) <= 2, JSON.stringify({ pane, bar }));
    assert.ok(Math.abs(pane.bottom - viewport.height) <= 2, JSON.stringify({ pane, viewport }));
  }
  assert.ok(viewport.total <= viewport.height + 2, JSON.stringify(viewport));
  assert.equal(viewport.scroll, 0);
});

Given("a long outline for pinned chrome", function (this: OlaiWorld) {
  this.writeServed("pinned-chrome.olai", [
    JSON.stringify({ id: "pinned-root", ord: "a0", title: "Pinned root" }),
    ...Array.from({ length: 80 }, (_, i) => JSON.stringify({
      id: `pinned-child-${i}`, parent: "pinned-root", ord: `a${String(i).padStart(2, "0")}`,
      title: `Reading row ${i}`,
    })),
  ].join("\n"));
});

Then("pane {int} pins its {word} heading to its scrollport", async function (this: OlaiWorld, index: number, kind: string) {
  const pane = this.pane(index);
  const heading = kind === "section"
    ? pane.locator(`${NODE}${attr("data-node-id", "pinned-root")} > ${NODE_GUTTER}`)
    : pane.locator(ZOOM_TITLE).locator("xpath=ancestor::header");
  await heading.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const port = await pane.evaluate(root => {
    let host = root.parentElement;
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement;
    if (!host) throw new Error("no pane scrollport");
    return { top: host.getBoundingClientRect().top, scrolled: host.scrollTop };
  });
  const box = await this.box(heading, `${kind} heading`);
  assert.ok(port.scrolled > 100, `pane must have scrolled: ${JSON.stringify(port)}`);
  assert.ok(Math.abs(box.y - port.top) <= 2, `heading must meet scrollport: ${JSON.stringify({ box, port })}`);
});

Then("the lone node header pins below the bar", async function (this: OlaiWorld) {
  const bar = await barBox(this);
  const header = await this.box(this.page.locator(ZOOM_TITLE).locator("xpath=ancestor::header"), "node header");
  assert.ok(await this.page.evaluate(() => scrollY > 100));
  assert.ok(Math.abs(header.y - bottom(bar)) <= 2, JSON.stringify({ header, bar }));
});

When("I position reading row {int} for an upward menu in pane {int}", async function (this: OlaiWorld, row: number, index: number) {
  const trigger = readingMenu(this, index, row);
  await trigger.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await trigger.evaluate(el => {
    let host = el.parentElement;
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement;
    const delta = el.getBoundingClientRect().top - (innerHeight - 90);
    if (host) host.scrollTop += delta;
    else window.scrollBy(0, delta);
  });
  await this.waitForFrame();
  await trigger.click();
  await this.page.locator(NODE_MENU_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the upward menu of reading row {int} in pane {int} clears the bar and uses the viewport reserve", async function (this: OlaiWorld, row: number, index: number) {
  const bar = await barBox(this);
  const menu = this.page.locator(NODE_MENU_PANEL);
  const trigger = readingMenu(this, index, row);
  await this.waitUntil(async () => {
    const box = await menu.boundingBox();
    const anchor = await trigger.boundingBox();
    return box !== null && anchor !== null && box.y + box.height <= anchor.y + 2
      && box.y >= bottom(bar) - 2 && box.y <= bottom(bar) + 12;
  }, "an upward menu whose first entry clears the bar");
  const inherited = await menu.evaluate(el => ({
    menu: getComputedStyle(el).getPropertyValue("--height-chrome"),
    root: getComputedStyle(document.documentElement).getPropertyValue("--height-chrome"),
  }));
  assert.equal(inherited.menu, inherited.root, "portal must escape the pane's zero offset");
  const first = await this.box(menu.locator(NODE_MENU_ITEM).first(), "first menu entry");
  assert.ok(first.y >= bottom(bar) - 2);
});

Given("a long blocked heading for a lifted tip", function (this: OlaiWorld) {
  this.writeServed("pinned-tip.olai", [
    JSON.stringify({ id: "pinned-root", ord: "a0", title: "Waiting section", todo: "2026-08-10", after: ["pinned-blocker"] }),
    ...Array.from({ length: 80 }, (_, i) => JSON.stringify({ id: `tip-child-${i}`, parent: "pinned-root", ord: `a${String(i).padStart(2, "0")}`, title: `Reading row ${i}` })),
    JSON.stringify({ id: "pinned-blocker", ord: "a1", title: Array.from({ length: 100 }, (_, i) => `unfinished prerequisite ${i}`).join(" "), todo: "2026-08-10" }),
  ].join("\n"));
});

When("I hover the blocked heading just below the bar", async function (this: OlaiWorld) {
  await this.within("pinned-root", ZOOM).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.evaluate(() => window.scrollTo(0, 500));
  await this.waitForFrame();
  const bar = await barBox(this);
  const trigger = this.within("pinned-root", ZOOM);
  const box = await this.box(trigger, "blocked heading control");
  assert.ok(box.y >= bottom(bar) - 2 && box.y < bottom(bar) + 50);
  await trigger.hover();
});

Then("the lifted tip stays below the bar", async function (this: OlaiWorld) {
  const tip = this.page.locator(TIP);
  await tip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const bar = await barBox(this);
  const box = await this.box(tip, "lifted tip");
  assert.ok(box.height > this.viewport().height - bottom(bar), "tip must be tall enough to exercise the floor");
  assert.ok(box.y >= bottom(bar) && box.y <= bottom(bar) + 6, JSON.stringify({ box, bar }));
});
