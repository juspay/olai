/**
 * THE OWED ROWS UNDER THE DOOR — the column's own list of what slipped.
 *
 * Two things these steps are careful about, both the suite's standing rules:
 * what a row IS is asked as a `data-` fact (`data-node-id`, `data-when`,
 * `data-date`, and the dot's `data-mark` for its shape) rather than as the
 * classes that paint it, and "today" is asked of the clock with the client's
 * own function (`@olai/web/testlib`'s `isoDayOf`) rather than re-spelled — a
 * suite doing its own calendar arithmetic would disagree with the browser at
 * exactly midnight.
 *
 * The FELT WORD is the one assertion that has to ask the app's own reading
 * (`@olai/format`'s `feltOn`) for what it expects: the fixtures are dated in
 * 2019, so the words are "seven years ago" today and something else next year,
 * and a scenario that pinned one of them would expire. What that step checks is
 * therefore the WIRING — that each late row names its own day, in the spine's
 * vocabulary, from the day it is drawn for — while the wording itself is pinned
 * by the scenario that writes yesterday's work and asks for "Yesterday".
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { feltOn, shiftDay } from "@olai/format";
import { isoDayOf } from "@olai/web/testlib";

import { attr, expectAbsent, expectDrawn, HYDRATION_TIMEOUT, oneLine, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import { AGENDA_FOLD, AGENDA_MORE, AGENDA_OWED, AGENDA_ROW, AGENDA_ROWS } from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** The one row for a node — the list is drawn from `work.olai` and `life.olai`
 *  both, so a row is gripped by the node it stands for, never by its title. */
const rowOf = (id: string): string => `${AGENDA_ROW}${attr("data-node-id", id)}`;

/** The dot of a row, which is `aria-hidden` and carries only its shape. */
const dotOf = (id: string): string => `${rowOf(id)} [data-mark]`;

// ── what is drawn ──────────────────────────────────────────────────────

/**
 * Every row, in DOM order, by the node each one is — the membership and the
 * order are one promise here, as they are on the page.
 *
 * WAITED FOR, not read once: a row written while the page is open arrives on
 * the next revision the store publishes, and a list read the instant the file
 * lands would be the previous frame's answer.
 */
Then(
  "the column's agenda rows are {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.showSidebar();
    await expectDrawn(this, this.page.locator(AGENDA_ROW), "data-node-id", expected);
  },
);

/** The cap, read as a count: the list stops at what the door can hold, whatever
 *  the history behind it. Exact rather than "at most", because a list that drew
 *  fewer than it can would be a list quietly dropping work. */
Then("the column draws {int} agenda rows", async function (this: OlaiWorld, count: number) {
  await this.showSidebar();
  const rows = this.page.locator(AGENDA_ROW);
  await rows.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => (await rows.count()) === count,
    `the column to draw ${count} owed rows`,
  );
});

/** The way on: the line that says how many did not fit, and where they are. */
Then("the column says {string}", async function (this: OlaiWorld, said: string) {
  await this.showSidebar();
  const more = this.page.locator(AGENDA_MORE);
  await more.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => oneLine(await more.innerText()) === said,
    `the column to say "${said}"`,
  );
});

/** Nothing of the list at all — the quiet face, the agenda in front, or the
 *  reader's fold. Read after the door is drawn, so an absence is not simply a
 *  column that has not painted yet. */
Then("the column draws no agenda rows", async function (this: OlaiWorld) {
  await this.showSidebar();
  await expectAbsent(this, AGENDA_OWED, AGENDA_ROWS, "the column draws owed rows under the door");
});

/** ...and no chevron either: a control with nothing to fold is the failure the
 *  absence of the list is supposed to be. */
Then("the column draws no fold", async function (this: OlaiWorld) {
  await this.showSidebar();
  await expectAbsent(this, AGENDA_OWED, AGENDA_FOLD, "the column offers to fold a list it has not drawn");
});

// ── what one row says ─────────────────────────────────────────────────

/** The dot's SHAPE, which is the promise: a filled mark for late work, a ring
 *  for today's. The colour is paint and is not asked about. */
Then(
  "the column's row {string} wears a {word} mark",
  async function (this: OlaiWorld, id: string, shape: string) {
    await this.showSidebar();
    const dot = this.page.locator(dotOf(id));
    await dot.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await dot.getAttribute("data-mark"),
      shape,
      `the dot on "${id}" is not a ${shape}`,
    );
  },
);

/** A row's whole text: its title, and the felt word after it where there is
 *  one. Exact, because "nothing after a today row" is as much of a promise as
 *  what a late one says. */
Then(
  "the column's row {string} says {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await this.showSidebar();
    const row = this.page.locator(rowOf(id));
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => oneLine(await row.innerText()) === said,
      `the row for "${id}" to say "${said}"`,
    );
  },
);

/** What the row is CALLED — the link's name, which is its title and not the
 *  whole of its text. The felt word rides beside the name rather than in it, so
 *  a title edit has to be asked here rather than in the row's `innerText`. */
