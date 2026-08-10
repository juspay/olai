/**
 * The agent panel, driven through the browser.
 *
 * Every assertion here is about the PAGE — what a person would see — because
 * everything below it already has unit tests: the ops layer has its own, the
 * write gate has its own, the MCP surface has its own. What only an e2e can
 * say is that a sentence typed into a box reaches an outline on disk and comes
 * back as a checkbox, without a reload.
 *
 * Waits use the world's `waitUntil` rather than a locator wherever the claim is
 * "this CHANGED" — a transcript row's text growing, a status attribute moving —
 * which is most of what a streaming panel does.
 */

import * as assert from "node:assert";
import { DataTable, Given, Then, When } from "@cucumber/cucumber";

import {
  CHAT_CANCEL,
  CHAT_INPUT,
  CHAT_MODEL,
  CHAT_NO_AGENT,
  CHAT_PANEL,
  CHAT_REFUSAL,
  CHAT_SEND,
  CHAT_SESSION,
  CHAT_SESSIONS,
  CHAT_SLASH_COMMAND,
  CHAT_TITLE,
  CHAT_TOGGLE,
  CHAT_TOOL,
  CHAT_TOOL_DETAIL,
  CHAT_TRANSCRIPT,
  CHAT_UNFINISHED_CHILD,
  HYDRATION_TIMEOUT,
  NODE_TITLE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Given("the agent panel is open", async function (this: OlaiWorld) {
  const toggle = this.page.locator(CHAT_TOGGLE);
  const panel = this.page.locator(CHAT_PANEL);
  // Whichever it is in — the toggle is remembered in localStorage, so a reload
  // inside a scenario may come back already open.
  if (await panel.isVisible()) return;
  await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await toggle.click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // Settled means the agent has finished handshaking — or that there is no
  // agent to wait for. Both are states a reader can act on; `booting` and
  // `gone` are not, so a boot that failed still times out here rather than
  // letting the next step fail somewhere less informative.
  await this.waitUntil(
    async () => {
      const status = await this.page.locator(CHAT_PANEL).getAttribute("data-status");
      return status === "idle" || status === "off";
    },
    "the agent panel to settle (idle, or off with no agent configured)",
    HYDRATION_TIMEOUT,
  );
});

// ── talking ────────────────────────────────────────────────────────────

const typeInto = async (world: OlaiWorld, text: string): Promise<void> => {
  const input = world.page.locator(CHAT_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await input.fill(text);
};

When("I ask the agent {string}", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
  await this.page.locator(CHAT_SEND).click();
});

When("I type {string} into the chat", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
});

When("I cancel the turn", async function (this: OlaiWorld) {
  const cancel = this.page.locator(CHAT_CANCEL);
  await cancel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await cancel.click();
});

// ── what the panel says ────────────────────────────────────────────────

/** The whole transcript as one line. Read as text rather than row by row
 *  because most claims here are "the conversation eventually says this", and
 *  which ROW it landed in is the panel's business. */
const transcriptText = async (world: OlaiWorld): Promise<string> => {
  const pane = world.page.locator(CHAT_TRANSCRIPT);
  if ((await pane.count()) === 0) return "";
  return oneLine(await pane.innerText());
};

Then(
  "the chat eventually shows {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await transcriptText(this)).includes(text),
      `the chat to say "${text}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the agent's answer mentions {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await transcriptText(this)).includes(text),
      `the agent to mention "${text}"`,
    );
  },
);

Then("the agent is working", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CHAT_PANEL,
    "data-status",
    "thinking",
    "the agent panel",
  );
});

Then("the agent is idle", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CHAT_PANEL,
    "data-status",
    "idle",
    "the agent panel",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat says the turn was cancelled", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await transcriptText(this)).includes("cancelled"),
    "the chat to report the cancellation",
  );
});

// ── refusals ───────────────────────────────────────────────────────────

Then("the chat shows a refusal", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_REFUSAL)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the refusal lists the unfinished children:",
  async function (this: OlaiWorld, table: DataTable) {
    const wanted = table.raw().map(([id]) => id ?? "");
    await this.waitUntil(
      async () =>
        (await this.page.locator(CHAT_UNFINISHED_CHILD).count()) >= wanted.length,
      `the refusal to list ${wanted.length} unfinished children`,
    );
    const listed = await this.page
      .locator(CHAT_UNFINISHED_CHILD)
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-node-id") ?? ""),
      );
    assert.deepStrictEqual(
      [...listed].sort(),
      [...wanted].sort(),
      // The whole point of the structured refusal: the children are DATA, so a
      // scenario can name them. A prose summary would make this unassertable.
      `the refusal lists ${listed.join(", ") || "nothing"}`,
    );
  },
);

// ── tool frames ────────────────────────────────────────────────────────

Then("the chat shows a completed tool call", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CHAT_TOOL,
    "data-tool-status",
    "completed",
    "the tool call frame",
    HYDRATION_TIMEOUT,
  );
});

Then("the tool call's detail is folded away", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_TOOL_DETAIL).count(),
    0,
    "a tool call's arguments are drawn unfolded; a turn's worth of them would " +
      "bury the conversation they belong to",
  );
});

// ── slash completion ───────────────────────────────────────────────────

Then(
  "the completion offers {string}",
  async function (this: OlaiWorld, name: string) {
    await this.page
      .locator(`${CHAT_SLASH_COMMAND}[data-command="${name}"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When("I accept the completion", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_INPUT).press("Enter");
});

