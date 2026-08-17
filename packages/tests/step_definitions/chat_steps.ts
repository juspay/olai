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

import { selector, TESTID, type TestId } from "@olai/web/src/client/testids.ts";

import {
  CHAT_ASK,
  CHAT_ASK_CHOICE,
  CHAT_ASK_DISMISS,
  CHAT_ASK_OUTCOME,
  CHAT_ASK_SUBMIT,
  CHAT_ASK_TEXT,
  CHAT_ATTACHMENT,
  CHAT_ATTACHMENT_PREVIEW,
  CHAT_ATTACH_BUTTON,
  CHAT_ATTACHMENT_SIZE,
  CHAT_CANCEL,
  CHAT_COMPLETION,
  CHAT_COMPLETION_ROW,
  CHAT_DIFF,
  CHAT_DIFF_EXPAND,
  CHAT_DIFF_GUTTER,
  CHAT_DIFF_LINE,
  CHAT_DIFF_MARK,
  CHAT_DIFF_TEXT,
  CHAT_DIFF_WHOLESALE,
  CHAT_DROP,
  CHAT_ENTRY,
  CHAT_ENTRY_STREAMING,
  CHAT_INPUT,
  CHAT_LANE,
  CHAT_LANE_LABEL,
  CHAT_MINE,
  CHAT_MISSING,
  CHAT_MISSING_SERVER,
  CHAT_MISSING_WHY,
  CHAT_MODEL,
  CHAT_NEW,
  CHAT_NO_AGENT,
  CHAT_NUDGE,
  CHAT_OUTLINE_CHANGE,
  CHAT_OUTLINE_DIFF,
  CHAT_PANEL,
  CHAT_REFUSAL,
  CHAT_RESEND,
  CHAT_SAID,
  CHAT_SEND,
  CHAT_SESSION,
  CHAT_SESSION_LIST,
  CHAT_SESSIONS,
  CHAT_SESSIONS_REFUSED,
  CHAT_SPAWN,
  CHAT_SPAWN_WORKING,
  CHAT_TITLE,
  CHAT_TOGGLE,
  CHAT_TOOL,
  CHAT_TOOL_DETAIL,
  CHAT_TOOL_FOLD,
  CHAT_TOOL_LOCATIONS,
  CHAT_TOOL_PROGRESS,
  CHAT_TRANSCRIPT,
  CHAT_TROUBLE,
  CHAT_UNSENT,
  CHAT_USAGE,
  CHAT_WAITING,
  CHAT_WORKING,
  CHAT_WROTE,
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

/** Send WHAT IS IN THE BOX, rather than typing a message and sending it in one
 *  gesture (`I ask the agent`). A scenario that got the words there some other
 *  way — a completion taken, a draft put back — has to be able to press the
 *  button without retyping over what it is asserting about. */
When("I send the chat message", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_SEND).click();
});

/** Let a held turn go on. The fake agent waits for this file rather than for a
 *  clock, so "mid-turn" is a state the scenario ENDS rather than one it races.
 *  A dot-file: the store's walk prunes those, so this is not an edit. */
When("the agent is released", async function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), ".agent-release"), "");
});

/** Take a stored conversation out of the agent's store, the way a deleted
 *  session or a cleaned-out store would. The next boot's `session/list` no
 *  longer offers it, so a panel that remembers being in it has to fall back.
 *  The same dot-file idiom the release above uses, and not an edit either. */
When(
  "the conversation {string} is gone from the agent",
  function (this: OlaiWorld, id: string) {
    fs.writeFileSync(path.join(this.scratch(), `.agent-forgot-${id}`), "");
  },
);

/** Move the model the agent PINS — its `settings.json`, in effect, which is
 *  the thing a redeploy edits. Read at every session open, so a scenario arms
 *  it between two boots and the next one comes up on it. The same dot-file
 *  idiom as the two above, and not an edit either. */
When(
  "the agent's pinned model becomes {string}",
  function (this: OlaiWorld, model: string) {
    fs.writeFileSync(path.join(this.scratch(), ".agent-pin"), model);
  },
);

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

/** A bubble of my own, by what it says. Two steps ask for one — "the chat
 *  shows my message X" and "… as not sent" — and which element counts as mine
 *  is one answer, not two. */
const myMessage = (world: OlaiWorld, text: string): Locator =>
  world.page.locator(CHAT_MINE).filter({ hasText: text });

Then(
  "the chat shows my message {string}",
  async function (this: OlaiWorld, text: string) {
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("my message sits to the right of the agent's", async function (this: OlaiWorld) {
  // Alignment is a property no attribute can carry: `data-kind="user"` already
  // says who spoke, and a class is a styling decision a refactor may change.
  // The claim is that a glance can tell the two speakers apart, which is
  // where they sit — so this is the same exception `world.box` exists for.
  const mine = await this.box(
    this.page.locator(CHAT_MINE).first(),
    "my message",
  );
  const said = await this.box(
    this.page.locator(CHAT_SAID).first(),
    "the agent's answer",
  );
  const pane = await this.box(
    this.page.locator(CHAT_TRANSCRIPT),
    "the transcript",
  );
  assert.ok(
    mine.x > said.x,
    `my message starts at ${mine.x}, the agent's at ${said.x} — they should not share a left edge`,
  );
  // Right-aligned means more empty pane on the left of the bubble than on
  // its right. Comparing right edges would not say that: the agent's prose
  // is a full-width block, so both boxes end at the same padding.
  const left = mine.x - pane.x;
  const right = pane.x + pane.width - (mine.x + mine.width);
  assert.ok(
    left > right,
    `my message has ${left}px of pane on its left and ${right}px on its right — it should sit on the right`,
  );
});

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
    TESTID.chatInput,
  );
  assert.ok(
    focused,
    "the caret left the composer, so sending a second message means reaching " +
      "for the mouse first",
  );
});

// ── words the agent would not take ─────────────────────────────────────
//
// The row is the copy. There is no queue behind the panel any more, so a
// message the agent refused has exactly one place to be, and it is on screen
// where it was typed — which is what these three steps are about.

Then(
  "the chat shows my message {string} as not sent",
  async function (this: OlaiWorld, text: string) {
    // The BUBBLE has to still say it. A row that reported the failure and lost
    // the words would pass a check for the mark alone, and losing the words is
    // the whole thing this feature exists to stop.
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_UNSENT).count()) > 0,
      `"${text}" to be marked as not sent`,
      HYDRATION_TIMEOUT,
    );
  },
);

When("I send the unsent message again", async function (this: OlaiWorld) {
  // `press` rather than a hand-rolled wait-then-click: it also waits out the
  // frame the click schedules, and the very next step reads the row this
  // press is about.
  await this.press(this.page.locator(CHAT_RESEND).first());
});

