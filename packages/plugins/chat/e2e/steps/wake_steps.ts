import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";

import {
  attr,
  CHAT_MINE,
  CHAT_INPUT,
  CHAT_WAKE_FILE,
  CHAT_WAKE_QUERY,
  NODE_REF_ANY,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  CHAT_ENTRY,
  CHAT_PLUGIN_MARK,
  CHAT_RANG,
  CHAT_RANG_BODY,
  CHAT_RANG_BYLINE,
  CHAT_RANG_FOLD,
  CHAT_RESEND,
  CHAT_WAKE,
  CHAT_WAKE_FAULT,
  CHAT_WAKE_WAITING,
  CHAT_WAKE_PICKER,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const thePicker = async (world: OlaiWorld, plugin: string): Promise<Locator> => {
  const strip = world.chat(CHAT_WAKE);
  await strip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const picker = world.chat(`${CHAT_WAKE_PICKER}${attr("data-plugin", plugin)}`);
  await picker.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return picker;
};

const pointedAt = async (
  world: OlaiWorld,
  plugin: string,
  expected: string,
): Promise<void> => {
  await world.expectAttribute(
    world.chatSelector(`${CHAT_WAKE_PICKER}${attr("data-plugin", plugin)}`),
    "data-file",
    expected,
    `${plugin}'s wake control`,
  );
};

Then(
  "this conversation's {string} wake is on nothing",
  async function (this: OlaiWorld, plugin: string) {
    await thePicker(this, plugin);
    await pointedAt(this, plugin, "off");
  },
);

When(
  "I point this conversation's {string} wake at {string}",
  async function (this: OlaiWorld, plugin: string, file: string) {
    await this.press(await thePicker(this, plugin));
    const query = this.chat(CHAT_WAKE_QUERY);
    await query.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await query.fill(file);
    await this.press(this.chat(`${CHAT_WAKE_FILE}${attr("data-file", file)}`));
  },
);

Then(
  "this conversation's {string} wake is on {string}",
  async function (this: OlaiWorld, plugin: string, file: string) {
    await pointedAt(this, plugin, file);
  },
);

Then("this conversation offers no {string} wake control", async function (this: OlaiWorld, plugin: string) {
  await this.chat(`${CHAT_WAKE_PICKER}${attr("data-plugin", plugin)}`).waitFor({
    state: "detached", timeout: POLL_TIMEOUT,
  });
});

When("I clear this conversation's {string} wake", async function (this: OlaiWorld, plugin: string) {
  const row = (await thePicker(this, plugin)).locator('xpath=ancestor::*[.//button[normalize-space(.)="Clear"]][1]');
  await this.press(row.getByRole("button", { name: "Clear", exact: true }));
});

When("the watch is told to report a held terminal at once", function (this: OlaiWorld) {
  this.writeServed(
    "_olai/Settings.olai",
    `{"id":"kolu","ord":"a0","title":"kolu"}\n{"id":"watch","parent":"kolu","ord":"a0","title":"watch","custom":{"held-for":"0s"}}`,
  );
});

const rungRow = (world: OlaiWorld): Locator =>
  world.chat(CHAT_ENTRY).filter({ has: world.page.locator(CHAT_RANG) });



Then(
  "that sentence wears {string}'s own logo",
  async function (this: OlaiWorld, plugin: string) {
    const mark = this.chat(`${CHAT_PLUGIN_MARK}${attr("data-mark", plugin)}`);
    await this.waitUntil(
      async () => (await mark.locator("linearGradient").count()) >= 1,
      "the machine's row to wear a mark built from the pinned brand asset",
    );
    assert.equal(
      await mark.count(),
      1,
      `no mark stamped ${plugin} — the panel fell back to its generic glyph, so the ` +
        "plugin's own never reached it",
    );
  },
);
Then(
  "that sentence can be pressed through to the board",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () =>
        (await rungRow(this).first().locator(`${CHAT_RANG_BYLINE} ${NODE_REF_ANY}`).count()) >= 1,
      "the machine's head line to carry a pressable node reference",
    );
  },
);
Then(
  "that sentence is one line, with its account folded away",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await rungRow(this).first().locator(CHAT_RANG_FOLD).count()) === 1,
      "the machine's row to draw a fold control",
    );
    assert.equal(
      await rungRow(this).first().locator(CHAT_RANG_BODY).count(),
      0,
      "a machine's row draws its account before anybody asked for it",
    );
  },
);

When("I open that sentence", async function (this: OlaiWorld) {
  await rungRow(this).first().locator(CHAT_RANG_FOLD).click();
  await this.waitUntil(
    async () => (await rungRow(this).first().locator(CHAT_RANG_BODY).count()) === 1,
    "the machine's account to come out of the fold",
  );
});
Then("the chat shows a sentence no person typed", async function (this: OlaiWorld) {
  await this.chat(CHAT_RANG)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the chat shows no sentence no person typed", async function (this: OlaiWorld) {
  const since = Date.now()
  await this.waitUntil(
    async () =>
      (await this.chat(CHAT_RANG).count()) === 0 && Date.now() - since >= 800,
    "the chat to stay without a machine-sent sentence",
  )
});

Then(
  "that sentence was rung by {string}",
  async function (this: OlaiWorld, plugin: string) {
    await this.expectAttribute(this.chatSelector(CHAT_RANG),
      "data-rang-by",
      plugin,
      "the machine's message",
    );
  },
);

Then(
  "that sentence names {string}",
  async function (this: OlaiWorld, words: string) {
    await this.waitUntil(
      async () => ((await rungRow(this).first().textContent()) ?? "").includes(words),
      `the machine's message to name ${JSON.stringify(words)}`,
    );
  },
);

Then(
  "that sentence does not name {string}",
  async function (this: OlaiWorld, words: string) {
    const said = (await rungRow(this).first().textContent()) ?? "";
    assert.ok(
      !said.includes(words),
      `the machine's message names ${JSON.stringify(words)}:\n${said}`,
    );
  },
);

Then("that sentence is not one of my own messages", async function (this: OlaiWorld) {
  assert.strictEqual(
    await rungRow(this).locator(CHAT_MINE).count(),
    0,
    "the machine's sentence was drawn as the person's own message",
  );
});

Then("that sentence offers no way to send it again", async function (this: OlaiWorld) {
  assert.strictEqual(
    await rungRow(this).locator(CHAT_RESEND).count(),
    0,
    "the machine's sentence offered a *send again*, which would re-send a " +
      "claim about a moment that has passed",
  );
});

Then(
  "the chat input still holds {string}",
  async function (this: OlaiWorld, text: string) {
    const input = this.chat(CHAT_INPUT);
    for (let look = 0; look < 5; look += 1) {
      assert.strictEqual(
        await input.inputValue(),
        text,
        "the machine's message changed what was in the composer",
      );
      await this.page.waitForTimeout(100);
    }
  },
);

Then("this conversation's {string} missing-file warning is queued", async function (this: OlaiWorld, plugin: string) {
  const row = (await thePicker(this, plugin))
    .locator('xpath=ancestor::*[.//*[@data-testid="chat-wake-fault"]][1]');
  await this.waitUntil(async () =>
    await row.locator(CHAT_WAKE_FAULT).getAttribute("data-fault") === "gone"
      && await row.locator(CHAT_WAKE_WAITING).getAttribute("data-waiting") === "1",
  `${plugin}'s missing-file warning to be queued`);
});

Then("the conversation has received no plugin messages", async function (this: OlaiWorld) {
  assert.strictEqual(await rungRow(this).count(), 0);
});
