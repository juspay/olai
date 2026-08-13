/**
 * The two directions between a row and the conversation.
 *
 * Its own file for the reason `menu_steps.ts` is one: the subject is a SEAM
 * rather than a panel. Half of these steps read the composer and half read the
 * outline, and what makes them one thing is that they are the two ends of one
 * gesture — a row handing the agent a node, and the agent handing the reader a
 * row back.
 *
 * Everything here asks about what a person would see: which chips are on the
 * composer, whether an id in the answer became pressable, which row the page
 * says is the one being pointed at. What the AGENT received is asserted by the
 * agent itself (`agent/fake-acp-agent.ts`'s `context` verb, which reads the id
 * out of its own prompt and calls `read_node` with it) — the one claim a
 * browser cannot make on its own.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  CHAT_CONTEXT_CHIP,
  CHAT_CONTEXT_REMOVE,
  CHAT_ENTRY,
  CHAT_SAID,
  CHAT_WROTE,
  chatNodeRef,
  NODE_REF_ANY,
  nodeSelector,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The chips that are still ARMED, which is the ones that can still be taken
 *  off: the × is drawn on a chip in the composer and never on one that has
 *  gone with a message. Told apart by that rather than by where they sit,
 *  because "it can still be removed" is exactly what "not sent yet" means. */
const armed = (world: OlaiWorld, id?: string) =>
  world.page
    .locator(
      id === undefined
        ? CHAT_CONTEXT_CHIP
        : `${CHAT_CONTEXT_CHIP}[data-node="${id}"]`,
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
    // On the MESSAGE, which is the server's own record of what was sent —
    // never the composer's strip, which is empty by now.
    await this.page
      .locator(`${CHAT_ENTRY}[data-kind="user"] ${CHAT_CONTEXT_CHIP}[data-node="${id}"]`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

// ── the other direction ────────────────────────────────────────────────

/** WHERE a reference is, because the three shapes are three different claims:
 *  the node an olai write was about (the panel's own row), an id the agent
 *  wrote in its prose (rendered markdown, marked because the set declares it),
 *  and a chip on the message. A step that took any of them would pass on a
 *  build where only one worked. */
const WHERE: Readonly<Record<string, string>> = {
  write: CHAT_WROTE,
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
  // three and captures none of them, so the step would have to guess which
  // place it was asked about.
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
    // The whole of the convention: a backtick is not a reference, a DECLARED
    // id is. An agent writes them around file names, flags and words, and
    // those stay what they are.
    //
    // The SPAN is waited for first, and that is the difference between this
    // and a count of zero: until the markdown pipeline lands, the answer is
    // its own escaped text with no `<code>` in it at all, and an absence
    // asserted then is an absence about a paragraph — the same shape of
    // nothing this suite has already been caught believing once.
    await this.page
      .locator(`${CHAT_SAID} code`)
      .filter({ hasText: text })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await this.page
        .locator(`${CHAT_SAID} code${NODE_REF_ANY}`)
        .filter({ hasText: text })
        .count(),
      0,
      `the answer made "${text}" pressable, and nothing in the set declares it`,
    );
  },
);

/** What the AGENT said, and only that.
 *
 *  Scoped to the answer rather than read off the whole transcript, which is a
 *  distinction a sabotage run had to teach: the chips on the message carry the
 *  node's title too, so a scenario matching the title anywhere in the panel
 *  passed on a build where the node never reached the prompt. What proves
 *  receipt is a sentence only the agent can produce — it read the id out of
 *  its prompt and called `read_node` with it. */
Then(
  "the agent's answer says {string}",
  async function (this: OlaiWorld, said: string) {
    await this.page
      .locator(CHAT_SAID)
      .filter({ hasText: said })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the node {string} is focused", async function (this: OlaiWorld, id: string) {
  await this.expectNodeAttribute(id, "data-focused", "true");
  // ...and it is IN THE VIEWPORT, which is the other half of what a reference
  // does and the half the attribute cannot say. Playwright's `isVisible()` is
  // "has a box and is not hidden" — true for a row a mile below the fold — so
  // the box is intersected with the window instead. Polled, because the scroll
  // is smooth: it is a rule about where the page ENDS UP, not about the frame
  // the press happened in.
  const row = this.page.locator(nodeSelector(id)).first();
  await this.waitUntil(
    async () => {
      const box = await row.boundingBox();
      if (box === null) return false;
      const view = this.page.viewportSize();
      if (view === null) return false;
      return box.y + box.height > 0 && box.y < view.height;
    },
    `"${id}" to be on the screen, not merely lit up`,
  );
});
