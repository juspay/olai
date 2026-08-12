/**
 * The agenda: what is owed, read forward off the same dates a day page reads
 * backward.
 *
 * Two things these steps are careful about, and both are the journal's own
 * rules one page over. WHICH section a list belongs to is asked by
 * `data-section` rather than by the words the heading is titled with — the
 * three sections are a promise and their wording is not — and a section with
 * nothing in it is absent rather than empty, so "which sections are on screen"
 * is a list of facts and not a count of headings.
 *
 * And TODAY is asked of the clock with the same function the client uses
 * (`client/clock.ts`), imported rather than re-spelled, for the reason
 * `journal_steps.ts` gives: a suite that computed the day its own way would
 * disagree with the browser at exactly midnight, in one time zone, on somebody
 * else's machine. TOMORROW is built the same way the client's own midnight is
 * (`clock.ts`'s `untilMidnight`) — the day after this one by calendar
 * arithmetic, never twenty-four hours later, because the day a clock goes
 * forward is not.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { isoDayOf } from "@olai/web/src/client/clock.ts";

import {
  AGENDA_DAY,
  AGENDA_EMPTY,
  AGENDA_LINK,
  AGENDA_PAGE,
  AGENDA_SECTION,
  DATE,
  DAY_GROUP,
  drawn,
  expectDrawn,
  HYDRATION_TIMEOUT,
  NODE,
  nodeSelector,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The day after today, in the reader's own zone. Built out of the calendar
 *  rather than out of milliseconds: a day is 23 hours twice a year, and +24h
 *  on one of those lands back on the day it started. */
const tomorrow = (): string => {
  const now = new Date();
  return isoDayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
};

/** One section of the page, by what it MEANS. */
const sectionSelector = (section: string): string =>
  `${AGENDA_SECTION}[data-section="${section}"]`;

// ── opening it ─────────────────────────────────────────────────────────