Then("no message is marked unsent", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_UNSENT).count()) === 0,
    "the unsent mark to come off",
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

// ── questions the agent asked ──────────────────────────────────────────
//
// Every step here drives the FIRST question on screen: a scenario that asks one
// is watching the one it just asked, and a later turn's would arrive below it.

const question = (world: OlaiWorld) => world.page.locator(CHAT_ASK).first();

Then("the chat shows a question", async function (this: OlaiWorld) {
  await question(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(
    async () => (await question(this).getAttribute("data-asking")) === "true",
    "the question to be waiting for an answer",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat shows no question", async function (this: OlaiWorld) {
  // The turn has already been asserted to have landed by the step before this
  // one, so a form — if there were one — would be on screen by now.
  assert.strictEqual(
    await this.page.locator(CHAT_ASK).count(),
    0,
    "the panel asked a person about something it is supposed to answer itself",
  );
});

Then(
  "the question offers {string}",
  async function (this: OlaiWorld, value: string) {
    await question(this)
      .locator(`${CHAT_ASK_CHOICE}[data-value="${value}"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** By its LABEL, which is what a person reads and presses. `data-value` is the
 *  string that travels back, and the two part company exactly where it
 *  matters — `auto` is spelled `Yes, and use "auto" mode` on screen. */
When("I choose {string}", async function (this: OlaiWorld, label: string) {
  await question(this)
    .locator(CHAT_ASK_CHOICE, { hasText: label })
    .first()
    .click();
});

When(
  "I type {string} into the question's other box",
  async function (this: OlaiWorld, text: string) {
    await question(this)
      .locator(`${CHAT_ASK_TEXT}[data-field$="_custom"]`)
      .fill(text);
  },
);

When(
  "I type {string} into the question's {string} box",
  async function (this: OlaiWorld, text: string, field: string) {
    await question(this)
      .locator(`${CHAT_ASK_TEXT}[data-field="${field}"]`)
      .fill(text);
  },
);

Then(
  "the question's {string} box still reads {string}",
  async function (this: OlaiWorld, field: string, text: string) {
    const box = question(this).locator(`${CHAT_ASK_TEXT}[data-field="${field}"]`);
    assert.strictEqual(
      await box.inputValue(),
      text,
      "the panel threw away what was typed on a submit the server refused. The " +
        "refusal deliberately leaves the question waiting so nothing is " +
        "recorded that the agent was never sent — a blank form under it makes " +
        "typing the whole answer again the only way to act on it.",
    );
  },
);

When("I answer the question", async function (this: OlaiWorld) {
  await question(this).locator(CHAT_ASK_SUBMIT).click();
});

When("I dismiss the question", async function (this: OlaiWorld) {
  await question(this).locator(CHAT_ASK_DISMISS).click();
});

Then("the question has been answered", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await question(this).getAttribute("data-how")) === "answered",
    "the question to record that it was answered",
    HYDRATION_TIMEOUT,
  );
});

Then("the question says I dismissed it", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await question(this).getAttribute("data-how")) === "declined",
    "the question to record that it was dismissed",
    HYDRATION_TIMEOUT,
  );
  assert.match(
    oneLine(await question(this).locator(CHAT_ASK_OUTCOME).innerText()),
    /dismissed/,
    "the row does not say what became of the question, so a reader scrolling " +
      "back cannot tell a dismissal from an answer nobody remembers giving",
  );
});

Then(
  "the question shows {string} as what I chose",
  async function (this: OlaiWorld, value: string) {
    // Off the ROW rather than off this tab's memory of the click: a reloaded
    // page has no memory of the click, which is the point of asking.
    await this.expectAttribute(
      `${CHAT_ASK} ${CHAT_ASK_CHOICE}[data-value="${value}"]`,
      "aria-pressed",
      "true",
      `the chosen option "${value}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the question can no longer be answered",
  async function (this: OlaiWorld) {
    // The form STAYS — it is the record of what was asked and chosen — so what
    // has to be true is that it cannot be answered twice.
    assert.strictEqual(
      await question(this).locator(CHAT_ASK_SUBMIT).count(),
      0,
      "an answered question still offers a submit, so it can be answered again",
    );
    const live = await question(this)
      .locator(CHAT_ASK_CHOICE)
      .evaluateAll((chips) =>
        chips.filter((chip) => !(chip as HTMLButtonElement).disabled).length
      );
    assert.strictEqual(
      live,
      0,
      "an answered question still has live options, so what it records could " +
        "be changed under the answer that was already sent",
    );
  },
);

Then(
  "the question says the agent took it back",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await question(this).getAttribute("data-how")) === "withdrawn",
      "the question to record that it was withdrawn",
      HYDRATION_TIMEOUT,
    );
    assert.strictEqual(
      await question(this).locator(CHAT_ASK_SUBMIT).count(),
      0,
      "a question nobody is waiting on any more can still be answered, so the " +
        "button does nothing and pressing it is how you find out",
    );
  },
);

Then(
  "the composer says the agent is waiting on me",
  async function (this: OlaiWorld) {
    // Nothing times out a blocked turn: a form scrolled off the top of a long
    // transcript is otherwise indistinguishable from an agent that is thinking.
    await this.page
      .locator(CHAT_WAITING)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the composer has stopped saying the agent is waiting on me",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_WAITING).count()) === 0,
      "the composer to stop saying the agent is waiting",
      HYDRATION_TIMEOUT,
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
  await heldTool(this).locator(CHAT_TOOL_FOLD).click();
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
      /house\.olai:12/,
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

// ── what a call changed ────────────────────────────────────────────────

/** The FIRST diff drawn, which is the one the turn just produced. */
const shownDiff = (world: OlaiWorld) => world.page.locator(CHAT_DIFF).first();

Then(
  "the chat shows a diff of {string}",
  async function (this: OlaiWorld, file: string) {
    // By PATH, root-relative: the protocol sends an absolute one, and a reader
    // of this directory should see it spelled the way every `file:line` here
    // is.
    await this.page
      .locator(`${CHAT_DIFF}[data-path="${file}"]`)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

/**
 * How many boxes one file's change is drawn in — the count, because the shape
 * this exists for is one file arriving as SEVERAL blocks.
 *
 * A polling `expect` rather than a bare `count()`: the two hunks arrive on the
 * report AFTER the one that drew the first, so a count read the moment the
 * first box appears is a count of one, every time, whether or not the second
 * ever lands.
 */
Then(
  "the chat shows {int} diffs of {string}",
  async function (this: OlaiWorld, many: number, file: string) {
    const boxes = this.page.locator(`${CHAT_DIFF}[data-path="${file}"]`);
    await this.page.waitForFunction(
      ([selector, wanted]) =>
        document.querySelectorAll(selector as string).length === wanted,
      [`${CHAT_DIFF}[data-path="${file}"]`, many] as const,
      { timeout: HYDRATION_TIMEOUT },
    );
    assert.strictEqual(
      await boxes.count(),
      many,
      `the panel drew a different number of boxes for "${file}" than the ${many} ` +
        "blocks the agent sent. An edit reported as several hunks is several " +
        "changes to one file, and each of them is a row",
    );
  },
);

Then("the chat shows no diff", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_DIFF).count(),
    0,
    "an olai write drew a text diff. A `.olai` diff is one enormous line per " +
      "node with everything on it changing at once — the panel's job for a " +
      "write is the node-level story, and this is the rule that says so",
  );
});

Then("the diff is trimmed", async function (this: OlaiWorld) {
  const rows = await shownDiff(this).locator(CHAT_DIFF_LINE).count();
  const whole = oneLine(await shownDiff(this).locator(CHAT_DIFF_EXPAND).innerText());
  assert.match(
    whole,
    /more lines/,
    `the diff drew all ${rows} of its rows; a turn that rewrote four files ` +
      "would bury the conversation it belongs to",
  );
});

When("I expand the diff", async function (this: OlaiWorld) {
  await shownDiff(this).locator(CHAT_DIFF_EXPAND).click();
});

Then("the diff is expanded", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CHAT_DIFF,
    "data-expanded",
    "true",
    "the diff",
    POLL_TIMEOUT,
  );
});

