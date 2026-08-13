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
  CHAT_DIFF,
  CHAT_DIFF_EXPAND,
  CHAT_DIFF_LINE,
  CHAT_DIFF_WHOLESALE,
  CHAT_DROP,
  CHAT_ENTRY,
  CHAT_ENTRY_STREAMING,
  CHAT_INPUT,
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
  CHAT_QUEUED,
  CHAT_REFUSAL,
  CHAT_SEND,
  CHAT_SESSION,
  CHAT_SESSIONS,
  CHAT_SESSIONS_REFUSED,
  CHAT_SLASH_COMMAND,
  CHAT_TITLE,
  CHAT_TOGGLE,
  CHAT_TOOL,
  CHAT_TOOL_DETAIL,
  CHAT_TOOL_FOLD,
  CHAT_TOOL_LOCATIONS,
  CHAT_TOOL_PROGRESS,
  CHAT_TRANSCRIPT,
  CHAT_TROUBLE,
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
    TESTID.chatInput,
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

Then("the chat shows no diff", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_DIFF).count(),
    0,
    "an olai write drew a text diff. A `.jsonl` diff is one enormous line per " +
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
