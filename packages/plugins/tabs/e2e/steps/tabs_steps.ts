/**
 * THE TAB STRIP, driven and read.
 *
 * A tab is found by `data-tab` (its index in the strip) and asserted by
 * `data-tab-front`, `data-href` and `data-tab-dot` — facts, never a colour. A
 * menu entry is found by its role and its words, which are what a reader
 * picks it by.
 */

import assert from "node:assert/strict";

import { Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT, ZOOM } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

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
    const stored = await this.page.evaluate(() => localStorage.getItem("olai.tabs"));
    return stored === null ? [] : (JSON.parse(stored) as { tabs: Array<{ href?: string }> }).tabs.map((tab) => tab.href ?? "(front)");
  };
  try {
    await this.waitUntil(async () => JSON.stringify(await read()) === JSON.stringify(wanted), `the stored tab set to hold ${hrefs}`);
  } catch {
    throw new Error(`the stored tab set to hold ${hrefs}, and it holds ${JSON.stringify(await read())}`);
  }
});