/**
 * Nothing in the diff — or in the panel that holds it — may grow a horizontal
 * scrollbar. Asked of the boxes that would actually scroll (`overflow-x: auto`
 * / `scroll`), not of every descendant: a truncated path has `scrollWidth`
 * past `clientWidth` by design and draws an ellipsis, not a bar.
 */
Then("the diff does not scroll sideways", async function (this: OlaiWorld) {
  const box = shownDiff(this);
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const panned = await this.page.evaluate(
    ({ diffSel, panelSel }) => {
      const over = (node: Element): boolean => {
        const ox = getComputedStyle(node).overflowX;
        return (ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 1;
      };
      const named = (node: Element): string =>
        `${node.tagName.toLowerCase()}${node.getAttribute("data-testid") ?? ""} ${node.scrollWidth}>${node.clientWidth}`;
      const out: Array<string> = [];
      for (const sel of [diffSel, panelSel]) {
        const root = document.querySelector(sel);
        if (root === null) {
          out.push(`${sel} missing`);
          continue;
        }
        for (const node of [root, ...root.querySelectorAll("*")]) {
          if (over(node)) out.push(named(node));
        }
      }
      return out;
    },
    { diffSel: CHAT_DIFF, panelSel: CHAT_PANEL },
  );
  assert.deepStrictEqual(panned, [], "these boxes have a horizontal scrollbar");
});

/**
 * Every wrapping row — addition, removal, and unchanged context — keeps its
 * continuation in the content column. The fixture pairs a long token of each
 * kind so a gutter that only holds for `add` cannot hide.
 */
Then("a wrapped diff line keeps its gutter", async function (this: OlaiWorld) {
  const box = shownDiff(this);
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const geometry = await box.evaluate(
    (root, ids) => {
      const of = (kind: string): ReadonlyArray<Element> =>
        [...root.querySelectorAll(`${ids.line}[data-kind="${kind}"]`)];

      const check = (el: Element, kind: string): { ok: true } | { ok: false; why: string } => {
        const gutter = el.querySelector(ids.gutter);
        const mark = el.querySelector(ids.mark);
        const text = el.querySelector(ids.text);
        if (gutter === null || mark === null || text === null) {
          return { ok: false, why: `a ${kind} row is missing a gutter, a marker or its text` };
        }
        const gutterBox = gutter.getBoundingClientRect();
        const markBox = mark.getBoundingClientRect();
        // The text is a grid cell (a block box), so the element's own
        // `getClientRects()` is one rectangle — the cell. The fragments of a
        // wrapped line live on a Range over its contents.
        const range = document.createRange();
        range.selectNodeContents(text);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        const under = rects.filter((r) => r.left + 0.5 < markBox.right);
        if (under.length > 0) {
          return {
            ok: false,
            why:
              `a ${kind} row has ${under.length} fragment(s) starting at ` +
              `x=${Math.round(under[0]!.left)}, under the marker which ends at ${Math.round(markBox.right)}`,
          };
        }
        const starts = new Map<number, number>();
        for (const r of rects) {
          const key = Math.round(r.top);
          const prev = starts.get(key);
          starts.set(key, prev === undefined ? r.left : Math.min(prev, r.left));
        }
        const lineLefts = [...starts.values()];
        if (lineLefts.length < 2) {
          return {
            ok: false,
            why: `a ${kind} line sat on ${lineLefts.length} visual row(s); a long line that did not wrap cannot speak for the gutter`,
          };
        }
        const drift = Math.max(...lineLefts) - Math.min(...lineLefts);
        if (drift > 1) {
          return {
            ok: false,
            why: `a ${kind} row's wrapped lines drift ${Math.round(drift)}px — the continuation slid toward the gutter`,
          };
        }
        const contentLeft = Math.min(...lineLefts);
        if (contentLeft + 0.5 < gutterBox.right) {
          return {
            ok: false,
            why: `a ${kind} row's content starts at x=${Math.round(contentLeft)}, under the gutter which ends at ${Math.round(gutterBox.right)}`,
          };
        }
        return { ok: true };
      };

      // Add, remove, and unchanged context — not only the arriving line. A
      // gutter that holds for `+` and slides under `-` or a context wrap is
      // still a broken gutter.
      for (const kind of ["add", "remove", "same"] as const) {
        const wrapping = of(kind).filter((row) => {
          const text = row.querySelector(ids.text);
          if (text === null) return false;
          const range = document.createRange();
          range.selectNodeContents(text);
          const tops = new Set(
            [...range.getClientRects()]
              .filter((r) => r.width > 0 && r.height > 0)
              .map((r) => Math.round(r.top)),
          );
          return tops.size >= 2;
        });
        if (wrapping.length === 0) {
          return {
            ok: false as const,
            why: `no wrapping ${kind} row; the fixture must pin the gutter on every kind, not only additions`,
          };
        }
        for (const row of wrapping) {
          const result = check(row, kind);
          if (!result.ok) return { ok: false as const, why: result.why };
        }
      }
      return { ok: true as const, why: "" };
    },
    { line: CHAT_DIFF_LINE, gutter: CHAT_DIFF_GUTTER, mark: CHAT_DIFF_MARK, text: CHAT_DIFF_TEXT },
  );
  assert.ok(geometry.ok, geometry.why);
});

Then(
  "the diff shows the line {string} as added",
  async function (this: OlaiWorld, text: string) {
    // The KIND is asserted rather than the colour: what tone an added line
    // wears is the whole subject here, and so the last thing to assert on —
    // fifteen palettes paint it fifteen ways and all of them mean `add`.
    const added = shownDiff(this).locator(`${CHAT_DIFF_LINE}[data-kind="add"]`);
    await this.waitUntil(
      async () => {
        const rows = await added.allInnerTexts();
        return rows.some((row) => oneLine(row).includes(text));
      },
      `the diff to show "${text}" as an added line`,
      POLL_TIMEOUT,
    );
  },
);

Then(
  "the chat says the write {string}",
  async function (this: OlaiWorld, said: string) {
    // The commit panel's own words for the same event, which is the parity
    // this is really about: one classification, two places it is read.
    const wrote = this.page.locator(CHAT_WROTE).first();
    await wrote.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = oneLine(await wrote.innerText());
    assert.ok(
      shown.includes(said),
      `the write's story does not say "${said}"; it says: ${shown}`,
    );
  },
);

Then(
  "the chat shows the outline {string} changing",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${CHAT_OUTLINE_DIFF}[data-path="${file}"]`)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the outline change says {string}",
  async function (this: OlaiWorld, said: string) {
    // The Commit panel's own phrase for the same event — which is the parity
    // that makes this a second reading of one vocabulary rather than a second
    // vocabulary.
    const row = this.page.locator(CHAT_OUTLINE_CHANGE).first();
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = oneLine(await row.innerText());
    assert.ok(
      shown.includes(said),
      `the outline's change does not say "${said}"; it says: ${shown}`,
    );
  },
);

