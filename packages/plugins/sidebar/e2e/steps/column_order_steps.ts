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
 * the column is names and counts. Opacity is the claim
 * (`@olai/tests/harness/paint.ts`).
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { opacityOf } from "@olai/tests/harness/paint.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT, SIDEBAR, SIDEBAR_BODY, SIDEBAR_FOOT } from "@olai/tests/harness/world.ts";
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

/** One named part as the column draws it: its top edge, and — when it is
 *  pinned in the foot rather than in the scrolling list — where the foot
 *  starts. `null` when the part is not drawn at all. */
type Part = { readonly top: number; readonly foot: number | null } | null;

/** The column read once: where the scrolling list's box ends, and each part. */
type Column = { readonly listEnd: number; readonly parts: ReadonlyArray<Part> };

/** Every named part, and where the scrolling list's box ends, read in one go
 *  so a column that scrolls cannot move between two readings. */
const readColumn = (world: OlaiWorld, parts: ReadonlyArray<string>): Promise<Column> =>
  world.page.locator(SIDEBAR).evaluate((column, [selectors, body, foot]) => ({
    listEnd: column.querySelector(body)?.getBoundingClientRect().bottom ?? Number.NaN,
    parts: selectors.map((one) => {
      const found = column.querySelector(one);
      if (found === null) return null;
      const pinned = found.closest(foot);
      return { top: found.getBoundingClientRect().top, foot: pinned === null ? null : pinned.getBoundingClientRect().top };
    }),
  }), [parts.map(partOf), SIDEBAR_BODY, SIDEBAR_FOOT] as const);

/** The last part of one kind read so far: what the next one is compared with. */
type Last = { readonly name: string; readonly top: number } | null;

/** What is wrong with the order asked, or `null` when the column reads in it.
 *
 *  TWO KINDS OF PART, asked two different things. The scrolling list's parts
 *  share one scroller, so their tops stand in order even below the fold, and
 *  they are compared with each other. A part pinned in the foot (Trash) is
 *  not on that scale at all — the list scrolls UNDER it, so its top is above
 *  a heading the reader has not scrolled to yet — and what is true of it is
 *  that it is in the foot, and that the foot starts where the list's box ends
 *  or below. A foot part therefore comes after every list part in the table,
 *  and a table that names one before a list part is the wrong order. */
const misreading = (names: ReadonlyArray<string>, column: Column): string | null => {
  let listTop: Last = null;
  let footTop: Last = null;
  for (const [i, name] of names.entries()) {
    const part = column.parts[i];
    if (part === null || part === undefined) return `${name} is not drawn`;
    if (part.foot === null) {
      if (footTop !== null) return `${name} is in the scrolling list, and ${footTop.name}, asked for before it, is pinned in the foot`;
      if (listTop !== null && part.top <= listTop.top) return `${name} stands above ${listTop.name}`;
      listTop = { name, top: part.top };
    } else {
      if (!(part.foot >= column.listEnd - 1)) return `${name}'s foot starts at ${part.foot}, above where the list's box ends (${column.listEnd})`;
      if (footTop !== null && part.top <= footTop.top) return `${name} stands above ${footTop.name} in the foot`;
      footTop = { name, top: part.top };
    }
  }
  return null;
};

Then("the sidebar reads, top to bottom:", async function (this: OlaiWorld, table: { raw(): string[][] }) {
  const names = table.raw().map((row) => row[0] ?? "");
  await this.showSidebar();
  await this.page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => misreading(names, await readColumn(this, names)) === null,
    `the sidebar to read ${names.join(", ")}`).catch(async () => {
    const column = await readColumn(this, names);
    assert.fail(`the sidebar's parts stand at ${JSON.stringify(Object.fromEntries(names.map((name, i) => [name, column.parts[i]])))}, list ending at ${column.listEnd}: ${misreading(names, column) ?? "in order now"}, not in the order ${names.join(", ")}`);
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

const controlOpacity = async (world: OlaiWorld, name: string): Promise<string> => {
  const control = controlOf(world, name);
  await control.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return opacityOf(control);
};

When("the pointer is in the sidebar", async function (this: OlaiWorld) {
  const body = await this.box(this.page.locator(SIDEBAR_BODY), "the sidebar");
  await this.page.mouse.move(body.x + body.width / 2, body.y + 4);
  await this.waitForFrame();
});

Then("the sidebar's {string} control is not drawn", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(async () => (await controlOpacity(this, name)) === "0", `the sidebar's "${name}" control to wait for a pointer`);
});

Then("the sidebar's {string} control is drawn", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(async () => (await controlOpacity(this, name)) === "1", `the sidebar's "${name}" control to be drawn`);
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
  await this.waitUntil(async () => (await controlOpacity(this, name)) === "1", `the sidebar's "${name}" control to be drawn while it has the keyboard`, POLL_TIMEOUT);
});
