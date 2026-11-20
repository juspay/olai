import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { foundCount } from "@olai/tests/harness/counted.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import {
  attr,
  COMPLETION_ITEM,
  COMPLETIONS,
  DESC_HIT,
  FILTER_BAR,
  FILTER_CLEAR,
  FILTER_COUNT,
  FILTER_INPUT,
  FILTER_REFUSAL,
  HIT,
  NODE,
  NODE_TITLE,
  nodeSelector,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  addressOf,
  SEARCH_REFUSAL,
  TAG,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const rows = (world: OlaiWorld) => world.frontLane().locator(`${OUTLINE_TREE}:visible ${NODE}:visible`);

When(
  "I filter the page by {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.frontLane().locator(`${FILTER_INPUT}:visible`);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await box.fill(text);
    await this.page
      .locator(`${FILTER_BAR}${attr("data-asked", text.trim())}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitForFrame();
  },
);

When("I clear the filter", async function (this: OlaiWorld) {
  await this.press(this.page.locator(FILTER_CLEAR));
});

Then(
  "the outline has {int} rows",
  async function (this: OlaiWorld, expected: number) {
    await this.waitUntil(
      async () => (await rows(this).count()) === expected,
      `the outline has ${expected} rows`,
    );
  },
);

Then(
  "the filter found {string}",
  async function (this: OlaiWorld, said: string) {
    await foundCount(this, FILTER_COUNT, said, "filter count");
  },
);

Then(
  "the node {string} is a match",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      nodeSelector(id),
      "data-match",
      "true",
      `node \`${id}\``,
    );
  },
);

Then(
  "the node {string} is context",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      nodeSelector(id),
      "data-match",
      "false",
      `node \`${id}\``,
    );
  },
);

const lit = (world: OlaiWorld, id: string, piece = "") =>
  world.nodeTitle(id).locator(piece === "" ? HIT : `${piece} ${HIT}`);

const expectLit = async (
  world: OlaiWorld,
  id: string,
  said: string,
  piece = "",
): Promise<void> => {
  const where = piece === "" ? "" : ` inside its \`${piece}\``;
  const read = async () =>
    (await lit(world, id, piece).allInnerTexts()).join(" ");
  await world.waitUntil(
    async () => (await read()) === said,
    `node \`${id}\` lights ${JSON.stringify(said)}${where}`,
  ).catch(() => undefined);
  assert.strictEqual(
    await read(),
    said,
    `node \`${id}\` does not light ${JSON.stringify(said)}${where}`,
  );
};

Then(
  "the node {string} lights {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await expectLit(this, id, said);
  },
);

Then(
  "the node {string} lights {string} inside its code span",
  async function (this: OlaiWorld, id: string, said: string) {
    await expectLit(this, id, said, "code");
  },
);

Then(
  "the node {string} lights {string} inside its link",
  async function (this: OlaiWorld, id: string, said: string) {
    await expectLit(this, id, said, "a");
  },
);

Then(
  "the node {string} lights nothing",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await lit(this, id).count()) === 0,
      `node \`${id}\` lights nothing`,
    );
  },
);

const excerpts = async (
  world: OlaiWorld,
  id: string,
): Promise<ReadonlyArray<string>> =>
  await world.node(id).locator(DESC_HIT).evaluateAll(
    (lines, owner) =>
      lines
        .filter((line) =>
          line.closest("[data-node-id]")?.getAttribute("data-node-id") === owner
        )
        .map((line) => (line.textContent ?? "").replace(/\s+/g, " ").trim()),
    id,
  );

Then(
  "the node {string} excerpts {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await this.waitUntil(
      async () => (await excerpts(this, id)).some((line) => line.includes(said)),
      `node \`${id}\` excerpts ${JSON.stringify(said)}`,
    ).catch(async () => {
      const drawn = await excerpts(this, id);
      assert.fail(
        `node \`${id}\` excerpts ${JSON.stringify(drawn.join(" · "))}, ` +
          `which does not hold ${JSON.stringify(said)}`,
      );
    });
  },
);

Then(
  "the node {string} draws no excerpt",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await excerpts(this, id)).length === 0,
      `node \`${id}\` draws no excerpt`,
    );
  },
);
const refuses = (
  world: OlaiWorld,
  line: string,
  what: string,
  token: string,
  teaching: string,
): Promise<void> =>
  saysThat(world, line, token, what, "alarm", line === SEARCH_REFUSAL ? world.page : world.frontLane())
    .then(() => saysThat(world, line, teaching, what, undefined, line === SEARCH_REFUSAL ? world.page : world.frontLane()));

Then(
  "the filter refuses {string} and says {string}",
  async function (this: OlaiWorld, token: string, teaching: string) {
    await refuses(this, FILTER_REFUSAL, "filter refusal", token, teaching);
  },
);

