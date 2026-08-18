/**
 * The agenda: what is owed, read forward off the same dates a day page reads
 * backward — and drawn as ONE SPINE OF TIME (`agenda-spine`, 2026-08-18).
 *
 * Two things these steps are careful about, and both are the journal's own
 * rules one page over. WHERE a day sits is asked by `data-when` — `late`,
 * `today`, `ahead` — rather than by the words its heading is titled with: which
 * side of now a day is on is a promise, and "Yesterday · Mon, Aug 17" is not.
 * And a day with nothing on it is absent rather than empty, so "what the line
 * runs through" is a list of facts and not a count of headings. TODAY is the
 * one exception, and it is the ruling rather than a leak: now is a place on the
 * line whether or not anything is due on it.
 *
 * And TODAY is asked of the clock with the same function the client uses
 * (`client/clock.ts`), imported rather than re-spelled, for the reason
 * `journal_steps.ts` gives: a suite that computed the day its own way would
 * disagree with the browser at exactly midnight, in one time zone, on somebody
 * else's machine. EVERY OTHER DAY these scenarios name is that one stepped
 * ({@link daysFromToday}) with `@olai/format`'s own `shiftDay` — integers over
 * `{year, month, day}`, never milliseconds added to an instant, because the day
 * a clock goes forward is not twenty-four hours later. One spelling of "the day
 * after this one", so tomorrow and a fortnight out cannot come from two
 * different calendars.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { shiftDay } from "@olai/format";
import { isoDayOf } from "@olai/web/src/client/clock.ts";

import {
  AGENDA_COUNT,
  AGENDA_DAY,
  AGENDA_EMPTY,
  AGENDA_LINK,
  AGENDA_OWED,
  AGENDA_PAGE,
  AGENDA_QUIET,
  AGENDA_SPINE,
  attr,
  DATE,
  DAY_GROUP,
  drawn,
  expectAbsent,
  expectDrawn,
  HYDRATION_TIMEOUT,
  NODE,
  nodeSelector,
  POLL_TIMEOUT,
  RAIL_AGENDA,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** A day counted from today, in the reader's own zone: the browser's own day
 *  (`isoDayOf`), stepped by the format's own calendar (`shiftDay`). */
const daysFromToday = (days: number): string =>
  shiftDay(isoDayOf(new Date()), days);

/** The day after this one — the one every scenario about "coming up" names. */
const tomorrow = (): string => daysFromToday(1);

/** The days on one stretch of the line, by which side of now they are on.
 *  Exported for the reason `outline_tree_steps.ts`'s `revealGutter` is: a
 *  second file asserts about a day's standing (`repeat_steps.ts`, for the
 *  occurrence a completion made), and a second spelling of it would be two
 *  answers to one question. */
export const standingSelector = (when: string): string =>
  `${AGENDA_DAY}${attr("data-when", when)}`;

// ── opening it ─────────────────────────────────────────────────────────

When("I open the agenda", async function (this: OlaiWorld) {
  await this.openAgenda();
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
 * The line, day by day: which side of now each one is on, in the order it is
 * drawn.
 *
 * The whole shape of the page in one list — what has gone, above now, above
 * what is coming — and it is read as FACTS rather than as headings, so a
 * scenario says nothing about the words a day is titled with.
 *
 * Each standing is WAITED FOR before the whole list is compared, and that is
 * what makes the step usable under a live page: a node written into today's
 * date arrives on the next revision the store publishes, and a list read the
 * instant the file lands would be the previous frame's answer — which, with the
 * late days already drawn, is a perfectly plausible wrong one.
 */
Then(
  "the agenda spine runs {string}",
  async function (this: OlaiWorld, expected: string) {
    for (const when of new Set(expected.split(",").map((one) => one.trim()))) {
      await this.page
        .locator(standingSelector(when))
        .first()
        .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    }
    await expectDrawn(this.page.locator(AGENDA_DAY), "data-when", expected);
  },
);

/** No line at all — the page's own claim that there is nothing to draw one
 *  for. A lone today dot over an empty page is a diagram of nothing, so the
 *  line is drawn exactly when something is owed. */
Then("the agenda draws no spine", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    AGENDA_PAGE,
    AGENDA_SPINE,
    "the agenda draws a line of time with nothing on it",
  );
});