When("I open the agenda", async function (this: OlaiWorld) {
  await this.open("/agenda");
  await this.page
    .locator(AGENDA_PAGE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/** The way in from the directory column — one link, above the month, because
 *  the agenda and the calendar are the journal's two questions. */
When("I follow the agenda link", async function (this: OlaiWorld) {
  // On a phone the column is behind the burger; on a laptop this does nothing.
  await this.showSidebar();
  await this.press(this.page.locator(AGENDA_LINK));
});

/** `/agenda` names no date, so the page has to say which day it turned out to
 *  be answering for — the same promise `/today` keeps. */
Then("the agenda says it is today", async function (this: OlaiWorld) {
  await this.expectAttribute(
    AGENDA_PAGE,
    "data-date",
    isoDayOf(new Date()),
    "the agenda",
    HYDRATION_TIMEOUT,
  );
});

// ── what is on it ──────────────────────────────────────────────────────

/**
 * Which of the three are on screen, in the order they are drawn.
 *
 * Each one is WAITED FOR before the whole list is compared, and that is what
 * makes the step usable under a live page: a node written into today's date
 * arrives on the next revision the store publishes, and a list read the instant
 * the file lands would be the previous frame's answer — which, with Overdue
 * already drawn, is a perfectly plausible wrong one. The full-list compare is
 * still what says a section is ABSENT and what says they are in this order.
 */
Then(
  "the agenda has the sections {string}",
  async function (this: OlaiWorld, expected: string) {
    for (const section of expected.split(",").map((one) => one.trim())) {
      await this.page
        .locator(sectionSelector(section))
        .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    }
    await expectDrawn(this.page.locator(AGENDA_SECTION), "data-section", expected);
  },
);

Then("the agenda has no sections", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(AGENDA_SECTION).count(),
    0,
    "a section is on screen with nothing in it; an empty one is not drawn at all",
  );
});

/** The outlines one section groups its nodes under, in the order it draws
 *  them — path order, the same heading rule a day page follows. */
Then(
  "the {string} section groups are {string}",
  async function (this: OlaiWorld, section: string, expected: string) {
    await expectDrawn(
      this.page.locator(`${sectionSelector(section)} ${DAY_GROUP}`),
      "data-file",
      expected,
    );
  },
);

/** Every node of one section, in DOM order — across its groups, because the
 *  order within a group and the order of the groups are one reading. */
Then(
  "the {string} section lists {string}",
  async function (this: OlaiWorld, section: string, expected: string) {
    await expectDrawn(
      this.page.locator(`${sectionSelector(section)} ${NODE}`),
      "data-node-id",
      expected,
    );
  },
);

/**
 * Not on the page at all — which is most of what this feature is about: an
 * occurrence whose day has gone, finished work, a task nobody scheduled.
 *
 * The list is waited for before it is counted, so an absence is read off a page
 * that has actually drawn its answer rather than off one that has not drawn
 * anything yet.
 */
Then(
  "the agenda does not list {string}",
  async function (this: OlaiWorld, id: string) {
    await drawn(this.page.locator(`${AGENDA_PAGE} ${NODE}`));
    assert.strictEqual(
      await this.page.locator(`${AGENDA_PAGE} ${nodeSelector(id)}`).count(),
      0,
      `the node "${id}" is on the agenda, and nothing about it is owed`,
    );
  },
);

Then("the agenda is empty", async function (this: OlaiWorld) {
  await this.page
    .locator(AGENDA_EMPTY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── the days ahead ─────────────────────────────────────────────────────

Then("the upcoming days are tomorrow", async function (this: OlaiWorld) {
  await expectDrawn(this.page.locator(AGENDA_DAY), "data-date", tomorrow());
});

/** The heading is the way THROUGH: a day page is the fuller answer, and the
 *  agenda deliberately shows neither the note somebody wrote on it nor the
 *  work already finished. */
Then(
  "the upcoming day for tomorrow links to that day",
  async function (this: OlaiWorld) {
    const date = tomorrow();
    const link = this.page.locator(`${AGENDA_DAY}[data-date="${date}"] a`).first();
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await link.getAttribute("href"), `/d/${date}`);
  },
);

// ── the tone the pill takes ────────────────────────────────────────────

/** Late, as a `data-` fact on the badge rather than as the colour it is
 *  painted: the tone is a styling decision a refactor may change, and "is this
 *  row late" is the promise. Asked in BOTH directions, because an occurrence
 *  never turning amber is as much of the rule as an overdue task doing so. */
const expectOverdue = async (
  world: OlaiWorld,
  id: string,
  overdue: boolean,
): Promise<void> => {
  await world.expectAttribute(
    `${nodeSelector(id)} ${DATE}`,
    "data-overdue",
    String(overdue),
    `the date badge on "${id}"`,
  );
};

Then("the date on {string} is overdue", async function (this: OlaiWorld, id: string) {
  await expectOverdue(this, id, true);
});

Then(
  "the date on {string} is not overdue",
  async function (this: OlaiWorld, id: string) {
    await expectOverdue(this, id, false);
  },
);

// ── writing into the days the fixtures cannot name ─────────────────────

/**
 * Work due TODAY, and work due TOMORROW, written while the page is open.
 *
 * The fixtures are dated in 2019 so that Overdue is the same on every day this
 * suite runs; the two forward sections can only be exercised by a day nobody
 * knows in advance, which is a day a tracked fixture cannot hold. Appended
 * rather than rewritten, the way another writer would leave it, so what the
 * scenario is watching is a page meeting a set that moved underneath it.
 */
When(
  "something is scheduled for today in {string}",
  function (this: OlaiWorld, file: string) {
    this.appendServed(file, {
      id: "due-today",
      ord: "z0",
      title: "call the surveyor",
      todo: true,
      date: isoDayOf(new Date()),
    });
  },
);

When(
  "something is scheduled for tomorrow in {string}",
  function (this: OlaiWorld, file: string) {
    this.appendServed(file, {
      id: "due-soon",
      ord: "z1",
      title: "collect the keys",
      todo: true,
      date: tomorrow(),
    });
  },
);

/** Everything in one outline unscheduled — the honest way to an agenda with
 *  nothing on it, since rescheduling is a `date` and nothing else. */
When(
  "every date is taken off {string}",
  function (this: OlaiWorld, file: string) {
    const records = this.servedNodes(file).map((node) => {
      const { date: _dropped, ...rest } = node;
      return rest;
    });
    this.writeServed(file, records.map((node) => JSON.stringify(node)).join("\n"));
  },
);