Then(
  "the chat input reads {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_INPUT).inputValue()) === text,
      `the input to read "${text}"`,
    );
  },
);

// ── sessions ───────────────────────────────────────────────────────────

Then(
  "the conversation is titled {string}",
  async function (this: OlaiWorld, title: string) {
    await this.waitUntil(
      async () =>
        oneLine(await this.page.locator(CHAT_TITLE).innerText()) === title,
      `the conversation to be titled "${title}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

When("I open the session picker", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_SESSIONS).click();
});

Then("the picker lists {string}", async function (this: OlaiWorld, title: string) {
  await this.page
    .locator(CHAT_SESSION, { hasText: title })
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When(
  "I pick the conversation {string}",
  async function (this: OlaiWorld, title: string) {
    await this.page.locator(CHAT_SESSION, { hasText: title }).first().click();
  },
);

// ── what the OUTLINE did about it ──────────────────────────────────────

Then("node {string} is done", async function (this: OlaiWorld, id: string) {
  // The HYDRATION budget, not the interaction one: getting here is a prompt, a
  // turn, a tool call, a write and a fresh snapshot down the wire — not a
  // render away. Everything else about the assertion is the world's own
  // node-status step (`outline_tree_steps.ts`), reached through the same
  // `nodeSelector` so a renamed `data-testid` stays a type error.
  await this.expectAttribute(
    nodeSelector(id),
    "data-status",
    "done",
    `node "${id}"`,
    HYDRATION_TIMEOUT,
  );
});

Then("node {string} is not done", async function (this: OlaiWorld, id: string) {
  const status = await this.nodeAttribute(id, "data-status");
  assert.notStrictEqual(
    status,
    "done",
    `node "${id}" was marked done by a write that should have been refused`,
  );
});

Then(
  "the tree eventually shows a node titled {string}",
  async function (this: OlaiWorld, title: string) {
    await this.waitUntil(
      async () => {
        const titles = await this.page
          .locator(NODE_TITLE)
          .evaluateAll((rows) => rows.map((row) => row.textContent ?? ""));
        return titles.some((each) => oneLine(each) === title);
      },
      `the tree to show a node titled "${title}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the panel header names the model {string}",
  async function (this: OlaiWorld, model: string) {
    // The model arrives on the session's config options and is LABELLED from
    // the picker the agent offers — so asserting the label rather than the raw
    // id is what says the labelling happened at all.
    await this.waitUntil(
      async () => {
        const header = this.page.locator(CHAT_MODEL);
        return (await header.count()) > 0 &&
          oneLine(await header.innerText()) === model;
      },
      `the header to name the model "${model}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

// ── no agent at all ────────────────────────────────────────────────────

Then("the panel says there is no agent", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_NO_AGENT)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the panel explains how to configure one, naming {string}",
  async function (this: OlaiWorld, variable: string) {
    const said = oneLine(await this.page.locator(CHAT_NO_AGENT).innerText());
    assert.ok(
      said.includes(variable),
      `the no-agent message does not name \`${variable}\`, so it says a feature is ` +
        `missing without saying what would bring it back. It reads: ${said}`,
    );
  },
);

Then("there is nothing to type into", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_INPUT).count(),
    0,
    "the composer is drawn with no agent to send to — a box that cannot send " +
      "is worse than the explanation that replaces it",
  );
});