/** The chrome that went: no file heading over any day. Which outline a row
 *  lives in is the muted ancestry under it and the `data-file` on it — a
 *  heading per file per day was the repetition this page was redrawn to lose. */
Then("the agenda draws no file headings", async function (this: OlaiWorld) {
  await this.page
    .locator(AGENDA_SPINE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(`${AGENDA_PAGE} ${DAY_GROUP}`).count(),
    0,
    "the agenda heads a day with the outline its rows came from",
  );
});

/** Every row of one stretch of the line, in DOM order — across its days,
 *  because the order within a day and the order of the days are one reading. */
Then(
  "the spine's {string} rows are {string}",
  async function (this: OlaiWorld, when: string, expected: string) {
    await expectDrawn(
      this.page.locator(`${standingSelector(when)} ${NODE}`),
      "data-node-id",
      expected,
    );
  },
);

/** The days one stretch of the line runs through, oldest first. What a scenario
 *  asks when the DAYS are the answer — three late tasks on three days is three
 *  dots, where the same three in two outlines used to be two groups. */
Then(
  "the spine's {string} days are {string}",
  async function (this: OlaiWorld, when: string, expected: string) {
    await expectDrawn(
      this.page.locator(standingSelector(when)),
      "data-date",
      expected,
    );
  },
);

/**
 * What a day CALLS itself: felt distance and a weekday, never an ISO date.
 *
 * Asked of the day's own heading, which is also the link to its page — and
 * asked as words the heading CONTAINS rather than the whole of it, because a
 * scenario about "Tomorrow" has no business also pinning which Tuesday
 * tomorrow happens to be.
 */
const expectSays = async (
  world: OlaiWorld,
  date: string,
  said: string,
): Promise<void> => {
  await world.page
    .locator(`${AGENDA_DAY}${attr("data-date", date)} h2`)
    .filter({ hasText: said })
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

Then(
  "the day {string} says {string}",
  async function (this: OlaiWorld, date: string, said: string) {
    await expectSays(this, date, said);
  },
);

/** The same, for the two days a tracked fixture cannot name — the suite works
 *  out the date the way the client would and asks about the words. */
Then(
  "the day for tomorrow says {string}",
  async function (this: OlaiWorld, said: string) {
    await expectSays(this, tomorrow(), said);
  },
);

Then(
  "the day {int} days from today says {string}",
  async function (this: OlaiWorld, days: number, said: string) {
    await expectSays(this, daysFromToday(days), said);
  },
);

/** A silence the page NAMES, in the words it names it with. */
Then(
  "the agenda notes {string}",
  async function (this: OlaiWorld, said: string) {
    await this.page
      .locator(AGENDA_QUIET)
      .filter({ hasText: said })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The same silence asked by the WAIT behind it rather than by its words — for
 *  a scenario over fixtures dated in 2019, where "seven quiet years" is true
 *  today and will be eight of them one day. `data-days` is the count; the words
 *  round it. */
Then(
  "the agenda notes a silence of at least {int} days",
  async function (this: OlaiWorld, least: number) {
    const label = this.page.locator(AGENDA_QUIET).first();
    await label.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const days = Number(await label.getAttribute("data-days"));
    assert.ok(
      days >= least,
      `the silence the agenda names is ${days} days, not the ${least}+ expected`,
    );
  },
);

/** A gap the page draws no words for — the whitespace is still there and still
 *  grows with the wait, but "one quiet week" is not a silence anybody notices. */
Then("the agenda notes no silence", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    AGENDA_SPINE,
    AGENDA_QUIET,
    "the agenda names a silence too short to be worth a word",
  );
});

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
    // The PAGE first, then its rows: an absence read off a page that has not
    // drawn its answer yet is an absence of everything.
    await this.page
      .locator(AGENDA_PAGE)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
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

/** The other side of it, for a page a FILTER emptied. "Nothing is due." is a
 *  claim about the AGENDA; a query that selected none of it is a claim about
 *  the query, and the bar is where that one is made. A page saying both would
 *  be telling the reader nothing is late while three things are. */
Then("the agenda does not say it is empty", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    AGENDA_PAGE,
    AGENDA_EMPTY,
    "the agenda says nothing is due over a page a filter narrowed to nothing",
  );
});

