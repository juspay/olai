/** Geometry of the occupied strip and the reading beneath it. These checks
 * measure rendered boxes independently of the CSS tokens under test. */
import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import {
  APP_HEADER, CHAT_PANEL, CHAT_TOGGLE, NODE, NODE_GUTTER, NODE_MENU,
  NODE_MENU_PANEL, NODE_MENU_ITEM, PANEL_RESIZE, PANE_HEADER, TIP,
  ZOOM_TITLE, POLL_TIMEOUT, ZOOM,
} from "@olai/tests/harness/world.ts";
import type { Box, OlaiWorld } from "@olai/tests/harness/world.ts";
import { PANEL_OPEN_KEY, PANEL_WIDTH_KEY, PANEL_MAX_PX } from "olai-plugin-layout/preferences";
import { TESTID as LAYOUT_TESTID } from "olai-plugin-layout/testids";
import { selector } from "@olai/web/testlib";

const stripOf = (world: OlaiWorld) => world.page.locator(selector(LAYOUT_TESTID.mainStrip));
const stripBox = (world: OlaiWorld) => world.box(stripOf(world), "the strip");
const bottom = (box: Box): number => box.y + box.height;
const readingMenu = (world: OlaiWorld, pane: number, row: number) =>
  world.pane(pane).locator(`${NODE}${attr("data-node-id", `pinned-child-${row}`)} ${NODE_MENU}`);

const chromeBoxes = async (world: OlaiWorld) => {
  const header = await world.box(world.page.locator(APP_HEADER), "the header");
  const strip = stripOf(world);
  return { header, strip: await strip.count() ? await world.box(strip, "the strip") : undefined };
};

Then("the tab strip is pinned below the app header", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const { header, strip } = await chromeBoxes(this);
    return strip !== undefined && Math.abs(strip.y - bottom(header)) <= 2
      && strip.height > 0 && bottom(strip) < (this.page.viewportSize()?.height ?? 0);
  }, "the strip to pin directly below the header");
  const strip = stripOf(this);
  assert.ok(await strip.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + 12, box.y + box.height / 2));
  }), "the strip must take the pointer above scrolling content");
});

Then("the main-column reserve equals the visible chrome", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const { header, strip } = await chromeBoxes(this);
    const padding = await this.page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
    return Math.abs(padding - header.height - (strip?.height ?? 0)) <= 2;
  }, "the derived root token to track the occupied strip without reloading");
});

Then("the heading {string} lands below the tab strip", async function (this: OlaiWorld, text: string) {
  const heading = this.documentBody().locator("h1, h2, h3, h4, h5, h6").filter({ hasText: text }).first();
  await this.waitUntil(async () => {
    const { strip } = await chromeBoxes(this);
    const box = await heading.boundingBox();
    return strip !== undefined && box !== null && box.y >= bottom(strip) - 1
      && box.y < bottom(strip) + 10 && await this.page.evaluate(() => scrollY > 0);
  }, "the heading jump to land just below the strip");
});