Then(
  "the column's row {string} is named {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await this.showSidebar();
    await this.expectChromeAttribute(`${rowOf(id)} a`, "aria-label", said, `the row for "${id}"`);
  },
);

/** Which side of now the row's day is on — the fact the dot's shape and the
 *  felt word are both read off. */
Then(
  "the column's row {string} is not late",
  async function (this: OlaiWorld, id: string) {
    await this.showSidebar();
    await this.expectChromeAttribute(rowOf(id), "data-when", "today", `the row for "${id}"`);
  },
);

/**
 * Every late row names its own day, in the spine's words — asked of the row's
 * own `data-date`, so a list that printed one row's distance beside another's
 * title fails rather than passes.
 */
Then("every late row says how far away its day feels", async function (this: OlaiWorld) {
  await this.showSidebar();
  const rows = await this.page.locator(AGENDA_ROW).all();
  assert.ok(rows.length > 0, "no owed rows are drawn, so nothing was asked");
  const today = isoDayOf(new Date());
  for (const row of rows) {
    if ((await row.getAttribute("data-when")) !== "late") continue;
    const date = await row.getAttribute("data-date");
    assert.ok(date !== null, "a late row names no day");
    const distance = feltOn(date, today).distance;
    assert.ok(distance !== undefined, `the day "${date}" has no felt distance to print`);
    const said = oneLine(await row.innerText());
    assert.ok(
      said.endsWith(distance),
      `the row for "${date}" reads "${said}", which does not end with "${distance}"`,
    );
  }
});

/**
 * A title rewritten UNDER the page — another writer's tab, or a `git pull`.
 *
 * This is the case the reading's equality exists for: one late node is still
 * one, so BOTH counts stand still, and what has to reach the column on its own
 * is the row itself (`sameOwedReading` compares the rows). The outline is found
 * by the id it holds rather than named, because which file a node lives in is
 * not what the scenario is about.
 */
When(
  "the title of {string} is rewritten as {string} on disk",
  function (this: OlaiWorld, id: string, title: string) {
    const holds = (file: string): boolean =>
      this.servedNodes(file).some((node) => node["id"] === id);
    const file = fs.readdirSync(this.scratch()).find((one) => one.endsWith(".olai") && holds(one));
    if (file === undefined) throw new Error(`no served outline holds "${id}"`);
    this.writeServed(file, this.servedNodes(file)
      .map((node) => JSON.stringify(node["id"] === id ? { ...node, title } : node))
      .join("\n"));
  },
);

// ── pressing one ───────────────────────────────────────────────────────

/**
 * Four more late tasks, written while the page is open — what the CAP needs and
 * the fixtures cannot give: seven owed rows, of which five fit. Yesterday, so
 * they are late on every day this suite will ever run, and appended rather than
 * rewritten, the way another writer would leave them.
 */
When(
  "four more tasks are due yesterday in {string}",
  function (this: OlaiWorld, file: string) {
    const yesterday = isoDayOf(new Date());
    // One day back, with the format's own calendar rather than milliseconds
    // (`@olai/format`'s `shiftDay`, through the client's day): a day is not
    // twenty-four hours, and the day a clock goes forward is the day this would
    // otherwise be wrong.
    const day = shiftDay(yesterday, -1);
    for (let at = 1; at <= 4; at++) {
      this.appendServed(file, {
        id: `more-${at}`,
        ord: `y${at}`,
        title: `the ${at} thing left over`,
        todo: true,
        date: day,
      });
    }
  },
);

/** A row is a link to the node where it lives, as the agenda page's own rows
 *  are — nothing about this list is a second way to reach a node. */
When("I press the column's row {string}", async function (this: OlaiWorld, id: string) {
  await this.showSidebar();
  await this.press(this.page.locator(`${rowOf(id)} a`));
});

/** The same row, with a thumb — the gesture a phone drawer is shut by. */
When("I tap the column's row {string}", async function (this: OlaiWorld, id: string) {
  await this.showSidebar();
  await this.press(this.page.locator(`${rowOf(id)} a`), "tap");
});

When("I follow the more line", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(AGENDA_MORE));
});

// ── the fold ───────────────────────────────────────────────────────────

/** The chevron, and the two halves of what it promises: the control's own
 *  `aria-expanded` AND the list being there or not. A chevron that turned while
 *  the list stayed is the failure the pair exists to catch. */
const folded = async (world: OlaiWorld, away: boolean): Promise<void> => {
  await world.showSidebar();
  const chevron = world.page.locator(AGENDA_FOLD);
  await chevron.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.expectChromeAttribute(AGENDA_FOLD, "aria-expanded", String(!away), "the fold's chevron");
  await world.page
    .locator(AGENDA_ROWS)
    .waitFor({ state: away ? "detached" : "visible", timeout: POLL_TIMEOUT });
};

Then("the agenda rows are folded away", async function (this: OlaiWorld) {
  await folded(this, true);
});

When("I fold the agenda rows", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(AGENDA_FOLD).click();
});

When("I unfold the agenda rows", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(AGENDA_FOLD).click();
  await this.page.locator(AGENDA_ROWS).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