// ── the days ahead ─────────────────────────────────────────────────────

Then("the days ahead are tomorrow", async function (this: OlaiWorld) {
  await expectDrawn(
    this.page.locator(standingSelector("ahead")),
    "data-date",
    tomorrow(),
  );
});

/** The heading is the way THROUGH: a day page is the fuller answer, and the
 *  agenda deliberately shows neither the note somebody wrote on it nor the
 *  work already finished. */
Then(
  "the day ahead for tomorrow links to that day",
  async function (this: OlaiWorld) {
    const date = tomorrow();
    const link = this.page.locator(`${AGENDA_DAY}${attr("data-date", date)} a`).first();
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

/** WHAT the pill says, where the words are the point: on the spine a date pill
 *  is kept only where it adds a fact the day's own heading has not already
 *  given — how late the work is, or the time on a datetime. */
Then(
  "the pill on {string} says {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    const pill = this.page.locator(`${nodeSelector(id)} ${DATE}`).first();
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await pill.innerText().catch(() => "")).trim() === said,
      `the pill on "${id}" to say "${said}"`,
    );
  },
);

/** And the other half of that rule: no pill at all where the day above the row
 *  has already said the date. */
Then(
  "{string} wears no date pill",
  async function (this: OlaiWorld, id: string) {
    await expectAbsent(
      this,
      nodeSelector(id),
      `${nodeSelector(id)} ${DATE}`,
      `the row "${id}" repeats a date its day heading already gave`,
    );
  },
);

Then(
  "the date on {string} is not overdue",
  async function (this: OlaiWorld, id: string) {
    await expectOverdue(this, id, false);
  },
);

// ── what the DIRECTORY says about it ───────────────────────────────────

/**
 * The mark on the agenda entry, asked as the FACT it carries rather than as the
 * colour it was painted — the rule every readout in this suite follows, and the
 * reason the entry spells `data-owed` at all.
 *
 * VISIBLE first, and that is load-bearing rather than belt-and-braces: on a
 * phone the whole directory is a sheet that is rendered and hidden, so an
 * attribute read off the DOM alone would pass for a reader who cannot see the
 * entry at all. The count is read as TEXT, because "3" being on screen is the
 * half of this that a `data-` attribute cannot promise.
 */
const expectMark = async (
  world: OlaiWorld,
  face: string,
  shown: number,
): Promise<void> => {
  await world.page
    .locator(AGENDA_OWED)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await world.expectAttribute(AGENDA_OWED, "data-owed", face, "the agenda entry");
  const chip = world.page.locator(AGENDA_COUNT).first();
  await world.waitUntil(
    async () => (await chip.innerText().catch(() => "")).trim() === String(shown),
    `the agenda entry to show "${shown}"`,
  );
};

/** One of the two counts the entry carries, drawn or not — the half of this
 *  that says the mark is the agenda's own arithmetic. */
const expectCount = async (
  world: OlaiWorld,
  which: "overdue" | "today",
  count: number,
): Promise<void> => {
  await world.expectAttribute(
    AGENDA_OWED,
    `data-${which}`,
    String(count),
    "the agenda entry",
  );
};

/** Something has slipped: the app's alarm, and the number on it is the LATE
 *  one — whatever else the same reading holds. */