Then("the diff says it was rewritten whole", async function (this: OlaiWorld) {
  // The half of a bound that matters on screen: a reader who is not told is
  // reading the top of the old file as though it were a hunk.
  await this.page
    .locator(CHAT_DIFF_WHOLESALE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the write's nudge says {string}",
  async function (this: OlaiWorld, said: string) {
    // What the rollup noticed about a write that LANDED — advice, never a
    // reason anything failed. A person who asked an agent for something is
    // owed the aside a person who pressed a key already gets.
    const nudge = this.page.locator(CHAT_NUDGE).first();
    await nudge.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = oneLine(await nudge.innerText());
    assert.ok(
      shown.includes(said),
      `the write's nudge does not mention "${said}"; it says: ${shown}`,
    );
  },
);

Then("the tool call's detail is folded away", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_TOOL_DETAIL).count(),
    0,
    "a tool call's arguments are drawn unfolded; a turn's worth of them would " +
      "bury the conversation they belong to",
  );
});

// ── subagent lanes ─────────────────────────────────────────────────────

/** The lane a subagent's row is drawn in, and the `Agent` frame it names. The
 *  attribution is the `data-lane`, not the indent: an indent is a thing a
 *  panel could get right by accident, and this is a claim about WHICH agent.
 *  The indent is asserted too, as GEOMETRY, one step down — both halves,
 *  because either alone passes a build that lost the other. */
const firstLane = (world: OlaiWorld) => world.page.locator(CHAT_LANE).first();

/** One row of the conversation, as a selector. Spelled once, the way a node
 *  and a day already are (`world.ts`): three literals of one scheme in one
 *  file is two of them being missed the day the scheme moves. */
const entrySelector = (id: string): string => `${CHAT_ENTRY}[data-entry-id="${id}"]`;

/**
 * What hangs off a spawn has to be drawn BELOW it and INSET from it.
 *
 * The geometry half of every lane claim, asserted once for both things that
 * make one: a call a subagent made, and the live rail under a spawn nobody has
 * reported on yet. They are the same picture — the whole design is that the
 * two segments meet as one line — so two copies of this measurement would be
 * two chances to assert a different picture.
 *
 * Measured rather than read off a class, for the reason the bubble on your own
 * message is measured: a class is a styling decision a refactor may change, and
 * where a thing SITS is the claim. It is also the half a `data-` attribute
 * cannot make — strip the rail and the indent from the panel and every other
 * assertion in this section still passes.
 *
 * @param spawner the transcript key of the frame it should hang off
 * @param hanging what should be hanging off it
 * @param what a name for it, for the failure to read as a sentence
 */
const insetBelow = async (
  world: OlaiWorld,
  spawner: string,
  hanging: Locator,
  what: string,
): Promise<void> => {
  // The frame it names has to BE there: a lane pointing at a row the panel
  // never drew would look right and say nothing.
  const frame = world.page.locator(entrySelector(spawner));
  await frame.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const above = await frame.boundingBox();
  const mine = await hanging.boundingBox();
  assert.ok(
    above !== null && mine !== null,
    `neither ${what} nor the call that spawned it was drawn`,
  );
  assert.ok(
    mine.y > above.y,
    `${what} is drawn above the call that spawned it (${mine.y} is not below ` +
      `${above.y})`,
  );
  assert.ok(
    mine.x > above.x,
    `${what} starts at ${mine.x}, level with the call that spawned it at ` +
      `${above.x} — a lane is an INDENT, and a reader who cannot see one is ` +
      "being told a subagent's work was the main agent's",
  );
};

Then(
  "the chat draws a subagent's tool call under the call that spawned it",
  async function (this: OlaiWorld) {
    const lane = firstLane(this);
    await lane.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const parent = await lane.getAttribute("data-lane");
    assert.ok(
      parent !== null && parent !== "",
      "a lane that names no agent is an indent, not an attribution",
    );
    await insetBelow(
      this,
      parent ?? "",
      lane.locator(CHAT_ENTRY).first(),
      "the subagent's row",
    );
  },
);

Then(
  "the call that spawned it is in no lane of its own",
  async function (this: OlaiWorld) {
    // The other half of the claim, and the one that catches a panel indenting
    // everything: the `Agent` call is the MAIN agent's own, so it sits in the
    // conversation's own column with the lane hanging off it.
    const parent = await firstLane(this).getAttribute("data-lane");
    const nested = await this.page
      .locator(`${CHAT_LANE} ${entrySelector(parent ?? "")}`)
      .count();
    assert.strictEqual(
      nested,
      0,
      `the frame "${parent}" is itself drawn in a lane; the call that spawns a ` +
        "subagent is the main agent's own work",
    );
  },
);

