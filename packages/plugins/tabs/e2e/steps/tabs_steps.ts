/**
 * THE TAB STRIP, driven and read.
 *
 * A tab is found by `data-tab` (its index in the strip) and asserted by
 * `data-tab-front`, `data-href` and `data-tab-dot` — facts, never a colour. A
 * menu entry is found by its role and its words, which are what a reader
 * picks it by.
 */

import assert from "node:assert/strict";

import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { APP_HEADER, CHAT_PANEL, CHAT_TOGGLE, NODE, NODE_GUTTER, NODE_MENU, NODE_MENU_PANEL, NODE_MENU_ITEM, PANEL_RESIZE, PANE_HEADER, TIP, ZOOM_TITLE, HYDRATION_TIMEOUT, POLL_TIMEOUT, ZOOM } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { PANEL_OPEN_KEY, PANEL_WIDTH_KEY, PANEL_MAX_PX } from "../../../layout/src/layout/prefs.ts";
import { MAIN_STRIP } from "../../../layout/e2e/selectors.ts";

import { TABS_KEY } from "../../src/persist.ts";
import { ADDRESS, CLOSE, DOT, MENU, NEW, SHORTCUT, STRIP, TAB } from "../selectors.ts";

const tabAt = (world: OlaiWorld, index: number) => world.page.locator(`${TAB}${attr("data-tab", String(index))}`);

const tabsNow = async (world: OlaiWorld) =>
  world.page.locator(TAB).evaluateAll((faces) => faces.map((face) => ({
    href: face.getAttribute("data-href"),
    front: face.getAttribute("data-tab-front") === "true",
    title: face.getAttribute("title"),
  })));

/** Wait for the strip to say something, and say what it held when it would not. */
const untilTabs = async (
  world: OlaiWorld,
  holds: (tabs: Awaited<ReturnType<typeof tabsNow>>) => boolean,
  what: string,
): Promise<void> => {
  try {
    await world.waitUntil(async () => holds(await tabsNow(world)), what);
  } catch {
    throw new Error(`${what}, and the strip holds ${JSON.stringify(await tabsNow(world))}`);
  }
};

const settled = async (world: OlaiWorld): Promise<void> => {
  await world.waitForFrame();
};

// ── what the strip draws ───────────────────────────────────────────────

Then("there {word} {int} tab(s)", async function (this: OlaiWorld, _are: string, count: number) {
  await this.page.locator(STRIP).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await this.page.locator(TAB).count()) === count, `the strip to hold ${count} tabs`);
});

Then("tab {int} is in front", async function (this: OlaiWorld, index: number) {
  await untilTabs(this, (tabs) => tabs.filter((tab) => tab.front).length === 1 && tabs[index]?.front === true,
    `tab ${index} to be the one in front`);
});

Then("tab {int} holds {string}", async function (this: OlaiWorld, index: number, href: string) {
  await untilTabs(this, (tabs) => tabs[index]?.href === href, `tab ${index} to hold ${href}`);
});

Then("tab {int} holds the address in the bar", async function (this: OlaiWorld, index: number) {
  await untilTabs(this, (tabs) => tabs[index]?.href === this.address(), `tab ${index} to hold the address ${this.address()}`);
});

Then("tab {int} is titled {string}", async function (this: OlaiWorld, index: number, title: string) {
  await untilTabs(this, (tabs) => tabs[index]?.title === title, `tab ${index} to be titled ${title}`);
});

Then("the tabs hold {string}", async function (this: OlaiWorld, hrefs: string) {
  const wanted = hrefs.split(" ");
  await untilTabs(this, (tabs) => JSON.stringify(tabs.map((tab) => tab.href)) === JSON.stringify(wanted),
    `the tabs to hold ${hrefs}`);
});

Then("the tab strip reads the address {string}", async function (this: OlaiWorld, href: string) {
  await this.waitUntil(async () => (await this.page.locator(ADDRESS).innerText()).trim() === href, `the strip's address to read ${href}`);
});

Then("there is no tab strip", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await this.page.locator(STRIP).count()) === 0, "no tab strip in the document");
});

