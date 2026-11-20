import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { feltOn, shiftDay } from "@olai/format";
import { isoDayOf } from "@olai/web/testlib";

import { attr, expectAbsent, expectDrawn, HYDRATION_TIMEOUT, oneLine, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import { AGENDA_FOLD, AGENDA_MORE, AGENDA_OWED, AGENDA_ROW, AGENDA_ROWS } from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const rowOf = (id: string): string => `${AGENDA_ROW}${attr("data-node-id", id)}`;

const dotOf = (id: string): string => `${rowOf(id)} [data-mark]`;

Then(
  "the column's agenda rows are {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.showSidebar();
    await expectDrawn(this, this.page.locator(AGENDA_ROW), "data-node-id", expected);
  },
);

Then("the column draws {int} agenda rows", async function (this: OlaiWorld, count: number) {
  await this.showSidebar();
  const rows = this.page.locator(AGENDA_ROW);
  await rows.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => (await rows.count()) === count,
    `the column to draw ${count} owed rows`,
  );
});

Then("the column says {string}", async function (this: OlaiWorld, said: string) {
  await this.showSidebar();
  const more = this.page.locator(AGENDA_MORE);
  await more.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => oneLine(await more.innerText()) === said,
    `the column to say "${said}"`,
  );
});

Then("the column draws no agenda rows", async function (this: OlaiWorld) {
  await this.showSidebar();
  await expectAbsent(this, AGENDA_OWED, AGENDA_ROWS, "the column draws owed rows under the door");
});

Then("the column draws no fold", async function (this: OlaiWorld) {
  await this.showSidebar();
  await expectAbsent(this, AGENDA_OWED, AGENDA_FOLD, "the column offers to fold a list it has not drawn");
});

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

Then(
  "the column's row {string} is named {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await this.showSidebar();
    await this.expectChromeAttribute(`${rowOf(id)} a`, "aria-label", said, `the row for "${id}"`);
  },
);

Then(
  "the column's row {string} is not late",
  async function (this: OlaiWorld, id: string) {
    await this.showSidebar();
    await this.expectChromeAttribute(rowOf(id), "data-when", "today", `the row for "${id}"`);
  },
);

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

When(
  "the title of {string} in {string} is rewritten as {string}",
  function (this: OlaiWorld, id: string, file: string, title: string) {
    const records = this.servedNodes(file);
    assert.ok(
      records.some((node) => node["id"] === id),
      `the served outline "${file}" holds no "${id}"`,
    );
    this.writeServed(file, records
      .map((node) => JSON.stringify(node["id"] === id ? { ...node, title } : node))
      .join("\n"));
  },
);

When(
  "four more tasks are due yesterday in {string}",
  function (this: OlaiWorld, file: string) {
    const yesterday = isoDayOf(new Date());
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

When("I press the column's row {string}", async function (this: OlaiWorld, id: string) {
  await this.showSidebar();
  await this.press(this.page.locator(`${rowOf(id)} a`));
});

When("I tap the column's row {string}", async function (this: OlaiWorld, id: string) {
  await this.showSidebar();
  await this.press(this.page.locator(`${rowOf(id)} a`), "tap");
});

When("I follow the more line", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(AGENDA_MORE));
});

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