Then(
  "the chat says an agent is working, of the kind {string}",
  async function (this: OlaiWorld, kind: string) {
    // THE LIVE HALF, and the whole of what this scenario is about: it has to
    // be on screen while the agent has reported nothing, so it is found by
    // waiting for it rather than by looking after the fact.
    const working = this.page.locator(CHAT_SPAWN_WORKING).first();
    await working.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const spawner = await working.getAttribute("data-lane");
    assert.ok(
      spawner !== null && spawner !== "",
      "a rail that names no agent is an indent, not an attribution",
    );
    // WHO, off the frame the rail hangs from — the attribute rather than the
    // words, so the claim stays about the kind of agent the call named and not
    // about how the row spells it.
    const frame = this.page.locator(entrySelector(spawner ?? ""));
    await frame.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await frame.locator(CHAT_SPAWN).first().getAttribute("data-spawn-kind"),
      kind,
      `the call that spawned an agent does not say it started a "${kind}"`,
    );
    // ... and the same geometry a lane owes, for the same reason: the rail is
    // the claim that this is somebody ELSE's work, and one drawn level with
    // the conversation says the main agent is doing it. The same measurement a
    // subagent's own row is held to, because it is meant to be the same line.
    await insetBelow(this, spawner ?? "", working, "the agent that was sent out");
  },
);

Then("no tool call is drawn in a subagent lane", async function (this: OlaiWorld) {
  // The other half, and the one that makes the assertion above mean anything:
  // the agent has produced NOTHING, so every lane the old panel could draw is
  // absent and the face on screen is the spawn's own.
  assert.strictEqual(
    await this.page.locator(CHAT_LANE).count(),
    0,
    "a subagent's work is on screen; this scenario is about the stretch " +
      "before any of it exists",
  );
});

Then(
  "the chat still shows a call that sent out an {string}",
  async function (this: OlaiWorld, kind: string) {
    // The half that must NOT come off with the live one: who was sent is a
    // fact about what happened, and the row is the record of it. A panel that
    // took the whole face off when the agent died would leave a bare pending
    // dot where a spawn was — which is the bug this feature exists for,
    // arriving at the end of the turn instead of the start.
    await this.page
      .locator(`${CHAT_SPAWN}[data-spawn-kind="${kind}"]`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the chat says no agent is still working", async function (this: OlaiWorld) {
  // A face that outlives the agent is worse than none: it says a fan-out is
  // running when the turn is over.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_SPAWN_WORKING).count()) === 0,
    "the panel to stop saying an agent is working",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the chat draws {int} tool calls in subagent lanes",
  async function (this: OlaiWorld, many: number) {
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_LANE).count()) === many,
      `${many} rows to be drawn in subagent lanes`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "exactly one lane names itself, as {string}",
  async function (this: OlaiWorld, named: string) {
    // ONE, and this is the count that matters: the label is drawn where a
    // stretch of one agent's work OPENS, so a panel that put it on every row
    // would say the agent's name three times down a 26rem drawer.
    const labels = this.page.locator(CHAT_LANE_LABEL);
    await labels.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await labels.count(),
      1,
      "a lane names itself where it opens and nowhere else — the rail says the " +
        "rest",
    );
    const said = oneLine(await labels.first().innerText());
    assert.ok(
      said.includes(named),
      `the lane says "${said}" rather than naming "${named}"`,
    );
  },
);

// ── the completion over the box ────────────────────────────────────────
//
// ONE set of steps for both lists — the agent's commands under a `/` and the
// served directory's files under an `@` — because they are one box in the
// client (`web/src/client/chat/CompletionMenu.tsx`) and a second spelling here
// would be two scenarios' worth of drift about what "the completion offers"
// means. A row is named by its `data-value`, which is what taking it writes:
// the command's name, or the file's path.

/** WHICH list, off `data-kind` — `command` or `path`. Named rather than
 *  guessed from the rows, because the whole design claim is that one scan of
 *  the line decides which character the caret is inside. */
Then(
  "the {word} completion is open",
  async function (this: OlaiWorld, kind: string) {
    const panel = this.page.locator(CHAT_COMPLETION);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await panel.getAttribute("data-kind"), kind);
  },
);

/** Nothing armed, or nothing matched — which are the same thing on screen and
 *  deliberately so: a trigger with nothing to offer draws no box, so an `@`
 *  that is somebody's address types straight through. */
Then("no completion is open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_COMPLETION).count()) === 0,
    "the completion to be gone",
  );
});

