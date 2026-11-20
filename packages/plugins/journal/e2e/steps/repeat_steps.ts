import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  NODE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  REPEAT,
  REPEAT_PICKER,
  REPEAT_PICKER_CANCEL,
  REPEAT_PICKER_RULE,
  REPEAT_PICKER_SET,
  REPEAT_PICKER_SAID,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { standingSelector } from "./agenda_steps.ts";

When(
  "I open the repeat picker on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, REPEAT);
    await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

const panel = (world: OlaiWorld) => world.page.locator(REPEAT_PICKER);

const rules = (world: OlaiWorld) => world.page.locator(REPEAT_PICKER_RULE);

const button = (world: OlaiWorld) => world.page.locator(REPEAT_PICKER_SET);

Then("the repeat picker is open", async function (this: OlaiWorld) {
  await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the repeat picker is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await panel(this).count()) === 0,
    "the repeat picker to be gone from the page",
  );
});

Then(
  "the repeat picker holds {string}",
  async function (this: OlaiWorld, rule: string) {
    await rules(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await rules(this).inputValue(), rule);
  },
);

Then(
  "the repeat picker offers to {string}",
  async function (this: OlaiWorld, label: string) {
    await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await button(this).innerText()), label);
  },
);

Then("the repeat picker's button is dead", async function (this: OlaiWorld) {
  await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await button(this).isDisabled(),
    true,
    "the picker offers to write something that would change nothing",
  );
});

Then(
  "the repeat picker offers the rules {string}",
  async function (this: OlaiWorld, expected: string) {
    await rules(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const values = await rules(this)
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter((value) => value !== ""),
      );
    assert.strictEqual(values.join(", "), expected);
  },
);

When(
  "I pick the repeat rule {string}",
  async function (this: OlaiWorld, rule: string) {
    await rules(this).selectOption(rule);
    await this.press(button(this));
    await panel(this).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

When("I empty the repeat picker", async function (this: OlaiWorld) {
  await rules(this).selectOption("");
  await this.waitForFrame();
});

When("I draft the repeat rule {string}", async function (this: OlaiWorld, rule: string) {
  await rules(this).selectOption(rule);
});

When("I press the repeat picker's button", async function (this: OlaiWorld) {
  await this.press(button(this));
});

Then("the repeat controls fit the phone width", async function (this: OlaiWorld) {
  const bounds = await panel(this).locator("select, button").evaluateAll((controls) =>
    controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return { label: control.getAttribute("data-testid"), left: rect.left, right: rect.right, width: innerWidth };
    }),
  );
  assert.ok(bounds.length >= 3);
  for (const bound of bounds) assert.ok(bound.left >= 0 && bound.right <= bound.width, JSON.stringify(bound));
});

Then("the repeat picker refuses with {string}", async function (this: OlaiWorld, reason: string) {
  const said = this.page.locator(REPEAT_PICKER_SAID);
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const actual = await said.innerText();
  assert.ok(actual.includes(reason), `expected refusal containing ${reason}, got ${actual}`);
});

When("I cancel the repeat picker", async function (this: OlaiWorld) {
  await this.press(this.page.locator(REPEAT_PICKER_CANCEL));
});

Then(
  "the node {string} shows the repeat rule {string}",
  async function (this: OlaiWorld, id: string, rule: string) {
    const pill = this.page.locator(`${nodeSelector(id)} ${REPEAT}`).first();
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await pill.innerText()).replace(/^↻\s*/, ""), rule);
  },
);

Then(
  "the node {string} shows no repeat rule",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () =>
        (await this.page.locator(`${nodeSelector(id)} ${REPEAT}`).count()) === 0,
      `the node "${id}" to draw no repeat pill`,
    );
  },
);

Then(
  "{string} holds a node titled {string} dated {string} repeating {string}",
  async function (
    this: OlaiWorld,
    file: string,
    title: string,
    date: string,
    repeat: string,
  ) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) =>
            node["title"] === title &&
            node["date"] === date &&
            node["repeat"] === repeat &&
            node["todo"] === true,
        ),
      `${file} to hold ${JSON.stringify(title)} dated ${JSON.stringify(date)}, ` +
        `marked todo and repeating ${JSON.stringify(repeat)}`,
    );
  },
);

Then(
  "{string} holds the node {string} with no repeat rule",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["repeat"] === undefined,
        ),
      `${file} to hold ${JSON.stringify(id)} carrying no \`repeat\``,
    );
  },
);

Then(
  "the {string} days show a node titled {string} on {string}",
  async function (
    this: OlaiWorld,
    when: string,
    title: string,
    date: string,
  ) {
    const rows = this.page.locator(
      `${standingSelector(when)}${attr("data-date", date)} ${NODE}`,
    );
    await rows
      .filter({ hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "{string} holds the node {string} repeating {string}",
  async function (this: OlaiWorld, file: string, id: string, repeat: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["repeat"] === repeat,
        ),
      `${file} to hold ${JSON.stringify(id)} with \`repeat\` exactly ${JSON.stringify(repeat)}`,
    );
  },
);

Then(
  "the {string} days show a node repeating {string}",
  async function (this: OlaiWorld, when: string, rule: string) {
    const pill = this.page
      .locator(`${standingSelector(when)} ${NODE} ${REPEAT}`)
      .filter({ hasText: rule })
      .first();
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await pill.getAttribute("data-picks"),
      "false",
      "the agenda draws a repeat pill that opens a picker, and its rows are a query",
    );
  },
);
