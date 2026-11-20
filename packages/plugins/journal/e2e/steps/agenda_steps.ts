import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { shiftDay } from "@olai/format";
import { isoDayOf } from "@olai/web/testlib";

import {
  AGENDA_LINK,
  attr,
  DATE,
  DAY_GROUP,
  drawn,
  expectAbsent,
  expectDrawn,
  HYDRATION_TIMEOUT,
  NODE,
  NODE_GUTTER,
  NODE_MENU,
  nodeSelector,
  POLL_TIMEOUT,
  ZOOM,
} from "@olai/tests/harness/world.ts";
import {
  AGENDA_COUNT,
  AGENDA_DAY,
  AGENDA_EMPTY,
  AGENDA_OWED,
  AGENDA_PAGE,
  AGENDA_QUIET,
  AGENDA_SPINE,
  RAIL_AGENDA,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const daysFromToday = (days: number): string =>
  shiftDay(isoDayOf(new Date()), days);

const tomorrow = (): string => daysFromToday(1);

export const standingSelector = (when: string): string =>
  `${AGENDA_DAY}${attr("data-when", when)}`;

When("I open the agenda", async function (this: OlaiWorld) {
  await this.openAgenda();
});

When("I follow the agenda link", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(AGENDA_LINK));
});

Then("the agenda says it is today", async function (this: OlaiWorld) {
  await this.expectAttribute(
    AGENDA_PAGE,
    "data-date",
    isoDayOf(new Date()),
    "the agenda",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the agenda spine runs {string}",
  async function (this: OlaiWorld, expected: string) {
    for (const when of new Set(expected.split(",").map((one) => one.trim()))) {
      await this.page
        .locator(standingSelector(when))
        .first()
        .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    }
    await expectDrawn(this, this.page.locator(AGENDA_DAY), "data-when", expected);
  },
);

Then("the agenda draws no spine", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    AGENDA_PAGE,
    AGENDA_SPINE,
    "the agenda draws a line of time with nothing on it",
  );
});

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

Then(
  "the spine's {string} rows are {string}",
  async function (this: OlaiWorld, when: string, expected: string) {
    await expectDrawn(
      this,
      this.page.locator(`${standingSelector(when)} ${NODE}`),
      "data-node-id",
      expected,
    );
  },
);

Then(
  "the spine's {string} days are {string}",
  async function (this: OlaiWorld, when: string, expected: string) {
    await expectDrawn(
      this,
      this.page.locator(standingSelector(when)),
      "data-date",
      expected,
    );
  },
);

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
Then(
  "the agenda does not list {string}",
  async function (this: OlaiWorld, id: string) {
    // The PAGE first, then its rows: an absence read off a page that has not
    // drawn its answer yet is an absence of everything.
    await this.page
      .locator(AGENDA_PAGE)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await drawn(this.page.locator(`${AGENDA_PAGE} ${NODE}`));
    await this.waitUntil(
      async () => (await this.page.locator(`${AGENDA_PAGE} ${nodeSelector(id)}`).count()) === 0,
      `the node "${id}" to leave the agenda`,
    );
  },
);

Then("the agenda is empty", async function (this: OlaiWorld) {
  await this.page
    .locator(AGENDA_EMPTY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the agenda does not say it is empty", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    AGENDA_PAGE,
    AGENDA_EMPTY,
    "the agenda says nothing is due over a page a filter narrowed to nothing",
  );
});

Then("the days ahead are tomorrow", async function (this: OlaiWorld) {
  await expectDrawn(
    this,
    this.page.locator(standingSelector("ahead")),
    "data-date",
    tomorrow(),
  );
});

Then(
  "the day ahead for tomorrow links to that day",
  async function (this: OlaiWorld) {
    const date = tomorrow();
    const link = this.page.locator(`${AGENDA_DAY}${attr("data-date", date)} a`).first();
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await link.getAttribute("href"), `/d/${date}`);
  },
);

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

const expectMark = async (
  world: OlaiWorld,
  face: string,
  shown: number,
): Promise<void> => {
  await world.page
    .locator(AGENDA_OWED)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await world.expectChromeAttribute(AGENDA_OWED, "data-owed", face, "the agenda entry");
  const chip = world.page.locator(AGENDA_COUNT).first();
  await world.waitUntil(
    async () => (await chip.innerText().catch(() => "")).trim() === String(shown),
    `the agenda entry to show "${shown}"`,
  );
};

const expectCount = async (
  world: OlaiWorld,
  which: "overdue" | "today",
  count: number,
): Promise<void> => {
  await world.expectChromeAttribute(
    AGENDA_OWED,
    `data-${which}`,
    String(count),
    "the agenda entry",
  );
};

Then(
  "the agenda entry is on fire with {int} late",
  async function (this: OlaiWorld, late: number) {
    await expectMark(this, "overdue", late);
    await expectCount(this, "overdue", late);
  },
);

Then(
  "the agenda entry nudges with {int} on today",
  async function (this: OlaiWorld, count: number) {
    await expectMark(this, "today", count);
    await expectCount(this, "today", count);
  },
);

Then(
  "the agenda entry also carries {int} on today",
  async function (this: OlaiWorld, count: number) {
    await expectCount(this, "today", count);
  },
);

Then("the agenda entry is quiet", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(AGENDA_OWED, "data-owed", "quiet", "the agenda entry");
});

Then("the agenda entry wears no count", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(AGENDA_OWED, "data-owed", "quiet", "the agenda entry");
  assert.strictEqual(
    await this.page.locator(AGENDA_COUNT).count(),
    0,
    "the agenda entry wears a count with nothing owed behind it",
  );
});

Then(
  "the agenda entry says {string}",
  async function (this: OlaiWorld, said: string) {
    await this.expectChromeAttribute(AGENDA_LINK, "aria-label", said, "the agenda entry");
  },
);

Then("the rail's agenda icon is on fire", async function (this: OlaiWorld) {
  await this.page
    .locator(RAIL_AGENDA)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.expectChromeAttribute(RAIL_AGENDA, "data-owed", "overdue", "the rail's agenda icon");
});

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

Then(
  "the ••• of {string} hangs left of its bullet",
  async function (this: OlaiWorld, id: string) {
    const dots = await this.box(this.within(id, NODE_MENU), `the ••• of "${id}"`);
    const bullet = await this.box(this.within(id, ZOOM), `the bullet of "${id}"`);
    const line = await this.box(this.within(id, NODE_GUTTER), `the line of "${id}"`);
    assert.ok(
      dots.x + dots.width <= bullet.x + 0.5,
      `the ••• of "${id}" (right edge ${dots.x + dots.width}) overlaps its bullet (left edge ${bullet.x})`,
    );
    assert.ok(
      Math.abs(bullet.x - line.x) <= 0.5,
      `the bullet of "${id}" sits at ${bullet.x}, off its line's left edge at ${line.x} — the ••• took a cell`,
    );
  },
);

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