Then(
  "the completion offers {string}",
  async function (this: OlaiWorld, value: string) {
    await this.page
      .locator(`${CHAT_COMPLETION_ROW}[data-value="${value}"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the completion does not offer {string}",
  async function (this: OlaiWorld, value: string) {
    await this.waitUntil(
      async () =>
        (await this.page
          .locator(`${CHAT_COMPLETION_ROW}[data-value="${value}"]`)
          .count()) === 0,
      `the completion to stop offering "${value}"`,
    );
  },
);

/** What a row READS, which is not what it writes: the file's own name, with
 *  where it sits beside it. Asked once, for the one row whose folder is part
 *  of the answer — a column of `2026-08-16.md` in a `Daily/` vault is the
 *  reason the path is not the label. */
Then(
  "the completion row {string} reads {string} in {string}",
  async function (this: OlaiWorld, value: string, label: string, hint: string) {
    const row = this.page.locator(`${CHAT_COMPLETION_ROW}[data-value="${value}"]`);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await row.innerText()), `${label} ${hint}`);
  },
);

When("I accept the completion", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_INPUT).press("Enter");
});

/** The pointer's door onto the same row, for the hand that is already there. */
When(
  "I click the completion {string}",
  async function (this: OlaiWorld, value: string) {
    await this.page
      .locator(`${CHAT_COMPLETION_ROW}[data-value="${value}"]`)
      .click();
  },
);

/**
 * WHERE IN THE TEXT the caret sits, read off the element rather than reasoned
 * about.
 *
 * The completion sets the field's value and then its selection, and what keeps
 * the second from being undone by the framework's own binding is a claim about
 * Solid and about the platform that no comment can settle
 * (`client/chat/Composer.tsx`'s `rewrite`). A real browser can, so it does:
 * completing mid-sentence has to leave the caret after the path it wrote, not
 * at the end of the line.
 */
Then(
  "the caret in the chat box is at {int}",
  async function (this: OlaiWorld, at: number) {
    await this.waitUntil(
      async () =>
        (await this.page
          .locator(CHAT_INPUT)
          .evaluate((box) => (box as HTMLTextAreaElement).selectionStart)) === at,
      `the caret to sit at ${at}`,
    );
  },
);

/** WHERE THE CARET IS after a row was taken with the pointer: the press moved
 *  focus to a button that is gone a moment later, so a completion that did not
 *  hand it back would cost a click instead of saving one. */
Then("the caret is in the chat box", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      await this.page
        .locator(CHAT_INPUT)
        .evaluate((box) => box === document.activeElement),
    "the caret to be back in the message box",
  );
});

/**
 * The caret moved INTO the sentence, the way a click into the middle of one
 * moves it — `editing_steps.ts`'s gesture, one box over.
 *
 * `setSelectionRange` fires the element's own `select` event, which is what
 * the composer listens for: the caret is the element's answer there, never a
 * signal this suite could set (`client/chat/Composer.tsx`).
 */
When(
  "I put the caret after {string} in the chat",
  async function (this: OlaiWorld, prefix: string) {
    const box = this.page.locator(CHAT_INPUT);
    await box.focus();
    await box.evaluate((element, wanted) => {
      const field = element as HTMLTextAreaElement;
      const at = field.value.indexOf(wanted);
      if (at === -1) {
        throw new Error(
          `the box holds ${JSON.stringify(field.value)}, which does not contain ${
            JSON.stringify(wanted)
          }`,
        );
      }
      field.setSelectionRange(at + wanted.length, at + wanted.length);
    }, prefix);
  },
);

/** A key aimed at the BOX rather than at the page — which is the whole of what
 *  the list asks before answering one (`within`, in CompletionMenu.tsx). */
When(
  "I press {string} in the chat",
  async function (this: OlaiWorld, key: string) {
    await this.page.locator(CHAT_INPUT).press(key);
  },
);

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

/** The `chats` button pressed. One body, two phrasings below, because the
 *  press means different things at different points in a scenario and a second
 *  spelling of the gesture is how the two would come to settle differently. */
const pressChats = async (world: OlaiWorld): Promise<void> => {
  await world.page.locator(CHAT_SESSIONS).click();
};

When("I open the session picker", async function (this: OlaiWorld) {
  await pressChats(this);
});

/** The same press where the scenario is asking what a SECOND one does, which
 *  is the two-roots fence (`chat/Sessions.tsx`): a click-away that knew only
 *  the list would shut on this press's own pointerdown and be reopened by its
 *  click, so the panel would be up before and after. */
When("I press the chats button", async function (this: OlaiWorld) {
  await pressChats(this);
});

Then("the picker is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_SESSION_LIST)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** GONE rather than hidden: the list is a `<Show>`, so a picker left in the
 *  DOM would be a dismissal that only changed how it looked. */
Then("the picker is put away", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_SESSION_LIST).count()) === 0,
    "the session list to be gone",
  );
});

/** Where a keyboard is standing after the list goes. Escape from a panel that
 *  HELD the caret leaves it on `<body>` — nowhere, and the whole page to walk
 *  down again — unless somebody hands it back, which is `Sessions.tsx`'s job
 *  and this is the step that says so. */
Then("the chats button has the caret", async function (this: OlaiWorld) {
  const caret = await this.page.evaluate(() =>
    document.activeElement?.getAttribute("data-testid") ?? null
  );
  assert.strictEqual(caret, TESTID.chatSessions, `the caret is on ${String(caret)}`);
});

/** Somewhere that is neither the list nor the button that opens it. The
 *  sidebar, which `clickAway` presses at a corner that is no control. */
When("I click away from the session picker", async function (this: OlaiWorld) {
  await this.clickAway();
});

/** No `trouble` on screen — what went wrong where nobody was waiting, and the
 *  claim that nothing did. No wait of its own: the step before it has already
 *  waited for something the panel could only have drawn after the moment this
 *  is about, so a `trouble` that was coming would be here. */
Then("the chat says nothing went wrong", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(CHAT_TROUBLE).count(), 0);
});

Then(
  "the picker refuses, saying {string}",
  async function (this: OlaiWorld, reason: string) {
    const refused = this.page.locator(CHAT_SESSIONS_REFUSED);
    await refused.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await refused.innerText()).includes(reason),
      `the picker to give the reason "${reason}"`,
    );
  },
);

/** The other half of the claim: a refusal draws no rows, so the two answers
 *  cannot be confused by a reader who sees an empty list under an error. */
Then("the picker lists nothing", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(CHAT_SESSION).count(), 0);
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

/** The other half of the step below, and it is a claim about a WRITE THAT DID
 *  NOT HAPPEN — so it is checked against the settled page rather than waited
 *  for. Its caller has already waited for something else to be true (the row
 *  marked unsent), which is what makes this a read rather than a race. */
Then("node {string} is not done", async function (this: OlaiWorld, id: string) {
  const status = await this.node(id).getAttribute("data-status");
  assert.notStrictEqual(
    status,
    "done",
    `node "${id}" is done — a message the agent never received marked it`,
  );
});

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

// ── a server that did not attach ───────────────────────────────────────
//
// The claim is about the PANEL, which is the whole of `mcp-fail-visible`: what
// the session was handed is already asserted through the agent's own `servers`
// answer (`kolu_terminals.feature`), and it was asserted there while a person
// looking at the app could see nothing at all.

Then(
  "the panel says {string} is missing from this conversation",
  async function (this: OlaiWorld, name: string) {
    // HYDRATION_TIMEOUT: the strip cannot exist until the probe has answered
    // and the session has been asked for, which is a boot rather than a render.
    await this.expectAttribute(
      CHAT_MISSING_SERVER,
      "data-server",
      name,
      "the strip under the chat header",
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the reason it gives is {string}",
  async function (this: OlaiWorld, reason: string) {
    const said = oneLine(await this.page.locator(CHAT_MISSING_WHY).innerText());
    assert.ok(
      said.includes(reason),
      `the panel names a missing server without the reason "${reason}", which is ` +
        `the half the feature exists for — a name on its own is the debug log ` +
        `line again, on screen. It reads: ${said}`,
    );
  },
);

/** Which file was probed. The incident this comes from was exactly this
 *  question — a `kolu` on PATH is not necessarily the host's kolu — so the
 *  path is asserted as a path rather than as a string the scenario spells: it
 *  is a temporary directory's, and only the running server knows it. */
Then("it names the file it probed", async function (this: OlaiWorld) {
  const said = oneLine(
    await this.page.locator(CHAT_MISSING_SERVER).first().innerText(),
  );
  assert.ok(
    /\/[^\s]*\/kolu\b/.test(said),
    `the panel does not say WHICH kolu it probed, which is the question the ` +
      `incident behind this feature started from. It reads: ${said}`,
  );
});

/** ... and the other side of it: a healthy conversation looks exactly as it did
 *  before this feature existed. No wait of its own — the step before it has
 *  waited on something the panel could only have drawn after the session was
 *  opened, so a strip that was coming would be here. */
Then(
  "the panel says nothing about a missing server",
  async function (this: OlaiWorld) {
    assert.strictEqual(
      await this.page.locator(CHAT_MISSING).count(),
      0,
      "the panel reports a missing MCP server on a conversation that was given " +
        "every one of them — a complaint a reader cannot act on is one they " +
        "learn to skip on the conversations where it is true",
    );
  },
);

// ── pictures ───────────────────────────────────────────────────────────
//
// A paste is DISPATCHED rather than performed: Playwright cannot put an image
// on the system clipboard portably, and what the panel actually listens to is
// the `paste` event's `clipboardData.files`. So the step builds the event the
// browser would have built — a real `File`, in a real `DataTransfer`, on a real
// `ClipboardEvent` — and lets the composer take it from there. Everything after
// that line is the app: the chunk loop, the procedure, the tmp directory, the
// prompt the agent is handed.

/** A 1×1 PNG, 70 bytes — small enough to inline and real enough that nothing
 *  downstream has to pretend. The scenario asserts that size, which is how it
 *  knows the agent read the file rather than the name of it. */
const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** ... and something the clipboard calls a picture that this app does not: an
 *  SVG is a document that can script, so it is in neither list the gate
 *  keeps. */
const TINY_SVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";

/** A real PDF, 69 bytes — a catalog and a trailer, which is the smallest thing
 *  that is honestly one. The scenario asserts that size, which is how it knows
 *  the agent opened the file rather than read its name. */
const TINY_PDF =
  "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZz4+ZW5kb2JqCnRyYWlsZXI8PC9Sb290IDEgMCBSPj4KJSVFT0YK";

/** Five bytes of text: `notes`. */
const TINY_TEXT = "bm90ZXM=";

/** What a named file is made of. The extension decides, because the extension
 *  is what the app's own gate judges — so a scenario names `shot.png` or
 *  `Type 04-C.pdf` and gets a file the panel will treat exactly as it would
 *  treat a real one. A `.zip` is here to be REFUSED: the gate takes pictures,
 *  PDFs and text, and a suite that had nothing left to be turned away by it
 *  would have stopped testing the gate at all. */
const fileSpec = (name: string): { name: string; data: string; type: string } => {
  if (name.endsWith(".svg")) return { name, data: TINY_SVG, type: "image/svg+xml" };
  if (name.endsWith(".pdf")) return { name, data: TINY_PDF, type: "application/pdf" };
  if (name.endsWith(".txt")) return { name, data: TINY_TEXT, type: "text/plain" };
  if (name.endsWith(".zip")) return { name, data: TINY_TEXT, type: "application/zip" };
  return { name, data: ONE_PIXEL_PNG, type: "image/png" };
};

/** "shot.png, notes.txt" — one drop carrying several files, written the way a
 *  sentence would say it. */
const named = (names: string): ReadonlyArray<string> =>
  names.split(",").map((name) => name.trim()).filter((name) => name !== "");

/**
 * Put files into the page the way the browser would have, and let the panel
 * take it from there.
 *
 * DISPATCHED rather than performed, and there is no way around it: Playwright
 * cannot put an image on the system clipboard portably and cannot make the
 * desktop drag a real file into a headless browser. So the step builds what
 * the browser would have built — real `File`s in a real `DataTransfer`, on the
 * real event — and everything after that line is the app: the target that
 * catches it, the gate that sorts it, the chunk loop, the tmp directory, the
 * prompt the agent is handed.
 *
 * One function for both gestures because the FILES are the same construction
 * either way, and what differs is one constructor and where it is aimed. A
 * drop is aimed at the transcript, which is the part of the panel furthest
 * from the composer: a drop that only worked over the box would pass a test
 * aimed at the box and fail the person aiming at the panel.
 */
const deliver = async (
  world: OlaiWorld,
  at: TestId,
  files: ReadonlyArray<string>,
  kinds: ReadonlyArray<string>,
  as: "clipboard" | "drag" = "drag",
): Promise<void> => {
  await world.page
    .locator(selector(at))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.page.evaluate(
    ({ specs, kinds, at, clipboard }) => {
      const transfer = new DataTransfer();
      for (const spec of specs) {
        const bytes = Uint8Array.from(atob(spec.data), (char) => char.charCodeAt(0));
        transfer.items.add(new File([bytes], spec.name, { type: spec.type }));
      }
      const target = document.querySelector(`[data-testid="${at}"]`);
      for (const kind of kinds) {
        target?.dispatchEvent(
          clipboard
            ? new ClipboardEvent(kind, {
              clipboardData: transfer,
              bubbles: true,
              cancelable: true,
            })
            : new DragEvent(kind, {
              dataTransfer: transfer,
              bubbles: true,
              cancelable: true,
            }),
        );
      }
    },
    { specs: files.map(fileSpec), kinds, at, clipboard: as === "clipboard" },
  );
};

When(
  "I paste a picture called {string} into the chat",
  async function (this: OlaiWorld, name: string) {
    await this.page.locator(CHAT_INPUT).click();
    await deliver(this, TESTID.chatInput, [name], ["paste"], "clipboard");
  },
);

When(
  "I drag {string} over the chat panel",
  async function (this: OlaiWorld, names: string) {
    await deliver(this, TESTID.chatTranscript, named(names), ["dragenter", "dragover"]);
  },
);

When(
  "I drop {string} on the chat panel",
  async function (this: OlaiWorld, names: string) {
    // The whole gesture, in the order a browser fires it — the drop only
    // happens at all because `dragover` said it could.
    await deliver(this, TESTID.chatTranscript, named(names), [
      "dragenter",
      "dragover",
      "drop",
    ]);
  },
);

When("the drag moves onto the composer", async function (this: OlaiWorld) {
  // What a browser fires when a drag crosses from one element of a target to
  // another INSIDE it: the new element enters before the old one leaves. Fired
  // with no files (the drag is already in flight) but the same `Files` kind,
  // which is all a listener may read before the drop.
  await deliver(this, TESTID.chatInput, ["shot.png"], ["dragenter"]);
  await deliver(this, TESTID.chatTranscript, ["shot.png"], ["dragleave"]);
});

/** A drag event carrying NOTHING — no files, no kinds. Two of the three ways a
 *  drag ends look like this from inside the page: a browser that hands an
 *  empty store on `dragleave` (it is allowed to; the drag data is protected
 *  until the drop), and a drag cancelled with Escape. Both must put the panel
 *  back, because the alternative is "drop to attach" left lit over a
 *  conversation with nothing over it. */
const emptyDragAt = (world: OlaiWorld, at: TestId, kind: string): Promise<void> =>
  world.page.evaluate(({ at, kind }) => {
    const target = document.querySelector(`[data-testid="${at}"]`)
    target?.dispatchEvent(
      new DragEvent(kind, {
        dataTransfer: new DataTransfer(),
        bubbles: true,
        cancelable: true,
      }),
    )
  }, { at, kind });

When(
  "I pick {string} with the attach button",
  async function (this: OlaiWorld, name: string) {
    const spec = fileSpec(name);
    // What a real file dialog FILTERS by, asserted before the file is handed
    // over: `setFiles` ignores `accept`, so a picker that had gone on saying
    // `image/*` would take this PDF here and grey it out for the person. The
    // one half-truth met with no refusal to explain it.
    const accept = await this.page
      .locator(`${CHAT_PANEL} input[type=file]`)
      .getAttribute("accept");
    const extension = name.slice(name.lastIndexOf("."));
    assert.ok(
      accept !== null && accept.includes(extension),
      `the picker offers "${accept}", which does not include "${extension}" — ` +
        `so a file the gate would take cannot be chosen`,
    );
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.page.locator(CHAT_ATTACH_BUTTON).click(),
    ]);
    await chooser.setFiles({
      name: spec.name,
      mimeType: spec.type,
      buffer: Buffer.from(spec.data, "base64"),
    });
  },
);

When("the drag leaves the panel without dropping", async function (this: OlaiWorld) {
  await emptyDragAt(this, TESTID.chatTranscript, "dragleave");
});

When("the drag is cancelled", async function (this: OlaiWorld) {
  // What a drag that STARTED in the page ends with when it is abandoned — one
  // of the panel's own attachment thumbnails, dragged and let go of nowhere.
  await emptyDragAt(this, TESTID.chatTranscript, "dragend");
});

When("I drag some selected text over the chat panel", async function (this: OlaiWorld) {
  await this.page.evaluate(({ at }) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "a sentence being dragged");
    const pane = document.querySelector(`[data-testid="${at}"]`);
    for (const kind of ["dragenter", "dragover"]) {
      pane?.dispatchEvent(
        new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }),
      );
    }
  }, { at: TESTID.chatTranscript });
});

Then("the panel shows where the drop will land", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_DROP)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the panel is not offering to take a drop", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_DROP).count()) === 0,
    "the panel not to be offering to take a drop",
  );
});

/** Waiting, not asserting: the chip appears when the upload has answered, and
 *  how many round trips that took is the chunker's business. */
Then(
  "the composer is holding the picture {string}",
  async function (this: OlaiWorld, name: string) {
    await this.waitUntil(
      async () => (await this.page.locator(pictureChip(name)).count()) > 0,
      `the composer to hold "${name}"`,
    );
  },
);

Then(
  "the composer is holding {string} in that order",
  async function (this: OlaiWorld, names: string) {
    const wanted = named(names);
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_ATTACHMENT).count()) === wanted.length,
      `the composer to hold ${wanted.length} pictures`,
    );
    // ORDER, and it is the claim the scenario is about: the chips are in the
    // order the files were dropped, which is the order they will ride the next
    // message in — and therefore the order the agent reads them in.
    assert.deepStrictEqual(
      await this.page.locator(CHAT_ATTACHMENT).evaluateAll((chips) =>
        chips.map((chip) => chip.getAttribute("data-name"))
      ),
      [...wanted],
      "one drop's pictures are attached in the order they were dropped",
    );
  },
);