Then(
  "the search refuses {string} and says {string}",
  async function (this: OlaiWorld, token: string, teaching: string) {
    await refuses(this, SEARCH_REFUSAL, "search refusal", token, teaching);
  },
);

Then(
  "the search refuses {int} tokens",
  async function (this: OlaiWorld, many: number) {
    await this.waitUntil(
      async () => (await this.page.locator(SEARCH_REFUSAL).count()) === many,
      `the search refuses ${many} tokens`,
    );
  },
);

Then(
  "the filter box holds {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.frontLane().locator(`${FILTER_INPUT}:visible`);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.inputValue(), text);
  },
);

Then(
  "the filter box says {string} when empty",
  async function (this: OlaiWorld, placeholder: string) {
    const box = this.frontLane().locator(`${FILTER_INPUT}:visible`);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.getAttribute("placeholder"), placeholder);
  },
);

const HINT = `${COMPLETIONS}${attr("data-kind", "filter")}`;

When("I focus the filter box", async function (this: OlaiWorld) {
  const box = this.frontLane().locator(`${FILTER_INPUT}:visible`);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await box.focus();
});

When("I press {string} in the filter box", async function (this: OlaiWorld, key: string) {
  await this.frontLane().locator(`${FILTER_INPUT}:visible`).press(key);
  await this.waitForFrame();
});

When("I type {string} into the filter box", async function (this: OlaiWorld, text: string) {
  await this.frontLane().locator(`${FILTER_INPUT}:visible`).pressSequentially(text);
  await this.waitForFrame();
});

Then("the filter hint offers {string}", async function (this: OlaiWorld, forms: string) {
  const wanted = forms.split(" | ");
  const hint = this.page.locator(HINT);
  await hint.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const offered = await hint.locator(COMPLETION_ITEM).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-id")));
  assert.deepStrictEqual(offered, wanted);
});

Then("the filter hint is not shown", async function (this: OlaiWorld) {
  await this.page.locator(HINT).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Then("no row of the filter hint is chosen", async function (this: OlaiWorld) {
  const hint = this.page.locator(HINT);
  await hint.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await hint.locator(`${COMPLETION_ITEM}${attr("data-active", "true")}`).count(), 0);
});

Then("the filter hint's chosen row is {string}", async function (this: OlaiWorld, form: string) {
  await this.page
    .locator(`${HINT} ${COMPLETION_ITEM}${attr("data-active", "true")}${attr("data-id", form)}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I choose {string} from the filter hint", async function (this: OlaiWorld, form: string) {
  const row = this.page.locator(`${HINT} ${COMPLETION_ITEM}${attr("data-id", form)}`);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await row.click();
  await this.waitForFrame();
});

Then("the filter box has the focus", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null)) === "filter-input",
    "the filter box to hold the caret",
  );
});

Then("the filter box has {string} selected", async function (this: OlaiWorld, selected: string) {
  await this.waitUntil(async () => (await this.frontLane().locator(`${FILTER_INPUT}:visible`).evaluate((box) => {
    const input = box as HTMLInputElement;
    return input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
  })) === selected, `the filter box to have "${selected}" selected`);
});

Then("the filter box asks for a Search key and no corrections", async function (this: OlaiWorld) {
  const box = this.frontLane().locator(`${FILTER_INPUT}:visible`);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await box.getAttribute("enterkeyhint"), "search", "the filter box's enterkeyhint");
  assert.strictEqual(await box.getAttribute("autocapitalize"), "none", "the filter box's autocapitalize");
  assert.strictEqual(await box.getAttribute("autocorrect"), "off", "the filter box's autocorrect");
  assert.strictEqual(await box.getAttribute("spellcheck"), "false", "the filter box's spellcheck");
});

Then("there is no filter bar", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(FILTER_BAR).count(),
    0,
    "a filter box is drawn on a page whose address has nowhere to keep one",
  );
});

Then(
  "the address is exactly {string}",
  async function (this: OlaiWorld, address: string) {
    await this.page
      .waitForURL((url) => addressOf(url) === address, {
        timeout: POLL_TIMEOUT,
      })
      .catch(() => undefined);
    assert.strictEqual(this.address(), address);
  },
);

When("I press the tag {string}", async function (this: OlaiWorld, tag: string) {
  await this.press(this.page.locator(TAG).filter({ hasText: tag }).first());
});

When(
  "I press the tag {string} in the row {string}",
  async function (this: OlaiWorld, tag: string, id: string) {
    await this.press(
      this.page
        .locator(`${nodeSelector(id)} ${NODE_TITLE} ${TAG}`)
        .filter({ hasText: tag })
        .first(),
    );
  },
);

Then("tags on this page are pressable", async function (this: OlaiWorld) {
  await this.expectAttribute("main", "data-narrowable", "true", "the page");
  await this.waitUntil(
    async () => (await this.page.locator(TAG).count()) > 0,
    "a tag to be drawn",
  );
});
