import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  DATE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  DATE_PICKER,
  DATE_PICKER_CANCEL,
  DATE_PICKER_DAY,
  DATE_PICKER_NO_TIME,
  DATE_PICKER_NOTICE,
  DATE_PICKER_SET,
  DATE_PICKER_TIME,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When(
  "I open the date picker on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, DATE);
    await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

const panel = (world: OlaiWorld) => world.page.locator(`${DATE_PICKER}:visible`);

const box = (world: OlaiWorld) => world.page.locator(`${DATE_PICKER_DAY}:visible`);

const time = (world: OlaiWorld) => world.page.locator(`${DATE_PICKER_TIME}:visible`);

const button = (world: OlaiWorld) => world.page.locator(`${DATE_PICKER_SET}:visible`);

Then("the date picker is open", async function (this: OlaiWorld) {
  await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the date picker is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await panel(this).count()) === 0,
    "no date picker to be visible",
  );
});

Then(
  "the date picker holds {string}",
  async function (this: OlaiWorld, day: string) {
    await box(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box(this).inputValue(), day);
  },
);

Then(
  "the date picker holds {string} at {string}",
  async function (this: OlaiWorld, day: string, face: string) {
    await box(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box(this).inputValue(), day);
    assert.strictEqual(await time(this).inputValue(), face);
    assert.strictEqual(
      await time(this).evaluate((element) => (element as HTMLInputElement).validity.badInput),
      false,
      "the time box still holds half-typed segments",
    );
  },
);

Then(
  "the date picker offers to {string}",
  async function (this: OlaiWorld, label: string) {
    await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await button(this).innerText()), label);
  },
);

Then(
  "the date picker says {string}",
  async function (this: OlaiWorld, notice: string) {
    const said = this.page.locator(DATE_PICKER_NOTICE);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await said.innerText()), notice);
  },
);

Then("the date picker says nothing", async function (this: OlaiWorld) {
  await box(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitForFrame();
  assert.strictEqual(await this.page.locator(DATE_PICKER_NOTICE).count(), 0);
});

Then("the date picker's button is dead", async function (this: OlaiWorld) {
  await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await button(this).isDisabled(),
    true,
    "the picker offers to write something that would change nothing",
  );
});

Then("the date controls fit the phone width", async function (this: OlaiWorld) {
  const bounds = await panel(this).locator("input, button").evaluateAll((controls) =>
    controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return { label: control.getAttribute("data-testid"), left: rect.left, right: rect.right, width: innerWidth };
    }),
  );
  assert.ok(bounds.length >= 3);
  for (const bound of bounds) assert.ok(bound.left >= 0 && bound.right <= bound.width, JSON.stringify(bound));
});

When("I pick the date {string}", async function (this: OlaiWorld, day: string) {
  await box(this).fill(day);
  await this.press(button(this));
  await panel(this).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

When(
  "I pick the date {string} at {string}",
  async function (this: OlaiWorld, day: string, face: string) {
    await box(this).fill(day);
    await time(this).fill(face);
    await this.press(button(this));
    await panel(this).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

When("I draft the date {string}", async function (this: OlaiWorld, day: string) {
  await box(this).fill(day);
});

When("I draft the time {string}", async function (this: OlaiWorld, face: string) {
  await time(this).fill(face);
  await this.waitForFrame();
});

When(
  "I press {string} in the date picker's time box",
  async function (this: OlaiWorld, key: string) {
    await time(this).focus();
    await this.page.keyboard.press(key);
    await this.waitForFrame();
  },
);

When("I take the time off in the date picker", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DATE_PICKER_NO_TIME));
  await this.page.locator(DATE_PICKER_NO_TIME).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

When("I submit the date while updates are delayed", async function (this: OlaiWorld) {
  await button(this).click();
});

When("I empty the date picker", async function (this: OlaiWorld) {
  await box(this).fill("");
  await this.waitForFrame();
});

When("I press the date picker's button", async function (this: OlaiWorld) {
  await this.press(button(this));
});

Then(
  "the date on {string} does not open the picker",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${DATE}`,
      "data-picks",
      "false",
      `the date badge on "${id}"`,
    );
  },
);

When("I press Escape in the date picker", async function (this: OlaiWorld) {
  await box(this).press("Escape");
});