Then(
  "the agent read {string} in that order",
  async function (this: OlaiWorld, names: string) {
    const wanted = named(names).map((name) => `read 70 bytes from ${name}`);
    await this.waitUntil(
      async () => {
        const said = await transcriptText(this);
        return wanted.every((line) => said.includes(line));
      },
      `the agent to read ${wanted.length} pictures`,
    );
    // Where each one appears in the answer, in the order the agent was handed
    // them: the prompt carries the paths, and the paths are the chips.
    const said = await transcriptText(this);
    const at = wanted.map((line) => said.indexOf(line));
    assert.deepStrictEqual(
      [...at].sort((a, b) => a - b),
      at,
      `the agent read the pictures in a different order than they were dropped: ${said}`,
    );
  },
);

Then(
  "the composer is holding {string}, showing how big it is",
  async function (this: OlaiWorld, name: string) {
    await this.waitUntil(
      async () => (await this.page.locator(pictureChip(name)).count()) > 0,
      `the composer to hold "${name}"`,
    );
    const chip = this.page.locator(pictureChip(name));
    // A PDF has no thumbnail worth drawing, and an <img> pointed at one is a
    // broken-image icon — a component lying about a file that uploaded
    // perfectly. What it says instead is the fact a name does not carry.
    assert.strictEqual(
      await chip.locator(CHAT_ATTACHMENT_PREVIEW).count(),
      0,
      `"${name}" is not a picture, so the chip for it must not be drawing one`,
    );
    const size = oneLine(await chip.locator(CHAT_ATTACHMENT_SIZE).innerText());
    assert.match(
      size,
      /^\d+(\.\d)? (B|KB|MB|GB)$/,
      `the chip for "${name}" says "${size}" where a size belongs`,
    );
  },
);