Then("tab {int} wears the needs-you dot", async function (this: OlaiWorld, index: number) {
  await tabAt(this, index).locator(DOT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("tab {int} wears no dot", async function (this: OlaiWorld, index: number) {
  await this.waitUntil(async () => (await tabAt(this, index).locator(DOT).count()) === 0, `tab ${index} to wear no dot`);
});

// ── pressing it ────────────────────────────────────────────────────────

When("I press tab {int}", async function (this: OlaiWorld, index: number) {
  const tab = tabAt(this, index);
  await tab.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await tab.click({ position: { x: 12, y: 12 } });
  await settled(this);
});

When("I middle-click tab {int}", async function (this: OlaiWorld, index: number) {
  const tab = tabAt(this, index);
  await tab.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await tab.click({ button: "middle", position: { x: 12, y: 12 } });
  await settled(this);
});

When("I close tab {int} with its button", async function (this: OlaiWorld, index: number) {
  const tab = tabAt(this, index);
  await tab.hover();
  await tab.locator(CLOSE).click();
  await settled(this);
});

When("I press the new tab button", async function (this: OlaiWorld) {
  await this.page.locator(NEW).click();
  await settled(this);
});

When("I choose {string} from the menu of tab {int}", async function (this: OlaiWorld, entry: string, index: number) {
  const tab = tabAt(this, index);
  await tab.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await tab.click({ button: "right", position: { x: 12, y: 12 } });
  await chooseFromMenu(this, entry);
});

When("I drag tab {int} onto tab {int}", async function (this: OlaiWorld, from: number, to: number) {
  const source = await tabAt(this, from).boundingBox();
  const target = await tabAt(this, to).boundingBox();
  assert.ok(source !== null && target !== null, "a tab to drag has no box");
  await this.page.mouse.move(source.x + 12, source.y + source.height / 2);
  await this.page.mouse.down();
  await this.page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await this.page.mouse.up();
  await settled(this);
});

// ── the link menu ──────────────────────────────────────────────────────

const chooseFromMenu = async (world: OlaiWorld, entry: string): Promise<void> => {
  const menu = world.page.locator(MENU);
  await menu.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await menu.getByRole("menuitem", { name: entry, exact: true }).click();
  await world.page.locator(MENU).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  await settled(world);
};

When("I choose {string} from the menu of the outline link {string}", async function (this: OlaiWorld, entry: string, file: string) {
  await this.showSidebar();
  const link = this.outlineLink(file);
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await link.click({ button: "right" });
  await chooseFromMenu(this, entry);
});

When("I choose {string} from the menu of the document link {string}", async function (this: OlaiWorld, entry: string, file: string) {
  await this.showSidebar();
  await this.expandReference();
  const link = this.documentLink(file);
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await link.click({ button: "right" });
  await chooseFromMenu(this, entry);
});

Then("right-clicking the bullet of {string} opens no tab menu", async function (this: OlaiWorld, id: string) {
  // The bullet is a link INSIDE the row's line, which owns the menu a press on
  // it opens (`data-menu-owner`), so the page-wide link menu leaves it alone.
  const bullet = this.within(id, ZOOM);
  await bullet.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.ok(await bullet.evaluate((link) => link.closest("[data-menu-owner]") !== null), "the bullet is not inside a row that owns its menu");
  await bullet.click({ button: "right" });
  await this.waitForFrame();
  assert.equal(await this.page.locator(MENU).count(), 0, "a tab menu opened over a row that owns its menu");
});

When("I widen the window to a desk", async function (this: OlaiWorld) {
  // The laptop the suite lays out at, back from a phone-width visit.
  await this.page.setViewportSize({ width: 1440, height: 900 });
  await this.waitForFrame();
});

// ── keys ───────────────────────────────────────────────────────────────

const CHORDS: Readonly<Record<string, string>> = {
  "next tab": "ControlOrMeta+Shift+Period",
  "previous tab": "ControlOrMeta+Shift+Comma",
  "new tab": "ControlOrMeta+Shift+o",
  "close tab": "ControlOrMeta+Shift+x",
};

When("I press the {string} chord", async function (this: OlaiWorld, name: string) {
  const chord = CHORDS[name];
  assert.ok(chord !== undefined, `no chord is called "${name}"`);
  await pressed(this, chord);
  await settled(this);
});

Then("the shortcuts list {string} as {string}", async function (this: OlaiWorld, what: string, keys: string) {
  await this.page.locator(SHORTCUT).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const rows = await this.page.locator(SHORTCUT).evaluateAll((items) =>
    items.map((item) => [item.querySelector("span")?.textContent?.trim(), item.querySelector("kbd")?.textContent?.trim()]));
  assert.ok(
    rows.some(([said, spelled]) => said === what && spelled === keys),
    `the shortcuts sheet does not list "${what}" as "${keys}"; it lists ${JSON.stringify(rows)}`,
  );
});

// ── what is kept ───────────────────────────────────────────────────────

/** The stored set, in strip order: a background tab by its address, and the
 *  tab in front as `(front)` — it is kept without one, since the address bar
 *  supplies it when the set is read back. */
Then("the stored tabs hold {string}", async function (this: OlaiWorld, hrefs: string) {
  const wanted = hrefs.split(" ");
  const read = async () => {
    const stored = await this.page.evaluate((key) => localStorage.getItem(key), TABS_KEY);
    return stored === null ? [] : (JSON.parse(stored) as { tabs: Array<{ href?: string }> }).tabs.map((tab) => tab.href ?? "(front)");
  };
  try {
    await this.waitUntil(async () => JSON.stringify(await read()) === JSON.stringify(wanted), `the stored tab set to hold ${hrefs}`);
  } catch {
    throw new Error(`the stored tab set to hold ${hrefs}, and it holds ${JSON.stringify(await read())}`);
  }
});

// Geometry is measured from the rendered chrome, independently of its tokens.
const chromeBoxes = async (world: OlaiWorld) => {
  const header = await world.box(world.page.locator(APP_HEADER), "the header");
  const strip = world.page.locator(MAIN_STRIP);
  return { header, strip: await strip.count() ? await world.box(strip, "the strip") : undefined };
};

Then("the tab strip is pinned below the app header", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const { header, strip } = await chromeBoxes(this);
    return strip !== undefined && Math.abs(strip.y - header.y - header.height) <= 2
      && strip.height > 0 && strip.y + strip.height < (this.page.viewportSize()?.height ?? 0);
  }, "the strip to pin directly below the header");
  const strip = this.page.locator(MAIN_STRIP);
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
    return strip !== undefined && box !== null && box.y >= strip.y + strip.height - 1
      && box.y < strip.y + strip.height + 10 && await this.page.evaluate(() => scrollY > 0);
  }, "the heading jump to land just below the strip");
});

