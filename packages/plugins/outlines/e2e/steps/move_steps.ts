import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  POLL_TIMEOUT,
  TAG,
} from "@olai/tests/harness/world.ts";
import {
  MOVE_CLOSE,
  MOVE_HIT,
  MOVE_PICKER,
  MOVE_REFUSED,
  MOVE_SAID,
  MOVE_SEARCH,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import { answering } from "@olai/tests/harness/shortlist.ts";

const pickerOf = async (world: OlaiWorld) => {
  const picker = world.page.locator(MOVE_PICKER).first();
  await picker.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return picker;
};

When(
  "I press the tag {string} in the open move picker",
  async function (this: OlaiWorld, tag: string) {
    await this.press(
      (await pickerOf(this)).locator(`p ${TAG}`).filter({ hasText: tag }).first(),
    );
  },
);

const hitOf = async (world: OlaiWorld, title: string) =>
  (await pickerOf(world)).locator(MOVE_HIT).filter({ hasText: title }).first();

Then(
  "the move picker is open on {string}",
  async function (this: OlaiWorld, id: string) {
    const picker = await pickerOf(this);
    assert.strictEqual(
      await picker.getAttribute("data-row"),
      id,
      "the open move picker is about another row",
    );
    await this.node(id)
      .locator(MOVE_PICKER)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("no move picker is open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(MOVE_PICKER).count()) === 0,
    "the move picker to be gone",
  );
});

When(
  "I search the move picker for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = (await pickerOf(this)).locator(MOVE_SEARCH);
    await box.fill(text);
    await answering(this, MOVE_PICKER, MOVE_HIT, text);
  },
);

When(
  "I point the move picker at {string}",
  async function (this: OlaiWorld, title: string) {
    await (await hitOf(this, title)).hover();
  },
);

When(
  "I choose {string} from the move picker",
  async function (this: OlaiWorld, title: string) {
    await this.press(await hitOf(this, title));
    await this.waitUntil(
      async () =>
        (await this.page.locator(MOVE_SEARCH).count()) === 0 ||
        (await this.page.locator(MOVE_SAID).count()) > 0,
      `the move picker to carry the row under ${JSON.stringify(title)}, ` +
        "or the page to say why it did not",
    );
    if ((await this.page.locator(MOVE_SAID).count()) === 0) {
      await this.waitForFrame();
    }
  },
);

Then(
  "the move picker refuses with {string}",
  async function (this: OlaiWorld, said: string) {
    const line = (await pickerOf(this)).locator(MOVE_REFUSED).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await line.innerText()).includes(said),
      `the picker's refusal to say ${JSON.stringify(said)}`,
    ).catch(async () => {
      assert.ok(
        (await line.innerText()).includes(said),
        `the picker's refusal reads: ${await line.innerText()}`,
      );
    });
  },
);

Then("the move picker refuses nothing", async function (this: OlaiWorld) {
  const picker = await pickerOf(this);
  await this.waitUntil(
    async () => (await picker.locator(MOVE_REFUSED).count()) === 0,
    "the picker to draw no refusal about the row the cursor is on",
  );
});

Then(
  "the move noted {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, MOVE_SAID, said, "the move's said line", "aside");
  },
);

const MOVING = "moving/get";

Then(
  "the tab has asked to judge this move {int} time(s)",
  function (this: OlaiWorld, times: number) {
    assert.strictEqual(
      this.socketAskedSince(MOVING),
      times,
      "how many times this tab opened the move subscription since the mark",
    );
  },
);

Then(
  "the tab has never asked to judge a move against {string}",
  function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      this.socketAskedSince(MOVING, id),
      0,
      `this tab asked the set to judge a move against ${JSON.stringify(id)}, ` +
        "which is a destination no open list is showing",
    );
  },
);

Then(
  "the set has said nothing more about moving {string}",
  function (this: OlaiWorld, record: string) {
    assert.strictEqual(
      this.socketSaidSince("refusals", record),
      0,
      "the set answered about this move after the gesture was over, which is " +
        "a subscription nobody closed",
    );
  },
);

When("the move's sentence has gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(MOVE_SAID).count()) === 0,
    "the move's said line to take itself away",
  );
});

Then("the move picker search reads {string}", async function (this: OlaiWorld, query: string) {
  const box = (await pickerOf(this)).locator(MOVE_SEARCH);
  await this.waitUntil(async () => (await box.inputValue()) === query,
    `the move picker to retain the query ${JSON.stringify(query)}`);
});
