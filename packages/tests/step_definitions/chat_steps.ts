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
import * as fs from "node:fs";
import * as path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  CHAT_CANCEL,
  CHAT_ENTRY,
  CHAT_ENTRY_STREAMING,
  CHAT_INPUT,
  CHAT_MODEL,
  CHAT_NEW,
  CHAT_NO_AGENT,
  CHAT_PANEL,
  CHAT_QUEUED,
  CHAT_REFUSAL,
  CHAT_SEND,
  CHAT_SESSION,
  CHAT_SESSIONS,
  CHAT_SLASH_COMMAND,
  CHAT_TITLE,
  CHAT_TOGGLE,
  CHAT_TOOL,
  CHAT_TOOL_DETAIL,
  CHAT_TOOL_LOCATIONS,
  CHAT_TOOL_PROGRESS,
  CHAT_TRANSCRIPT,
  CHAT_WORKING,
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
  // The toggle is always in the header (pressed while open). Open-ness is
  // remembered in localStorage, so a reload inside a scenario may come back
  // already open.
  await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  if (!(await panel.isVisible())) {
    await toggle.click();
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
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
  // Visibility semantics of the permanent toggle: still on screen, and pressed
  // while the drawer is open — not the old pill that vanished once open.
  await this.expectAttribute(
    CHAT_TOGGLE,
    "aria-pressed",
    "true",
    "the agent toggle",
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

/** Let a held turn go on. The fake agent waits for this file rather than for a
 *  clock, so "mid-turn" is a state the scenario ENDS rather than one it races.
 *  A dot-file: the store's walk prunes those, so this is not an edit. */
When("the agent is released", async function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), ".agent-release"), "");
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

// ── the three places a running turn shows ──────────────────────────────
//
// One cue is not enough, and the reason is that a person is not always looking
// at the one place it is. The composer says it where the words go, the header
// says it beside the model, and the shut drawer says it because a turn behind
// a closed panel used to be invisible — including when it ended.

Then("the chat input takes typing", async function (this: OlaiWorld) {
  const input = this.page.locator(CHAT_INPUT);
  assert.ok(
    await input.isEnabled(),
    "the composer is turned off while the agent works. A person watching a " +
      "turn has the next message ready long before it ends, and a box that " +
      "is not there is a thought they have to hold in their head.",
  );
});

Then("the chat input still has the caret", async function (this: OlaiWorld) {
  const focused = await this.page.evaluate(
    (id) => document.activeElement?.getAttribute("data-testid") === id,
    "chat-input",
  );
  assert.ok(
    focused,
    "the caret left the composer, so sending a second message means reaching " +
      "for the mouse first",
  );
});

Then("the chat says {int} message is queued", async function (this: OlaiWorld, many: number) {
  await this.waitUntil(
    async () => {
      const shown = this.page.locator(CHAT_QUEUED);
      return (await shown.count()) > 0 &&
        oneLine(await shown.innerText()) === `${many} queued`;
    },
    `the composer to say ${many} queued`,
  );
});

Then("nothing is queued any more", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_QUEUED).count()) === 0,
    "the queue to drain",
    HYDRATION_TIMEOUT,
  );
});

Then("the header says the agent is working", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_WORKING)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the header has stopped saying the agent is working",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_WORKING).count()) === 0,
      "the header to stop saying the agent is working",
      HYDRATION_TIMEOUT,
    );
  },
);

When("I close the agent panel", async function (this: OlaiWorld) {
  // The header toggle is the only close — the panel has no × of its own.
  const toggle = this.page.locator(CHAT_TOGGLE);
  await this.expectAttribute(CHAT_TOGGLE, "aria-pressed", "true", "the agent toggle");
  await toggle.click();
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  await this.expectAttribute(CHAT_TOGGLE, "aria-pressed", "false", "the agent toggle");
});

/** Reopen WITHOUT waiting for the panel to settle — the `Given` in the
 *  background does wait, and mid-turn is exactly when it never would. */