Then(
  "the agenda entry is on fire with {int} late",
  async function (this: OlaiWorld, late: number) {
    await expectMark(this, "overdue", late);
    await expectCount(this, "overdue", late);
  },
);

/** Work on today and nothing late: the quiet face a date badge wears when it is
 *  not overdue. A nudge is not an alarm. */
Then(
  "the agenda entry nudges with {int} on today",
  async function (this: OlaiWorld, count: number) {
    await expectMark(this, "today", count);
    await expectCount(this, "today", count);
  },
);

/** The other half of the loud state: the today count is still COUNTED when the
 *  alarm is what is drawn, so the quieter fact is spoken rather than lost. */
Then(
  "the agenda entry also carries {int} on today",
  async function (this: OlaiWorld, count: number) {
    await expectCount(this, "today", count);
  },
);

Then("the agenda entry is quiet", async function (this: OlaiWorld) {
  await this.expectAttribute(AGENDA_OWED, "data-owed", "quiet", "the agenda entry");
});

/**
 * No chip at all — an agenda with nothing on it wears no mark, not a zero.
 *
 * Read AFTER the face above has been waited for, which is what makes it a real
 * assertion: an absence checked against a page that has not drawn its answer
 * yet is an absence of everything.
 */
Then("the agenda entry wears no count", async function (this: OlaiWorld) {
  await this.expectAttribute(AGENDA_OWED, "data-owed", "quiet", "the agenda entry");
  assert.strictEqual(
    await this.page.locator(AGENDA_COUNT).count(),
    0,
    "the agenda entry wears a count with nothing owed behind it",
  );
});

/** What it says OUT LOUD, which is where both numbers always are — a colour is
 *  silence to a screen reader, and the loud face prints only one of them. */
Then(
  "the agenda entry says {string}",
  async function (this: OlaiWorld, said: string) {
    await this.expectAttribute(AGENDA_LINK, "aria-label", said, "the agenda entry");
  },
);

/** The collapsed column: the same reading, as a dot — three rem has no room for
 *  a number, and news that went out when the sidebar was put away would be news
 *  nobody could act on. */
Then("the rail's agenda icon is on fire", async function (this: OlaiWorld) {
  await this.page
    .locator(RAIL_AGENDA)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.expectAttribute(RAIL_AGENDA, "data-owed", "overdue", "the rail's agenda icon");
});

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

/** Work that slipped ONE day, which is the smallest lateness there is and the
 *  one the pill spells in the singular. */
When(
  "something is scheduled for yesterday in {string}",
  function (this: OlaiWorld, file: string) {
    this.appendServed(file, {
      id: "due-yesterday",
      ord: "z8",
      title: "sign the rental agreement",
      todo: true,
      date: daysFromToday(-1),
    });
  },
);

/** And work at a TIME, which is the one fact a day heading cannot give and so
 *  the one a future row still keeps a pill for. */
When(
  "something is scheduled for two o'clock tomorrow in {string}",
  function (this: OlaiWorld, file: string) {
    this.appendServed(file, {
      id: "due-at-two",
      ord: "z9",
      title: "the rheumatology appointment",
      todo: true,
      date: `${tomorrow()}T14:00`,
    });
  },
);

/** A day further out than the two above can name — what the SPINE needs and
 *  they cannot give: a silence between two listed days is a fact about the
 *  distance between them, and two consecutive days have none. Counted with the
 *  client's own step (`clock.ts`'s `shiftDay`, through `@olai/format`), for the
 *  reason `tomorrow` is: a suite doing its own calendar arithmetic would
 *  disagree with the browser twice a year. */
When(
  "something is scheduled {int} days from today in {string}",
  function (this: OlaiWorld, days: number, file: string) {
    this.appendServed(file, {
      id: `due-in-${days}`,
      ord: `z${days}`,
      title: `the ${days}-day thing`,
      todo: true,
      date: daysFromToday(days),
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
