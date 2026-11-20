import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  CHAT_SAID,
  OUTLINES_STORY,
  chatNodeRef,
  NODE_REF_ANY,
  nodeSelector,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  CHAT_CONTEXT_CHIP,
  CHAT_CONTEXT_REMOVE,
  CHAT_ENTRY,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const armed = (world: OlaiWorld, id?: string) =>
  world.chat(
      id === undefined
        ? CHAT_CONTEXT_CHIP
        : `${CHAT_CONTEXT_CHIP}${attr("data-node", id)}`,
    )
    .filter({ has: world.page.locator(CHAT_CONTEXT_REMOVE) });

Then(
  "the composer is armed with {string}",
  async function (this: OlaiWorld, id: string) {
    await armed(this, id).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the composer is armed with nothing", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await armed(this).count()) === 0,
    "the composer's context strip to be empty",
  );
});

When(
  "I take the armed node {string} off",
  async function (this: OlaiWorld, id: string) {
    await this.press(armed(this, id).locator(CHAT_CONTEXT_REMOVE));
  },
);

Then(
  "the message was about {string}",
  async function (this: OlaiWorld, id: string) {
    await this.chat(`${CHAT_ENTRY}[data-kind="user"] ${CHAT_CONTEXT_CHIP}${attr("data-node", id)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

const WHERE: Readonly<Record<string, string>> = {
  write: OUTLINES_STORY,
  answer: CHAT_SAID,
  message: `${CHAT_ENTRY}[data-kind="user"]`,
};

const referenceIn = (world: OlaiWorld, where: string, id: string) => {
  const scope = WHERE[where];
  if (scope === undefined) {
    throw new Error(
      `no such place for a reference: ${JSON.stringify(where)} — ` +
        `expected one of ${Object.keys(WHERE).join(", ")}`,
    );
  }
  return world.page.locator(`${scope} ${chatNodeRef(id)}`).first();
};

When(
  // `{word}` and not an alternation: Cucumber's `a/b/c` matches any of the
  // three and captures none of them.
  "I press the node {string} in the {word}",
  async function (this: OlaiWorld, id: string, where: string) {
    const reference = referenceIn(this, where, id);
    await reference.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.press(reference);
  },
);

Then(
  "the agent's answer names the node {string}",
  async function (this: OlaiWorld, id: string) {
    await referenceIn(this, "answer", id).waitFor({
      state: "visible",
      timeout: POLL_TIMEOUT,
    });
  },
);

Then(
  "the agent's answer does not make {string} a reference",
  async function (this: OlaiWorld, text: string) {
    await this.chat(`${CHAT_SAID} code`)
      .filter({ hasText: text })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await this.chat(`${CHAT_SAID} ${NODE_REF_ANY}`)
        .filter({ hasText: text })
        .count(),
      0,
      `the answer made "${text}" pressable, and nothing in the set declares it`,
    );
  },
);

Then(
  "the agent's answer says {string}",
  async function (this: OlaiWorld, said: string) {
    await this.chat(CHAT_SAID)
      .filter({ hasText: said })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the node {string} is focused", async function (this: OlaiWorld, id: string) {
  await this.expectNodeAttribute(id, "data-focused", "true");
  // Playwright's `isVisible()` is "has a box and is not hidden" — true for a
  // row a mile below the fold — so the box is intersected with the window
  // instead.
  const row = this.page.locator(nodeSelector(id)).first();
  await this.waitUntil(
    async () => {
      const box = await row.boundingBox();
      if (box === null) return false;
      return box.y + box.height > 0 && box.y < this.viewport().height;
    },
    `"${id}" to be on the screen, not merely lit up`,
  );
});

Then("the initial armed-node lookup has been sent", async function(this: OlaiWorld) {
  await this.waitUntil(async () => this.socketAskedSince("nodes/named") >= 1, "the first arming lookup to leave");
});

Then("the armed node {string} is labelled {string}", async function(this: OlaiWorld, id: string, title: string) {
  await this.waitUntil(async () => (await armed(this, id).innerText()).includes(title), `armed ${id} to show ${title}`);
});