When("I open the agent panel again", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_TOGGLE).click();
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.expectAttribute(CHAT_TOGGLE, "aria-pressed", "true", "the agent toggle");
});

Then("the agent toggle says a turn is running", async function (this: OlaiWorld) {
  // Still on screen while the drawer is shut (and while open): the pulse is
  // the cue that a turn is running behind a closed panel.
  await this.expectAttribute(
    CHAT_TOGGLE,
    "data-busy",
    "true",
    "the agent toggle",
  );
});

Then("the chat says the turn was cancelled", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await transcriptText(this)).includes("cancelled"),
    "the chat to report the cancellation",
  );
});

// ── following the newest line ──────────────────────────────────────────

/** How far the pane is from the bottom, and how far it could be. Both, because
 *  "at the bottom" is only a claim worth making about a pane that HAS a
 *  bottom to be away from — a transcript shorter than its own window is at the
 *  bottom by construction and would pass every assertion here saying nothing. */
const scrollOf = (world: OlaiWorld) =>
  world.page.locator(CHAT_TRANSCRIPT).evaluate((pane) => ({
    fromBottom: pane.scrollHeight - pane.scrollTop - pane.clientHeight,
    overflow: pane.scrollHeight - pane.clientHeight,
  }));

Then(
  "the transcript is scrolled to the newest line",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => {
        const at = await scrollOf(this);
        return at.overflow > 0 && at.fromBottom < 64;
      },
      "the transcript to be following the newest line",
      HYDRATION_TIMEOUT,
    );
  },
);

When("I scroll the transcript to the top", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_TRANSCRIPT)
    .evaluate((pane) => {
      pane.scrollTop = 0;
    });
  await this.waitUntil(
    async () => (await scrollOf(this)).fromBottom > 64,
    "the transcript to be scrolled away from the bottom",
  );
});

Then(
  "the transcript has stayed where I left it",
  async function (this: OlaiWorld) {
    const at = await scrollOf(this);
    assert.ok(
      at.fromBottom > 64,
      "the panel scrolled a reader who had deliberately scrolled away back to " +
        "the newest token. Being yanked out of what the agent did two turns " +
        "ago is worse than a panel that never scrolled at all.",
    );
  },
);

// ── refusals ───────────────────────────────────────────────────────────

Then("the chat shows a refusal", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_REFUSAL)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat shows no refusal", async function (this: OlaiWorld) {
  // The turn has already been asserted to have LANDED by whatever step comes
  // before this one, so there is nothing left to wait for: a refusal, if there
  // were one, would be on screen by now.
  assert.strictEqual(
    await this.page.locator(CHAT_REFUSAL).count(),
    0,
    "the panel drew a refusal for a write that was supposed to land",
  );
});

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

Then("the chat shows a running tool call", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CHAT_TOOL,
    "data-tool-status",
    "in_progress",
    "the tool call frame",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat is streaming an answer", async function (this: OlaiWorld) {
  // `streaming` is DERIVED by the transcript from the one entry it is writing
  // into, so this asserts the state a person sees as a caret — an answer that
  // is still arriving — rather than any text in particular.
  await this.page
    .locator(CHAT_ENTRY_STREAMING)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat is not streaming", async function (this: OlaiWorld) {
  // The other half of the claim above, and the one a panel gets wrong: an
  // answer that never stops growing is an answer with a caret blinking after
  // it forever, and a turn that looks like it is still running.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_ENTRY_STREAMING).count()) === 0,
    "the answer to stop growing",
    HYDRATION_TIMEOUT,
  );
});

/** The FIRST tool frame. Every scenario that reads one is watching the one it
 *  just started; a later turn's calls arrive below it. */
const heldTool = (world: OlaiWorld) => world.page.locator(CHAT_TOOL).first();

When("I unfold the tool call", async function (this: OlaiWorld) {
  await heldTool(this).locator("button").click();
});

