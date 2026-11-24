/**
 * THE COLUMN'S ORDER, and its controls that wait for a pointer.
 *
 * The sidebar reads in one order: where to go (Agenda, Today, Inbox), what
 * needs you, your things (Pinned, then the files), then conversations, then
 * plugins, with Trash at the foot. A step names the parts a person would name
 * and reads where each is drawn — the order is a fact about the screen, not
 * about the markup.
 *
 * Every `+` and chevron in the column is drawn while the pointer is in the
 * column, while the keyboard is on it, and always on a touch screen. At rest
 * the column is names and counts. Opacity is the claim: a transparent button
 * is still a button Playwright would call visible.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT, SIDEBAR, SIDEBAR_BODY } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { selector } from "@olai/web/testlib";

/** The column's parts, by the word on screen. A plugin section with no word of
 *  the app's own is named `the "<plugin>" section`. */
const PART: Readonly<Record<string, string>> = {
  Agenda: selector(PLUGIN_TESTID.agendaLink),
  Today: selector(PLUGIN_TESTID.calendarToday),
  Inbox: selector(PLUGIN_TESTID.inboxLink),
  "Needs you": selector(PLUGIN_TESTID.agentNeedsYou),
  Pinned: selector(PLUGIN_TESTID.pinShelf),
  Files: selector(PLUGIN_TESTID.sidebarFiles),
  Chats: selector(PLUGIN_TESTID.agentRoster),
  Plugins: selector(PLUGIN_TESTID.section),
  Trash: selector(PLUGIN_TESTID.trashLink),
};

const partOf = (name: string): string => {
  const section = /^the "([\w-]+)" section$/.exec(name);
  if (section !== null) return attr("data-plugin", section[1]!);
  const found = PART[name];
  if (found === undefined) {
    throw new Error(`no part of the column is called "${name}"; say one of ${Object.keys(PART).join(", ")}, or the "<plugin>" section`);
  }
  return found;
};

/** Where each named part's top edge is, in the order asked, read in one go so
 *  a column that scrolls cannot move between two readings. */
const topsOf = (world: OlaiWorld, parts: ReadonlyArray<string>): Promise<ReadonlyArray<number | null>> =>
  world.page.locator(SIDEBAR).evaluate((column, selectors) =>
    selectors.map((one) => {
      const found = column.querySelector(one);
      return found === null ? null : found.getBoundingClientRect().top;
    }), parts.map(partOf));

Then("the sidebar reads, top to bottom:", async function (this: OlaiWorld, table: { raw(): string[][] }) {
  const names = table.raw().map((row) => row[0] ?? "");
  await this.showSidebar();
  await this.page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const inOrder = async () => {
    const tops = await topsOf(this, names);
    return tops.every((top, i) => top !== null && (i === 0 || top > tops[i - 1]!));
  };
  await this.waitUntil(inOrder, `the sidebar to read ${names.join(", ")}`).catch(async () => {
    const tops = await topsOf(this, names);
    assert.fail(`the sidebar's parts stand at ${JSON.stringify(Object.fromEntries(names.map((name, i) => [name, tops[i]])))}, not in the order ${names.join(", ")}`);
  });
});

Then("the sidebar draws no {string}", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  await this.page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await this.page.locator(`${SIDEBAR} ${partOf(name)}`).count()) === 0,
    `the sidebar to draw no ${name}`);
});

// ── the controls that wait for a pointer ────────────────────────────────

/** The column's `+` buttons and chevrons, by what they are called. */
const CONTROL: Readonly<Record<string, string>> = {
  "New outline or document": selector(PLUGIN_TESTID.newFile),
  "New chat": selector(PLUGIN_TESTID.chatNew),
  "New plugin": selector(PLUGIN_TESTID.sectionNew),
  "Show month": selector(PLUGIN_TESTID.calendarToggle),
  "Show what is owed": selector(PLUGIN_TESTID.agendaFold),
};

const controlOf = (world: OlaiWorld, name: string) => {
  const found = CONTROL[name];
  if (found === undefined) throw new Error(`no control in the column is called "${name}"; say one of ${Object.keys(CONTROL).join(", ")}`);
  return world.page.locator(`${SIDEBAR} ${found}`).first();
};

const opacityOf = async (world: OlaiWorld, name: string): Promise<string> => {
  const control = controlOf(world, name);
  await control.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return control.evaluate((el) => getComputedStyle(el).opacity);
};

When("the pointer is away from the sidebar", async function (this: OlaiWorld) {
  const page = await this.box(this.frontLane(), "the page in front");
  await this.page.mouse.move(page.x + page.width - 4, page.y + page.height / 2);
  await this.waitForFrame();
});

When("the pointer is in the sidebar", async function (this: OlaiWorld) {
  const body = await this.box(this.page.locator(SIDEBAR_BODY), "the sidebar");
  await this.page.mouse.move(body.x + body.width / 2, body.y + 4);
  await this.waitForFrame();
});

Then("the sidebar's {string} control is not drawn", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(async () => (await opacityOf(this, name)) === "0", `the sidebar's "${name}" control to wait for a pointer`);
});

Then("the sidebar's {string} control is drawn", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(async () => (await opacityOf(this, name)) === "1", `the sidebar's "${name}" control to be drawn`);
});

/** `Tab` from the top of the document until the control has the keyboard — the
 *  path a keyboard takes, through the bar and down the column. */
When("I Tab to the sidebar's {string} control", async function (this: OlaiWorld, name: string) {
  const control = controlOf(this, name);
  await control.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  await this.page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });
  for (let presses = 0; presses < 60; presses++) {
    if (await control.evaluate((el) => el === document.activeElement)) return;
    await pressed(this, "Tab");
  }
  assert.fail(`sixty presses of Tab never reached the sidebar's "${name}" control`);
});

Then("the sidebar's {string} control has the keyboard, and is drawn", async function (this: OlaiWorld, name: string) {
  const control = controlOf(this, name);
  assert.ok(await control.evaluate((el) => el === document.activeElement && el.matches(":focus-visible")),
    `the keyboard is not on the sidebar's "${name}" control`);
  await this.waitUntil(async () => (await opacityOf(this, name)) === "1", `the sidebar's "${name}" control to be drawn while it has the keyboard`, POLL_TIMEOUT);
});