Then("the split fills the viewport below the tab strip", async function (this: OlaiWorld) {
  const { strip } = await chromeBoxes(this);
  assert.ok(strip);
  const panes = await this.page.locator(PANE_HEADER).evaluateAll((elements) => elements.map((element) => {
    const box = element.parentElement!.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  const viewport = await this.page.evaluate(() => ({ height: innerHeight, total: document.documentElement.scrollHeight, scroll: scrollY }));
  assert.equal(panes.length, 2);
  for (const pane of panes) {
    assert.ok(Math.abs(pane.top - strip.y - strip.height) <= 2, JSON.stringify({ pane, strip }));
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
  const { strip } = await chromeBoxes(this);
  assert.ok(strip);
  const header = await this.box(this.page.locator(ZOOM_TITLE).locator("xpath=ancestor::header"), "node header");
  assert.ok(await this.page.evaluate(() => scrollY > 100));
  assert.ok(Math.abs(header.y - strip.y - strip.height) <= 2, JSON.stringify({ header, strip }));
});

When("I position reading row {int} for an upward menu in pane {int}", async function (this: OlaiWorld, row: number, index: number) {
  const trigger = this.pane(index).locator(`${NODE}${attr("data-node-id", `pinned-child-${row}`)} ${NODE_MENU}`);
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

Then("the upward menu in pane {int} clears the strip and uses the viewport reserve", async function (this: OlaiWorld, index: number) {
  const { strip } = await chromeBoxes(this);
  assert.ok(strip);
  const menu = this.page.locator(NODE_MENU_PANEL);
  const trigger = this.pane(index).locator(`${NODE}${attr("data-node-id", "pinned-child-20")} ${NODE_MENU}`);
  await this.waitUntil(async () => {
    const box = await menu.boundingBox();
    const anchor = await trigger.boundingBox();
    return box !== null && anchor !== null && box.y + box.height <= anchor.y + 2
      && box.y >= strip.y + strip.height - 2 && box.y <= strip.y + strip.height + 12;
  }, "an upward menu whose first entry clears the strip");
  const inherited = await menu.evaluate(el => ({
    menu: getComputedStyle(el).getPropertyValue("--height-chrome"),
    root: getComputedStyle(document.documentElement).getPropertyValue("--height-chrome"),
  }));
  assert.equal(inherited.menu, inherited.root, "portal must escape the pane's zero offset");
  const first = await this.box(menu.locator(NODE_MENU_ITEM).first(), "first menu entry");
  assert.ok(first.y >= strip.y + strip.height - 2);
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
  const { strip } = await chromeBoxes(this);
  assert.ok(strip);
  const trigger = this.within("pinned-root", ZOOM);
  const box = await this.box(trigger, "blocked heading control");
  assert.ok(box.y >= strip.y + strip.height - 2 && box.y < strip.y + strip.height + 50);
  await trigger.hover();
});

Then("the lifted tip stays below the strip", async function (this: OlaiWorld) {
  const tip = this.page.locator(TIP);
  await tip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const { strip } = await chromeBoxes(this);
  assert.ok(strip);
  const box = await this.box(tip, "lifted tip");
  assert.ok(box.height > this.viewport().height - strip.y - strip.height, "tip must be tall enough to exercise the floor");
  assert.ok(box.y >= strip.y + strip.height && box.y <= strip.y + strip.height + 6, JSON.stringify({ box, strip }));
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
  const { strip } = await chromeBoxes(this);
  assert.ok(strip);
  const box = await this.box(chat, "inline chat");
  assert.ok(box.y >= strip.y + strip.height && box.x >= strip.x - 2
    && box.x + box.width <= strip.x + strip.width + 2, JSON.stringify({ box, strip }));
  assert.equal(await chat.evaluate(el => getComputedStyle(el).position), "static");
  assert.equal(await this.page.locator(PANEL_RESIZE).count(), 0);
  assert.equal(await this.page.locator(CHAT_TOGGLE).count(), 0);
});