Then("the composer is holding nothing", async function (this: OlaiWorld) {
  // Nowhere in the panel: the scenario that asks this has sent no message, so
  // every chip on screen would be one the composer is holding.
  assert.strictEqual(
    await this.page.locator(CHAT_ATTACHMENT).count(),
    0,
    "a refused picture was left in the composer, so sending would try again " +
      "with the file the server has already said no to",
  );
});

Then(
  "the conversation shows the picture {string}",
  async function (this: OlaiWorld, name: string) {
    await this.waitUntil(
      async () =>
        (await this.page.locator(`${CHAT_TRANSCRIPT} ${pictureChip(name)}`).count()) > 0,
      `the transcript to show "${name}"`,
    );
    // The tab that pasted it has the Blob, so its own row is a THUMBNAIL and
    // not just a name. Every other tab, and this one after a reload, has the
    // name — which is why the chip is what the row is built on.
    const preview = this.page.locator(
      `${CHAT_TRANSCRIPT} ${pictureChip(name)} ${CHAT_ATTACHMENT_PREVIEW}`,
    );
    assert.strictEqual(
      await preview.count(),
      1,
      "the tab that pasted the picture is drawing a name where it has the " +
        "bytes to draw the picture",
    );
  },
);

const pictureChip = (name: string): string => `${CHAT_ATTACHMENT}[data-name="${name}"]`;

/** How full the context is, as the header draws it. The whole string — `22k/1M`
 *  rather than a substring — because the two halves are the claim: a scenario
 *  matching only the numerator would pass on a build that lost the window. */
Then(
  "the panel header says the context is {string}",
  async function (this: OlaiWorld, usage: string) {
    await this.waitUntil(
      async () => {
        const line = this.page.locator(CHAT_USAGE);
        return (await line.count()) > 0 && oneLine(await line.innerText()) === usage;
      },
      `the header to say the context is "${usage}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

/** ... and that it says nothing about it at all, which is a conversation the
 *  agent has not reported on rather than one that has spent nothing. */
Then(
  "the panel header says nothing about the context",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.page.locator(CHAT_USAGE).count()) === 0,
      "the header to say nothing about the context",
      HYDRATION_TIMEOUT,
    );
  },
);