Then("the split fills the viewport below the tab strip", async function (this: OlaiWorld) {
  const strip = await stripBox(this);
  const panes = await this.page.locator(PANE_HEADER).evaluateAll((elements) => elements.map((element) => {
    const box = element.parentElement!.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  const viewport = await this.page.evaluate(() => ({ height: innerHeight, total: document.documentElement.scrollHeight, scroll: scrollY }));
  assert.equal(panes.length, 2);
  for (const pane of panes) {
    assert.ok(Math.abs(pane.top - bottom(strip)) <= 2, JSON.stringify({ pane, strip }));
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

Then("the lone node header pins below the strip", async function (this: OlaiWorld) {
  const strip = await stripBox(this);
  const header = await this.box(this.page.locator(ZOOM_TITLE).locator("xpath=ancestor::header"), "node header");
  assert.ok(await this.page.evaluate(() => scrollY > 100));
  assert.ok(Math.abs(header.y - bottom(strip)) <= 2, JSON.stringify({ header, strip }));
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

Then("the upward menu of reading row {int} in pane {int} clears the strip and uses the viewport reserve", async function (this: OlaiWorld, row: number, index: number) {
  const strip = await stripBox(this);
  const menu = this.page.locator(NODE_MENU_PANEL);
  const trigger = readingMenu(this, index, row);
  await this.waitUntil(async () => {
    const box = await menu.boundingBox();
    const anchor = await trigger.boundingBox();
    return box !== null && anchor !== null && box.y + box.height <= anchor.y + 2
      && box.y >= bottom(strip) - 2 && box.y <= bottom(strip) + 12;
  }, "an upward menu whose first entry clears the strip");
  const inherited = await menu.evaluate(el => ({
    menu: getComputedStyle(el).getPropertyValue("--height-chrome"),
    root: getComputedStyle(document.documentElement).getPropertyValue("--height-chrome"),
  }));
  assert.equal(inherited.menu, inherited.root, "portal must escape the pane's zero offset");
  const first = await this.box(menu.locator(NODE_MENU_ITEM).first(), "first menu entry");
  assert.ok(first.y >= bottom(strip) - 2);
});

Given("a long blocked heading for a lifted tip", function (this: OlaiWorld) {
  this.writeServed("pinned-tip.olai", [
    JSON.stringify({ id: "pinned-root", ord: "a0", title: "Waiting section", todo: "2026-08-10", after: ["pinned-blocker"] }),
    ...Array.from({ length: 80 }, (_, i) => JSON.stringify({ id: `tip-child-${i}`, parent: "pinned-root", ord: `a${String(i).padStart(2, "0")}`, title: `Reading row ${i}` })),
    JSON.stringify({ id: "pinned-blocker", ord: "a1", title: Array.from({ length: 100 }, (_, i) => `unfinished prerequisite ${i}`).join(" "), todo: "2026-08-10" }),
  ].join("\n"));
});

When("I hover the blocked heading just below the strip", async function (this: OlaiWorld) {
  await this.within("pinned-root", ZOOM).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.evaluate(() => window.scrollTo(0, 500));
  await this.waitForFrame();
  const strip = await stripBox(this);
  const trigger = this.within("pinned-root", ZOOM);
  const box = await this.box(trigger, "blocked heading control");
  assert.ok(box.y >= bottom(strip) - 2 && box.y < bottom(strip) + 50);
  await trigger.hover();
});

Then("the lifted tip stays below the strip", async function (this: OlaiWorld) {
  const tip = this.page.locator(TIP);
  await tip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const strip = await stripBox(this);
  const box = await this.box(tip, "lifted tip");
  assert.ok(box.height > this.viewport().height - bottom(strip), "tip must be tall enough to exercise the floor");
  assert.ok(box.y >= bottom(strip) && box.y <= bottom(strip) + 6, JSON.stringify({ box, strip }));
});

Given("legacy dock preferences are open and {word}", async function (this: OlaiWorld, width: string) {
  await this.page.addInitScript(({ openKey, widthKey, px }) => {
    localStorage.setItem(openKey, "true");
    localStorage.setItem(widthKey, String(px));
  }, { openKey: PANEL_OPEN_KEY, widthKey: PANEL_WIDTH_KEY, px: width === "maximum" ? PANEL_MAX_PX : 600 });
});

Then("chat remains in the reading below the strip with no dock", async function (this: OlaiWorld) {
  const chat = this.page.locator(CHAT_PANEL);
  await chat.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const strip = await stripBox(this);
  const box = await this.box(chat, "inline chat");
  assert.ok(box.y >= bottom(strip) && box.x >= strip.x - 2
    && box.x + box.width <= strip.x + strip.width + 2, JSON.stringify({ box, strip }));
  assert.equal(await chat.evaluate(el => getComputedStyle(el).position), "static");
  assert.equal(await this.page.locator(PANEL_RESIZE).count(), 0);
  assert.equal(await this.page.locator(CHAT_TOGGLE).count(), 0);
});