Then(
  "the tool call is reporting {string}",
  async function (this: OlaiWorld, said: string) {
    await this.waitUntil(
      async () => {
        const progress = heldTool(this).locator(CHAT_TOOL_PROGRESS);
        return (await progress.count()) > 0 &&
          oneLine(await progress.innerText()).includes(said);
      },
      `the running tool call to report "${said}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the tool call says where it is working",
  async function (this: OlaiWorld) {
    const shown = heldTool(this).locator(CHAT_TOOL_LOCATIONS);
    await shown.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.match(
      oneLine(await shown.innerText()),
      /house\.jsonl:12/,
      "the follow-along location is what lets a reader see WHICH file an agent " +
        "is in without unfolding anything",
    );
  },
);

Then("the tool call's detail is shown", async function (this: OlaiWorld) {
  await heldTool(this)
    .locator(CHAT_TOOL_DETAIL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** What the RESULT said, as the reader gets it. The detail block is the call's
 *  arguments and its answer as the agent reported them, so this is the one
 *  assertion that follows a field of an op's reply all the way from the ops
 *  layer to a person's screen. */
Then(
  "the tool call's detail says {string}",
  async function (this: OlaiWorld, said: string) {
    const detail = heldTool(this).locator(CHAT_TOOL_DETAIL);
    await detail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const shown = oneLine(await detail.innerText());
    assert.ok(
      shown.includes(said),
      `the tool call's detail does not mention "${said}"; it says: ${shown}`,
    );
  },
);

/**
 * An expando on the element itself, which is the only thing that can tell a
 * PATCHED row from a rebuilt one: every attribute a new row is drawn with is
 * one the old row had too, so nothing about how it LOOKS distinguishes them.
 * A property set from outside the framework survives a re-render and does not
 * survive a remount, which is exactly the difference being asserted.
 */
const MARK = "__olaiSameElement";

const mark = (locator: Locator): Promise<void> =>
  locator.evaluate((element, key) => {
    (element as unknown as Record<string, unknown>)[key] = true;
  }, MARK);

const marked = (locator: Locator): Promise<boolean> =>
  locator.evaluate(
    (element, key) => (element as unknown as Record<string, unknown>)[key] === true,
    MARK,
  );

/** The answer currently growing. */
const streamingAnswer = (world: OlaiWorld) =>
  world.page.locator(CHAT_ENTRY_STREAMING).first();

When("I mark the tool call's element", async function (this: OlaiWorld) {
  await mark(heldTool(this));
});

When("I mark the streaming answer's element", async function (this: OlaiWorld) {
  await mark(streamingAnswer(this));
});

Then("the answer has grown", async function (this: OlaiWorld) {
  const before = (await streamingAnswer(this).innerText()).length;
  await this.waitUntil(
    async () => (await streamingAnswer(this).innerText()).length > before,
    "the streaming answer to take another chunk",
  );
});

Then(
  "the streaming answer is the element I marked",
  async function (this: OlaiWorld) {
    assert.ok(
      await marked(streamingAnswer(this)),
      "the answer was drawn again from scratch when the next chunk arrived. A " +
        "paragraph rebuilt per token loses the reader's selection and the " +
        "scroll position several times a second — the row is meant to be " +
        "patched in place.",
    );
  },
);

Then("the tool call is the element I marked", async function (this: OlaiWorld) {
  assert.ok(
    await marked(heldTool(this)),
    "the tool call was drawn again from scratch when its status changed. A row " +
      "rebuilt on every update throws away everything it owns — an unfolded " +
      "detail, a selection, the scroll position — while the reader is looking " +
      "at it. Rows are keyed by id and read their value lazily so that an " +
      "update patches them in place.",
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

When("I start a new conversation", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_NEW).click();
});

Then("the chat is empty", async function (this: OlaiWorld) {
  // A new conversation EMPTIES the panel. The agent's context is gone, so
  // nothing above could be followed up — a transcript you cannot refer to is
  // history the panel would be keeping for its own sake.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_ENTRY).count()) === 0,
    "the transcript to empty",
    HYDRATION_TIMEOUT,
  );
});

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
