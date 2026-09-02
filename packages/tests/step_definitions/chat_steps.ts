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
  completingIn,
  NEAR,
  selector,
  TESTID,
  type TestId,
} from "@olai/web/testlib";

import { retypedAndTaken } from "../support/atonce.ts";
import { MARKER } from "../support/scripted.ts";
import { keysSettled } from "../support/settling.ts";
import { saysThat } from "../support/said.ts";
import { answered } from "../support/shortlist.ts";

import {
  attr,
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
  CHAT_AGENT,
  CHAT_AGENT_MARK,
  CHAT_BUSY,
  CHAT_CAMERA_BUTTON,
  CHAT_CANCEL,
  CHAT_CHOOSE,
  CHAT_CHOOSE_AGENT,
  CHAT_CHOOSE_CANCEL,
  CHAT_COMPLETION,
  CHAT_COMPLETION_ROW,
  CHAT_COMPLETION_SECTION,
  CHAT_DELIVERY,
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
  CHAT_INSTALL,
  CHAT_INTERRUPT,
  CHAT_LANE,
  CHAT_LANE_DOOR,
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
  CHAT_QUEUED,
  CHAT_QUEUES,
  CHAT_OUTLINE_DIFF,
  CHAT_PANEL,
  CHAT_PREVIEW,
  CHAT_PREVIEW_ASKED,
  CHAT_PREVIEW_NOTHING,
  CHAT_PREVIEW_OF,
  CHAT_REFUSAL,
  CHAT_REOPEN,
  CHAT_RESEND,
  CHAT_ROSTER,
  CHAT_ROSTER_OWN,
  CHAT_SAID,
  CHAT_SEND,
  CHAT_SERVER,
  CHAT_SESSION,
  CHAT_SESSION_AGENT,
  CHAT_SESSION_UNREACHABLE,
  CHAT_SESSION_LIST,
  CHAT_SESSION_SUPERSEDED,
  CHAT_SESSIONS,
  CHAT_ARMED,
  CHAT_ARMED_ENDED,
  CHAT_ARMED_STILL,
  CHAT_WATCHING,
  CHAT_WATCHING_FOR,
  CHAT_WATCHING_TASK,
  CHAT_SPAWN,
  CHAT_SPAWN_WORKING,
  CHAT_STRIP,
  CHAT_TITLE,
  CHAT_TOGGLE,
  CHAT_TOOL,
  CHAT_TOOL_DETAIL,
  CHAT_TOOL_ELAPSED,
  CHAT_TOOL_FOLD,
  CHAT_TOOL_LOCATIONS,
  CHAT_TOOL_PROGRESS,
  CHAT_TOOL_REPORT,
  CHAT_TRANSCRIPT,
  CHAT_TROUBLE,
  CHAT_UNOPENED,
  CHAT_UNOPENED_WHY,
  CHAT_USAGE,
  CHAT_WAITING,
  CHAT_WORKING,
  CHAT_WROTE,
  expectBefore,
  HYDRATION_TIMEOUT,
  NODE_TITLE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  STEER_DEADLINE_STEP_TIMEOUT,
  STEER_DEADLINE_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Given("the agent panel is open", async function (this: OlaiWorld) {
  const toggle = this.page.locator(CHAT_TOGGLE);
  const panel = this.page.locator(CHAT_PANEL);
  // Desktop: the toggle is always in the header (pressed while open). Phone:
  // the thumb strip is the door. Open-ness is remembered in localStorage, so
  // a reload inside a scenario may come back already open.
  if (!(await panel.isVisible())) {
    if (await toggle.isVisible()) {
      await toggle.click();
    } else {
      await this.page.locator(CHAT_STRIP).click();
    }
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
  // Desktop: the permanent toggle stays on screen, pressed while open. A
  // phone has no toggle; the sheet being visible is the whole of the claim.
  if (await toggle.count()) {
    await this.expectAttribute(
      CHAT_TOGGLE,
      "aria-pressed",
      "true",
      "the agent toggle",
    );
  }
});

// ── talking ────────────────────────────────────────────────────────────

/** The box, waited for — one spelling of "how long a scenario gives the
 *  composer to appear", shared by every step that types into it. */
const chatBox = async (world: OlaiWorld) => {
  const input = world.page.locator(CHAT_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return input;
};

const typeInto = async (world: OlaiWorld, text: string): Promise<void> => {
  await (await chatBox(world)).fill(text);
};

When("I ask the agent {string}", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
  await this.page.locator(CHAT_SEND).click();
});

/**
 * ... and the OTHER send: put these words into the turn the agent is running.
 *
 * Its own step rather than a flag on the one above, because it is a different
 * gesture a person makes on purpose — which is the whole of what
 * `compact-lost-to-steer` changed. A scenario that meant to interrupt says so,
 * and every scenario that does not says nothing and gets the ordinary send.
 *
 * THE BUTTON, which is the door a phone has. The chord is the same gesture
 * through the other door and has a step of its own, so a scenario can pin
 * either — and one scenario pins that they do the same thing.
 */
When("I interrupt the agent with {string}", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
  await this.press(this.page.locator(CHAT_INTERRUPT));
});

/** The same gesture through the keyboard. Alt+Enter and not a second control:
 *  a chord nobody can see is a feature only its author knows about, and a
 *  control that did something the keyboard could not is the other half of the
 *  same complaint. */
When(
  "I interrupt the agent with {string} by keyboard",
  async function (this: OlaiWorld, text: string) {
    await typeInto(this, text);
    await (await chatBox(this)).press("Alt+Enter");
    await keysSettled(this);
  },
);

/** Nothing to interrupt WITH: the agent never said it takes one, or there is no
 *  turn in flight. Absence is the claim — a control drawn for an extension
 *  nobody advertised is a control that refuses when pressed. */
Then("the composer offers no interruption", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_INTERRUPT).count()) === 0,
    "the composer to offer no interruption",
    POLL_TIMEOUT,
  );
});

/** ... and that it DOES, which is what an agent advertising steering buys a
 *  person while a turn is running. */
Then("the composer offers an interruption", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_INTERRUPT)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** The window `../support/atonce.ts` opens, at this door. */
When(
  "I retype the chat as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await chatBox(this), text);
  },
);

When("I type {string} into the chat", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
});

/**
 * …and the same words as KEYSTROKES, one `input` event per letter.
 *
 * `fill` above sets the whole value in one event, which is the right gesture
 * for a scenario that is about what is in the box. It is the wrong one for a
 * scenario about what TYPING costs: a client that re-asks the server on every
 * keystroke and one that asks once are indistinguishable under a single event,
 * and the difference is the whole of `reactivity-equals-guards`' composer
 * finding. So this is `pressSequentially` — a real key per letter.
 */
When(
  "I type {string} into the chat a letter at a time",
  async function (this: OlaiWorld, text: string) {
    await (await chatBox(this)).pressSequentially(text);
    await keysSettled(this);
  },
);

/**
 * How many times this tab asked the set what the armed nodes are CALLED, since
 * the mark — the chip strip's one question (`client/chat/chips.ts`).
 *
 * The tag is `<member>/<verb>`, kolu's addressing for a surface member
 * (`surfaceTag`), matched as a substring of the whole tag the composed surface
 * serves it at. It is counted on the wire because nothing on screen says it:
 * the chip draws the same title whether the title was asked for once or once
 * per letter.
 */
Then(
  "the tab has asked what the armed nodes are called {int} time(s)",
  function (this: OlaiWorld, times: number) {
    assert.strictEqual(
      this.socketAskedSince("nodes/named"),
      times,
      "how many times this tab asked for the armed nodes' titles since the mark",
    );
  },
);

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
  fs.writeFileSync(path.join(this.scratch(), MARKER.release), "");
});

/** Ask the next `session/load` of `an older conversation` to hold a last
 *  line until `the agent is released`. The open-jump can then be observed
 *  before that growth, which is the claim the late-line scenario makes. */
When("I arm late growth on the next stored conversation", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), ".agent-want-late"), "");
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

/** Make the agent REFUSE to open a conversation — one verb or the other, and
 *  it stays alive and answering either way. Read at the moment of the request,
 *  so a scenario can arm it and then press something, or arm it and restart the
 *  server to reach the boot's own open. The same dot-file idiom as the rest. */
When(
  "the agent refuses to {word} a conversation",
  function (this: OlaiWorld, verb: string) {
    fs.writeFileSync(path.join(this.scratch(), `.agent-refuse-${verb}`), "");
  },
);

/** Make the next handshake ADVERTISE NOTHING — no queue, no interruption. The
 *  same dot-file idiom as the refusals above and for the same reason: what an
 *  agent says about itself is heard exactly once, before the client has said
 *  anything, so a scenario arms it and restarts to reach it. What it buys is
 *  the panel's honest face for an agent it has been told nothing about. */
When("the agent advertises nothing about itself", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.saysNothing), "");
});

/** Make the next `session/load` sit on the wire until `the agent is released`.
 *  That stretch is the one in which the panel is between conversations, which
 *  is the only window a second open can be started in. */
When("the next conversation load will hang", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.holdLoad), "");
});

/** ... and the same for the FIRST open of a freshly picked agent, which is the
 *  longer window and the one a person actually meets: choosing an agent starts
 *  a subprocess, hand-shakes it and opens a conversation before there is
 *  anything to type into. On a laptop that is a second or two and nobody can
 *  aim at it; here it lasts until the scenario says when. */
When("the next agent boot will hang", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.holdOpen), "");
});

/** ...and it stops refusing, so `try again` has something to succeed at. */
When(
  "the agent will {word} a conversation again",
  function (this: OlaiWorld, verb: string) {
    fs.rmSync(path.join(this.scratch(), `.agent-refuse-${verb}`), { force: true });
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

/** A read, not a wait: the question is what a no-op gesture left STANDING.
 *  If it touched what it should never reach, the line is gone for good —
 *  nothing restores it — so there is no arrival to wait for, and waiting
 *  would only blur the answer. */
Then("the chat still shows {string}", async function (this: OlaiWorld, text: string) {
  const said = await transcriptText(this);
  assert.ok(
    said.includes(text),
    `the chat no longer says "${text}" — the gesture that answered with ` +
      "nothing reached something it should never touch",
  );
});

/** A read, not a wait: the step before it has already waited for something
 *  that arrives BEFORE the late growth this is about, so if the late line
 *  were already here the open-jump would have nothing left to follow. */
Then(
  "the chat does not yet show {string}",
  async function (this: OlaiWorld, text: string) {
    assert.ok(
      !(await transcriptText(this)).includes(text),
      `the chat already says "${text}" — the late growth this scenario is ` +
        "about landed before the open-jump was observed, so the second " +
        "assertion would not be testing growth after open",
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

/** A link the agent WROTE, found by the words it is written under.
 *
 *  By its text and not by an attribute, because there is no attribute to find:
 *  an anchor in rendered markdown is markup the pipeline produced and belongs
 *  to no component, which is the whole reason a click on one had to be caught
 *  by a listener on the panel rather than by a handler on the element. Scoped
 *  to the ANSWER so a scenario cannot accidentally press a link somewhere else
 *  in the transcript. */
const answerLink = (world: OlaiWorld, text: string): Locator =>
  world.page.locator(`${CHAT_SAID} a`).filter({ hasText: text }).first();

When(
  "I follow the link {string} in the agent's answer",
  async function (this: OlaiWorld, text: string) {
    await this.press(answerLink(this, text));
  },
);

When(
  "I alt-click the link {string} in the agent's answer",
  async function (this: OlaiWorld, text: string) {
    await this.press(answerLink(this, text), "click", ["Alt"]);
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

Then(
  "the chat does not show my message {string}",
  async function (this: OlaiWorld, text: string) {
    // A task-notification is not a person speaking. The report it carries
    // may still be on screen — in the spawn's fold — so this is the human
    // bubble alone (`chatMine`), not "the page does not contain these words".
    assert.strictEqual(
      await myMessage(this, text).count(),
      0,
      `"${text}" is in a message bubble as if a person typed it`,
    );
  },
);

/** EXACTLY ONE of mine says that. The claim a send during a boot is about is
 *  a count, not a presence: a message delivered twice draws two identical rows
 *  and the "is it there" assertion passes on both. */
Then(
  "the chat shows my message {string} exactly once",
  async function (this: OlaiWorld, text: string) {
    await myMessage(this, text).first().waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
    assert.strictEqual(
      await myMessage(this, text).count(),
      1,
      `"${text}" is in the transcript more than once — it was delivered twice`,
    );
  },
);

/** ... and the agent answered it once, which is the half that says the DELIVERY
 *  doubled rather than the drawing. Counted over the agent's own rows. */
Then(
  "the agent has answered {string} exactly once",
  async function (this: OlaiWorld, text: string) {
    const said = this.page.locator(CHAT_SAID).filter({ hasText: text });
    await said.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // A beat, so a second answer that was merely on its way fails this rather
    // than arriving after it.
    await this.page.waitForTimeout(700);
    assert.strictEqual(
      await said.count(),
      1,
      `the agent answered "${text}" more than once — the prompt went out twice`,
    );
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

/** The strip between the transcript and the box, by what it SAYS. The words
 *  are the assertion rather than the element's presence: "working", "starting"
 *  and "waiting on your answer" are three different things to be told, and a
 *  strip that said the wrong one would pass a test about a strip. */
Then(
  "the panel says it is busy, with {string}",
  async function (this: OlaiWorld, what: string) {
    const busy = this.page.locator(CHAT_BUSY);
    await busy.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => oneLine(await busy.innerText()).includes(what),
      `the busy line to say "${what}"`,
    );
  },
);

/** ... and that it is GONE, which is the other half of a cue being a cue: one
 *  left up over a finished turn is the same lie the other way round. */
Then("the panel does not say it is busy", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_BUSY).count()) === 0,
    "the busy line to go away",
    HYDRATION_TIMEOUT,
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

// ── words that did not land ────────────────────────────────────────────
//
// The row is the copy. There is no queue behind the panel any more, so a
// message the agent did not take has exactly one place to be, and it is on
// screen where it was typed — which is what these steps are about.
//
// WHICH way it did not land is the other half, and the two faces are asserted
// through the same step with the word the panel itself carries
// (`data-delivery`): a refusal is certain and offers a retry, a silence is not
// and must not.

/** MY MESSAGE'S OWN ROW — the entry whose bubble carries those words.
 *
 *  Every claim below is made THROUGH this rather than against the panel at
 *  large, which is the difference between "that message is marked unanswered"
 *  and "something on this page is". One undelivered row is all today's
 *  scenarios ever have, so the loose reading does not currently lie — and a
 *  claim that is only true while the fixture stays small is a claim that stops
 *  being checked the day somebody grows it. */
const myRow = (world: OlaiWorld, text: string): Locator =>
  world.page
    .locator(CHAT_ENTRY)
    .filter({ has: world.page.locator(CHAT_MINE, { hasText: text }) });

/** The strip under THAT message, by what became of it. */
const deliverySaid = (world: OlaiWorld, text: string, fate: string): Locator =>
  myRow(world, text).locator(attr("data-delivery", fate));

Then(
  "the chat shows my message {string} as {string}",
  async function (this: OlaiWorld, text: string, fate: string) {
    // The BUBBLE has to still say it. A row that reported the failure and lost
    // the words would pass a check for the mark alone, and losing the words is
    // the whole thing this feature exists to stop.
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await deliverySaid(this, text, fate).count()) > 0,
      `"${text}" to be marked ${fate}`,
      HYDRATION_TIMEOUT,
    );
  },
);

/** The same claim, waiting out the client's own steer deadline — the ONE way
 *  the `unanswered` face can be reached, since nothing but that deadline ends
 *  a steer nobody answers. Its own step (and its own envelope) rather than a
 *  wider budget on the one above, so exactly one scenario in the suite pays
 *  for it. */
Then(
  "the chat eventually shows my message {string} as {string}",
  { timeout: STEER_DEADLINE_STEP_TIMEOUT },
  async function (this: OlaiWorld, text: string, fate: string) {
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await deliverySaid(this, text, fate).count()) > 0,
      `"${text}" to be marked ${fate}`,
      STEER_DEADLINE_TIMEOUT,
    );
  },
);

/** WHAT THE STRIP SAYS, in the words a person reads.
 *
 *  The step above is about the panel's own vocabulary (`data-delivery`), which
 *  is what the server decided; this is about the sentence drawn out of it. Both
 *  reviewers found the same hole: with only the attribute asserted, swapping
 *  the two faces' SENTENCES left the suite green, and a person reading "not
 *  sent" over a message that may well have arrived is exactly the confusion
 *  this PR exists to end. */
Then(
  "the strip under my message {string} reads {string}",
  async function (this: OlaiWorld, text: string, said: string) {
    const strip = myRow(this, text).locator(CHAT_DELIVERY);
    await strip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await strip.innerText()).includes(said),
      `the strip under "${text}" says "${oneLine(await strip.innerText())}", not "${said}"`,
    );
  },
);

/**
 * THE ROW SAYS IT IS WAITING — the message went out while a turn was running,
 * and the agent has not started on it.
 *
 * Read on the row rather than off the composer, and that is the difference the
 * two steps are about: the composer's line is a promise made before anybody
 * presses anything, and this is the state of ONE message somebody sent. A panel
 * that said the first and not the second leaves a person watching their own
 * words with nothing to tell them anything is happening about them.
 */
Then(
  "the chat shows my message {string} as waiting",
  async function (this: OlaiWorld, text: string) {
    // The BUBBLE has to still say it, exactly as the delivery steps insist: a
    // row that reported the state and lost the words would pass on the mark
    // alone.
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await myRow(this, text).locator(CHAT_QUEUED).count()) > 0,
      `"${text}" to be marked as waiting its turn`,
      HYDRATION_TIMEOUT,
    );
  },
);

/** ... and that it has stopped: the turns in front of it ended, so the agent
 *  has taken it up. The half that makes the mark worth having — a hint that
 *  never came off would be a row permanently claiming to be next. */
Then(
  "my message {string} is no longer waiting",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await myRow(this, text).locator(CHAT_QUEUED).count()) === 0,
      `"${text}" to stop saying it is waiting`,
      HYDRATION_TIMEOUT,
    );
  },
);

When("I send the undelivered message again", async function (this: OlaiWorld) {
  // `press` rather than a hand-rolled wait-then-click: it also waits out the
  // frame the click schedules, and the very next step reads the row this
  // press is about.
  await this.press(this.page.locator(CHAT_RESEND).first());
});

/** The claim that costs nothing to state and is the whole point of telling the
 *  two faces apart: where a retry would be a guess, there is no button to make
 *  it with. Read off the SETTLED page — the step before it waited for the mark
 *  — so it is an assertion rather than a race. */
Then("the chat offers no way to send it again", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_RESEND).count(),
    0,
    "a `send again` button is drawn under a message nothing ever answered about",
  );
});

Then("no message is marked undelivered", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_DELIVERY).count()) === 0,
    "the undelivered mark to come off",
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

/** ... and says it ONCE, which is a claim about a press rather than about a
 *  turn. A cancel stops everything in flight, so each turn answers `cancelled`
 *  — one press, one decision, one line. Counted over the notice rows rather
 *  than over the transcript's text, since a message could contain the word. */
Then("the chat says it once", async function (this: OlaiWorld) {
  const cancelled = this.page
    .locator(CHAT_ENTRY)
    .filter({ hasText: "cancelled" })
    .filter({ hasNot: this.page.locator(CHAT_MINE) });
  assert.strictEqual(
    await cancelled.count(),
    1,
    "the chat reported one press of cancel more than once",
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
        return at.overflow > 0 && at.fromBottom < NEAR;
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
    async () => (await scrollOf(this)).fromBottom > NEAR,
    "the transcript to be scrolled away from the bottom",
  );
});

Then(
  "the transcript has stayed where I left it",
  async function (this: OlaiWorld) {
    const at = await scrollOf(this);
    assert.ok(
      at.fromBottom > NEAR,
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
      .locator(`${CHAT_ASK_CHOICE}${attr("data-value", value)}`)
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
      .locator(`${CHAT_ASK_TEXT}${attr("data-field", field)}`)
      .fill(text);
  },
);

Then(
  "the question's {string} box still reads {string}",
  async function (this: OlaiWorld, field: string, text: string) {
    const box = question(this).locator(`${CHAT_ASK_TEXT}${attr("data-field", field)}`);
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
      `${CHAT_ASK} ${CHAT_ASK_CHOICE}${attr("data-value", value)}`,
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

/** How many calls the conversation drew, which is the one thing a claim about
 *  a REPEATED report turns on: a frame that arrives twice must produce the row
 *  the first one produced and no second one. */
Then(
  "the chat shows {int} tool call(s)",
  async function (this: OlaiWorld, many: number) {
    const calls = this.page.locator(CHAT_TOOL);
    await this.waitUntil(
      async () => (await calls.count()) === many,
      `the chat to show ${many} tool call(s)`,
      HYDRATION_TIMEOUT,
    );
  },
);

/** ...and what one of them is CALLED, which the panel picks once and never
 *  moves: a title is a display string an agent may rewrite mid-call, and a row
 *  that renamed itself under a reader would be the panel changing its mind
 *  about what happened. Read off the frame's own line, where a person reads it,
 *  and through `../support/said.ts` — which exists so that "this line does not
 *  say that" reads the same wherever this suite asks it. */
Then(
  "the chat shows a tool call named {string}",
  async function (this: OlaiWorld, named: string) {
    await saysThat(this, `${CHAT_TOOL} ${CHAT_TOOL_FOLD}`, named, "call's line");
  },
);

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
  "the spawn's fold carries {string}",
  async function (this: OlaiWorld, said: string) {
    const report = heldTool(this).locator(CHAT_TOOL_REPORT);
    await report.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await report.innerText()).includes(said),
      `the spawn's fold does not carry "${said}"`,
    );
  },
);

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
      .locator(`${CHAT_DIFF}${attr("data-path", file)}`)
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
    const boxes = this.page.locator(`${CHAT_DIFF}${attr("data-path", file)}`);
    await this.page.waitForFunction(
      ([selector, wanted]) =>
        document.querySelectorAll(selector as string).length === wanted,
      [`${CHAT_DIFF}${attr("data-path", file)}`, many] as const,
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
      // Built here rather than through the world's `attr`, which is not
      // reachable inside an `evaluate` callback — and does not need to be:
      // `kind` is one of this function's own three literals.
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
    // every palette paints it its own way and all of them mean `add`.
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
      .locator(`${CHAT_OUTLINE_DIFF}${attr("data-path", file)}`)
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

/** One row of the conversation, as a selector. Spelled once, the way a node
 *  and a day already are (`world.ts`): three literals of one scheme in one
 *  file is two of them being missed the day the scheme moves. */
const entrySelector = (id: string): string => `${CHAT_ENTRY}${attr("data-entry-id", id)}`;

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

/**
 * A LANE IS BOTH HALVES, asserted together: it NAMES an agent (`data-lane`,
 * pointing at a row the panel actually drew) and it is drawn INSET under that
 * row. Either alone passes a build that lost the other — an indent that
 * attributes nothing, or an attribution nobody can see — which is why
 * {@link insetBelow} was extracted, and this is the four lines around it,
 * now that a third caller asks the same question about a different kind of
 * row.
 *
 * @param lane the lane's own box
 * @param inner what inside it should be inset — the row, or the form
 * @param what a name for it, for the failure to read as a sentence
 * @param anonymous what to say when the lane names nobody at all
 */
const drawnInALane = async (
  world: OlaiWorld,
  lane: Locator,
  inner: Locator,
  what: string,
  anonymous: string,
): Promise<void> => {
  await lane.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const parent = await lane.getAttribute("data-lane");
  assert.ok(parent !== null && parent !== "", anonymous);
  await insetBelow(world, parent ?? "", inner, what);
};

Then(
  "the call that spawned it is in no lane of its own",
  async function (this: OlaiWorld) {
    // The other half of the claim, and the one that catches a panel that filed
    // the WRONG row away: the `Agent` call is the MAIN agent's own work, so it
    // stays in the conversation's own column with the door hanging off it —
    // which is the whole reason the record is still reachable an hour later.
    //
    // Asked of the DOOR rather than of a lane, because a lane is what this
    // change removed from the column: a subagent's calls are not drawn there
    // any more, so there is no longer a lane to read the spawn's key off.
    const parent = await this.page.locator(CHAT_LANE_DOOR).first().getAttribute("data-lane");
    assert.ok(parent !== null && parent !== "", "a door that names no agent opens onto nothing");
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

Then(
  "the chat still shows a call that sent out an {string}",
  async function (this: OlaiWorld, kind: string) {
    // The half that must NOT come off with the live one: who was sent is a
    // fact about what happened, and the row is the record of it. A panel that
    // took the whole face off when the agent died would leave a bare pending
    // dot where a spawn was — which is the bug this feature exists for,
    // arriving at the end of the turn instead of the start.
    await this.page
      .locator(`${CHAT_SPAWN}${attr("data-spawn-kind", kind)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the chat says a background task is watching {string}",
  async function (this: OlaiWorld, watching: string) {
    // WHAT WAS ARMED, on the line of the call that armed it. The description
    // rather than the title, because the title of the call is `Bash` or
    // `Monitor` and the description is the sentence a person recognises their
    // own watch by — which is the whole of what "how do you know you are
    // babysitting right now?" was asking for.
    const armed = this.page.locator(CHAT_ARMED).first();
    await armed.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      (await armed.textContent())?.includes(watching),
      true,
      `the armed call does not say it is watching "${watching}"`,
    );
    // ... and the harness's own id for the task travels with it, which is what
    // makes every later frame about the task land on THIS row.
    const task = await armed.getAttribute("data-task");
    assert.ok(
      task !== null && task !== "",
      "a background task nobody can name is not one this panel can follow",
    );
  },
);

Then("the chat says that task is still running", async function (this: OlaiWorld) {
  // THE LIVE HALF, and the one this scenario keeps asking about across two
  // turns: a task is out there and nothing has said it stopped. The same rail
  // a spawned agent hangs, because an agent in flight and a task in flight are
  // one kind of fact to a reader.
  const still = this.page.locator(CHAT_ARMED_STILL).first();
  await still.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const armed = await still.getAttribute("data-lane");
  assert.ok(
    armed !== null && armed !== "",
    "a rail that names no call is an indent, not an attribution",
  );
  // The same geometry a lane owes: the rail is the claim that something else
  // is going on under this row, and one drawn level with the conversation says
  // the agent is doing it.
  await insetBelow(this, armed ?? "", still, "the task that was armed");
});

Then(
  "the chat says that task ended {string}",
  async function (this: OlaiWorld, ended: string) {
    // THE DEATH, which is the fact this whole feature exists for — and in the
    // HARNESS's word, off the attribute rather than the sentence, because ACP
    // has four statuses and `failed`, `killed` and `stopped` all reach the row
    // as one of them.
    await this.page
      .locator(`${CHAT_ARMED_ENDED}${attr("data-ended", ended)}`)
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the chat shows the harness saying {string}",
  async function (this: OlaiWorld, said: string) {
    // ... and what it SAID about the ending, drawn without unfolding anything.
    // A task's row is one line for as long as the task runs and then one
    // sentence, and that sentence is where a background shell's exit code is:
    // behind the fold it would be the one thing the row was ever going to say,
    // hidden behind the same click as the arguments.
    await this.waitUntil(
      async () => {
        const shown = await this.page.locator(CHAT_TOOL_PROGRESS).allTextContents();
        return shown.some((text) => text.includes(said));
      },
      `the panel to show the harness saying "${said}"`,
      HYDRATION_TIMEOUT,
    );
  },
);


Then(
  "the strip says {string} is running",
  async function (this: OlaiWorld, name: string) {
    // ABOVE THE SCROLL, which is the whole claim: the strip is outside the
    // transcript pane, so it answers "is my watch still up?" from wherever the
    // reader is — including, in this scenario, from the bottom of a
    // conversation whose arming row is long gone off the top.
    const task = this.page
      .locator(`${CHAT_WATCHING} ${CHAT_WATCHING_TASK}`)
      .filter({ hasText: name })
      .first();
    await task.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // ... naming the ROW it belongs to, so the strip and the record are one
    // task named twice rather than two facts free to disagree.
    const row = await task.getAttribute("data-row");
    assert.ok(
      row !== null && row !== "",
      "a strip that names no row is a second copy of the task, not the same one",
    );
    // ... and how long it has been out, in the same words the row uses.
    const said = await task.locator(CHAT_WATCHING_FOR).first().textContent();
    assert.ok(
      secondsSaid(said ?? "") !== null,
      `the strip says it has been running "${said}", which is not a duration`,
    );
  },
);

Then("the call that armed the task is out of sight", async function (this: OlaiWorld) {
  // The condition the whole strip exists for, made true in a scenario rather
  // than asserted about a screenshot: the arming row is off the top of the
  // pane, which is where a monitor armed at the start of a session lives for
  // the rest of it. Measured against the PANE rather than the window, because
  // the row is clipped by the pane's own scroll.
  const gone = await this.page
    .locator(CHAT_TRANSCRIPT)
    .evaluate((pane, selector) => {
      const row = pane.querySelector(selector);
      if (row === null) return "the arming row is not in the transcript at all";
      const seen = row.getBoundingClientRect();
      const within = pane.getBoundingClientRect();
      return seen.bottom > within.top && seen.top < within.bottom
        ? "the arming row is still on screen"
        : null;
    }, `${CHAT_TOOL}${attr("data-tool-status", "in_progress")}`);
  assert.strictEqual(gone, null, gone ?? "");
});

Then("the newest line says {string}", async function (this: OlaiWorld, said: string) {
  // WHERE THE READER IS, which is the ruling: a death edited into a row an
  // hour up the scroll is a death nobody meets. The LAST row, not "somewhere
  // in the transcript" — that weaker claim passes on the arming row's own
  // ending and would have passed before any of this existed.
  await this.waitUntil(
    async () => {
      const rows = this.page.locator(CHAT_ENTRY);
      const last = await rows.count();
      if (last === 0) return false;
      const text = (await rows.nth(last - 1).textContent()) ?? "";
      return text.includes(said);
    },
    `the newest row to say "${said}"`,
    HYDRATION_TIMEOUT,
  );
});

Then("the chat says nothing is running in the background", async function (this: OlaiWorld) {
  // The strip goes with the task. A standing fact that outlives the thing it
  // stands for is worse than none: it is the one place a person looks to find
  // out whether their watch is up.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_WATCHING).count()) === 0,
    "the background-task strip to clear",
    HYDRATION_TIMEOUT,
  );
});
Then("the chat says no background task is still running", async function (this: OlaiWorld) {
  // A live face that outlives the thing it is about is worse than none: this
  // rail says a watch is still out, and a watch that has died is exactly what
  // a person must not be told is running.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_ARMED_STILL).count()) === 0,
    "the panel to stop saying a background task is still running",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat says no agent is still working", async function (this: OlaiWorld) {
  // A face that outlives the agent is worse than none: it says a fan-out is
  // running when the turn is over.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_SPAWN_WORKING).count()) === 0,
    "the panel to stop saying an agent is working",
    HYDRATION_TIMEOUT,
  );
});

/**
 * The readout's duration, in seconds, read back out of the words on the row.
 *
 * The panel says `47s`, `1m 12s`, `1h 20m` — coarser as it goes up — so the
 * three shapes are parsed rather than one, and a string that is none of them
 * comes back `null` so the step can say the panel drew something that is not a
 * duration instead of quietly comparing `NaN`.
 */
const secondsSaid = (said: string): number | null => {
  // `(?=.)` is what makes the requirement the PATTERN's: every group after it is
  // optional, so without it the empty string matches and comes back as a
  // confident `0` for a row that said nothing at all.
  const parts = /^(?=.)(?:(\d+)h )?(?:(\d+)m ?)?(?:(\d+)s)?$/.exec(said.trim());
  if (parts === null) return null;
  const [, hours, minutes, seconds] = parts;
  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
};

Then(
  "the chat says how long a running call has been going",
  async function (this: OlaiWorld) {
    // THE LIVE HALF, like the spawn rail above: it is only true while the call
    // is still out, so it is found by waiting for it rather than by looking
    // after the fact.
    const elapsed = this.page.locator(CHAT_TOOL_ELAPSED).first();
    await elapsed.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = (await elapsed.textContent()) ?? "";
    assert.ok(
      secondsSaid(said) !== null,
      `the elapsed readout says "${said}", which is not a duration`,
    );
    // ... and it is on a call the WIRE still calls running. This is the claim
    // that keeps the readout agent-agnostic and honest at once: no tool name is
    // recognised anywhere, so the status is the whole of what earns a number.
    // ONE selection, and the count is asserted rather than `.first()` taken, so
    // "the timed call" cannot silently mean a different row from the readout
    // above.
    const timed = this.page
      .locator(CHAT_TOOL)
      .filter({ has: this.page.locator(CHAT_TOOL_ELAPSED) });
    assert.strictEqual(
      await timed.count(),
      1,
      "the panel is timing more than one call, or none — this scenario is " +
        "about the single call that is still out",
    );
    const status = await timed.getAttribute("data-tool-status");
    assert.ok(
      status === "pending" || status === "in_progress",
      `a call the wire calls "${status}" is being timed; only a call that has ` +
        "not come back has a duration to draw",
    );
  },
);

Then(
  "the chat still shows a call the wire calls {string}",
  async function (this: OlaiWorld, status: string) {
    // The half that must NOT come off. A status is the agent's own word and the
    // row is the record of what it said, so a call its turn walked away from
    // goes on saying `in_progress` for as long as the panel is open — that is
    // the honest account of a call that was announced and never reported on.
    // What stops is the live FACE, and this is what makes the assertion beside
    // it mean something: the row that is not being timed is still there, still
    // saying the wire's own word.
    await this.page
      .locator(`${CHAT_TOOL}${attr("data-tool-status", status)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("that elapsed time is ticking", async function (this: OlaiWorld) {
  // A number that appeared once and froze would pass every assertion above and
  // be the thing this feature exists against: a reader watching a long call
  // wants to know it is still going, and a stopped clock says the opposite of
  // that while looking identical.
  const elapsed = this.page.locator(CHAT_TOOL_ELAPSED).first();
  const first = secondsSaid((await elapsed.textContent()) ?? "") ?? 0;
  await this.waitUntil(
    async () => (secondsSaid((await elapsed.textContent()) ?? "") ?? 0) > first,
    `the elapsed readout to count past ${first}s`,
    POLL_TIMEOUT,
  );
});

Then("the chat times no call", async function (this: OlaiWorld) {
  // The half that has to come OFF, and the reason it is asked of the whole
  // panel rather than of one row: a clock still counting is a claim that
  // something is still running, and it is a claim that gets louder every second
  // it is wrong.
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_TOOL_ELAPSED).count()) === 0,
    "the panel to stop timing any call",
    HYDRATION_TIMEOUT,
  );
});

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

/** The lane a QUESTION is drawn in. `:has()` rather than a walk up the tree,
 *  because what is being claimed is containment: the form is INSIDE the lane's
 *  own box, which is what makes the rail run past it and the indent apply to
 *  it. A form drawn beside a lane would satisfy neither. */
const askLane = (world: OlaiWorld) =>
  world.page.locator(`${CHAT_LANE}:has(${CHAT_ASK})`).first();

Then(
  "the question is drawn in the lane of the agent that asked it",
  async function (this: OlaiWorld) {
    // The same two halves a subagent's tool call owes, of the same lane, so
    // "the form is in the lane" is one claim rather than a second spelling of
    // one — see `drawnInALane`.
    const lane = askLane(this);
    await drawnInALane(
      this,
      lane,
      lane.locator(CHAT_ASK),
      "the question",
      "the form is drawn in the main column, which says the agent you are " +
        "talking to is the one asking — and a permission form is the row " +
        "where believing that changes what somebody decides",
    );
  },
);

Then(
  "the question's lane names itself, as {string}",
  async function (this: OlaiWorld, named: string) {
    // WHICH LANE the name belongs to, which is the half the count-and-text
    // step above ("exactly one lane names itself") cannot say: it is the
    // FORM's lane that has to carry it, because that is the row a reader
    // arrives at from the composer or the header with nothing above it read.
    const label = askLane(this).locator(CHAT_LANE_LABEL).first();
    await label.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = oneLine(await label.innerText());
    assert.ok(
      said.includes(named),
      `the form's lane says "${said}" rather than naming "${named}"`,
    );
  },
);

Then(
  "no lane introduces itself under the question",
  async function (this: OlaiWorld) {
    // THE VISIBLE HALF of the same bug, and a PLACE rather than a count — the
    // count is the existing step's, run beside this one. A form in no lane
    // ends the stretch, so the lane opened again and introduced itself UNDER
    // the form: one name on screen either way, on the wrong row.
    const form = await askLane(this).locator(CHAT_ASK).boundingBox();
    const named = await this.page.locator(CHAT_LANE_LABEL).first().boundingBox();
    assert.ok(form !== null && named !== null, "the form or its lane's name is not drawn");
    assert.ok(
      named.y < form.y,
      `a lane introduces itself at ${named.y}, below the form at ${form.y} — ` +
        "the form broke the run, so the same agent's next call opens a lane " +
        "of its own and one subagent reads as two",
    );
  },
);

// ── the completion over the box ────────────────────────────────────────
//
// ONE set of steps for both lists — the agent's commands under a `/` and what
// the served directory holds under an `@` — because they are one box in the
// client (`web/src/client/chat/CompletionMenu.tsx`) and a second spelling here
// would be two scenarios' worth of drift about what "the completion offers"
// means. A row is named by its `data-value`, which is what taking it writes:
// the command's name, the file's path, or the node's id.

/** WHICH list, off `data-kind` — `command` or `name`. Named rather than
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
      .locator(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the completion does not offer {string}",
  async function (this: OlaiWorld, value: string) {
    // Wait for THIS query's node half, then HOLD the absence. The
    // attribute lives on the box (always there) as well as the list
    // (only while there are rows): a word that named nothing draws no
    // list, and waiting for the list is a wait the empty answer never
    // satisfies. `completingIn` is the composer's own read of the
    // armed query, so the wait and the box cannot disagree about which
    // word has been answered.
    const text = await (await chatBox(this)).inputValue();
    const armed = completingIn(text, text.length);
    if (armed !== null && armed.kind === "name") {
      await answered(this, CHAT_INPUT, armed.query);
    } else {
      await this.waitForFrame();
    }
    const rows = await this.page
      .locator(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`)
      .count();
    assert.strictEqual(
      rows,
      0,
      `the completion offers ${JSON.stringify(value)}`,
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
    const row = this.page.locator(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await row.innerText()), `${label} ${hint}`);
  },
);

/**
 * WHICH BLOCK IS ABOVE WHICH, when the `@` list holds both of the things the
 * directory can be named by.
 *
 * The labels in the order they are drawn, which is the only way to assert this:
 * "files first" is a claim about the LIST rather than about any row of it, and
 * two `offers` steps in the order somebody wrote them would pass whatever the
 * list did.
 */
Then(
  "the completion block {string} comes before the block {string}",
  async function (this: OlaiWorld, first: string, second: string) {
    await expectBefore(
      this,
      this.page.locator(CHAT_COMPLETION_SECTION),
      "data-section",
      first,
      second,
    );
  },
);

When("I accept the completion", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_INPUT).press("Enter");
  await keysSettled(this);
});

/** The pointer's door onto the same row, for the hand that is already there. */
When(
  "I click the completion {string}",
  async function (this: OlaiWorld, value: string) {
    await this.page
      .locator(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`)
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
    await keysSettled(this);
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
/** No `trouble` on screen — what went wrong where nobody was waiting, and the
 *  claim that nothing did. No wait of its own: the step before it has already
 *  waited for something the panel could only have drawn after the moment this
 *  is about, so a `trouble` that was coming would be here. */
/** The BANNER, which is a different claim from a notice in the transcript:
 *  a notice scrolls away with the conversation and this does not, and the one
 *  ending that leaves it up deliberately is a turn that produced nothing. */
Then("the panel says something went wrong", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_TROUBLE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat says nothing went wrong", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(CHAT_TROUBLE).count(), 0);
});

/** ONE AGENT of the several installed could not be asked — a different claim
 *  from the one above, and the whole reason it has a locator of its own: this
 *  one leaves every other agent's conversations on the screen, and the picker
 *  did not refuse. Named by the agent, so a list with two broken agents in it
 *  is two assertions rather than one ambiguous locator. */
Then(
  "the list says {string} could not be asked, with {string}",
  async function (this: OlaiWorld, agent: string, reason: string) {
    const line = this.page.locator(
      `${CHAT_SESSION_UNREACHABLE}${attr("data-agent", agent)}`,
    );
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await line.innerText()).includes(reason),
      `the list to give "${agent}"'s own reason, "${reason}"`,
    );
  },
);

/** The other half of the claim: a refusal draws no rows, so the two answers
 *  cannot be confused by a reader who sees an empty list under an error. */
Then("the unassigned list is empty", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(CHAT_SESSION).count(), 0);
});

Then("the unassigned list lists {string}", async function (this: OlaiWorld, title: string) {
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

/** A conversation in the list, said to be one AGENT's — which is the whole of
 *  the fan-out's claim: the list is not the agent this panel happens to be
 *  talking to. By the roster's id rather than by the brand name beside it. */
Then(
  "the unassigned list shows {string} under the agent {string}",
  async function (this: OlaiWorld, title: string, agent: string) {
    await this.page
      .locator(`${CHAT_SESSION}${attr("data-agent", agent)}`, { hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The HEADING over that agent's rows. Its own step because grouping and
 *  belonging are two claims: a flat list of correctly-tagged rows would pass
 *  the one above and be the interleaved list this arrangement exists to
 *  replace. */
Then(
  "the unassigned list is grouped under the agent {string}",
  async function (this: OlaiWorld, agent: string) {
    await this.page
      .locator(`${CHAT_SESSION_AGENT}${attr("data-agent", agent)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** ... and that it is NOT grouped, which is the one-agent case: a heading over
 *  the whole list says what the panel's own header already says. */
Then("the unassigned list has no headings", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(CHAT_SESSION_AGENT).count(), 0);
});

/** One row of the list, by its title — the hand every row-level claim shares,
 *  because the title is what a person means by the conversation. */
const rowOf = (world: OlaiWorld, title: string): Locator =>
  world.page.locator(CHAT_SESSION, { hasText: title }).first();

/** HOW BIG a conversation it says — the adapter's own count, read off the row
 *  the way a person's eye takes it: the words, not the element carrying them.
 *  The plural pattern; one message is checked by its own, because the drawn
 *  word changes to "message" — and the singular, not the number, is what the
 *  review noted the step below could otherwise never observe. */
Then(
  "the row for {string} says it has {int} messages",
  async function (this: OlaiWorld, title: string, count: number) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = oneLine(await row.innerText());
    assert.ok(
      said.includes(`${count} messages`),
      `the row for "${title}" to say "${count} messages" — it says: "${said}"`,
    );
  },
);

Then(
  "the row for {string} says it has one message",
  async function (this: OlaiWorld, title: string) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await row.innerText()).includes("1 message"),
      `the row for "${title}" to say "1 message"`,
    );
  },
);

/** ... and the other answer, for the agent whose `session/list` carries no
 *  corner to read a count out of: nothing there — never a zero standing in
 *  for nobody having asked. */
Then(
  "the row for {string} shows no message count",
  async function (this: OlaiWorld, title: string) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      !/\d+ messages?/.test(oneLine(await row.innerText())),
      `the row for "${title}" to show no message count`,
    );
  },
);

/** WHICH conversation replaced this one, read off the row — the picker's own
 *  answer to "which of these two do I want" before anybody opens the wrong
 *  half of a `/clear` pair. */
Then(
  "the row for {string} was superseded by {string}",
  async function (this: OlaiWorld, title: string, successor: string) {
    const line = rowOf(this, title).locator(CHAT_SESSION_SUPERSEDED).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = oneLine(await line.innerText());
    assert.ok(
      said.includes(successor),
      `the row for "${title}" to name "${successor}" — it says: "${said}"`,
    );
  },
);

Then(
  "the row for {string} was not superseded",
  async function (this: OlaiWorld, title: string) {
    // The absence of the line, not of the word: a title could supersede in
    // name only, and a superseded row carries the one element with the fact.
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await row.locator(CHAT_SESSION_SUPERSEDED).count(), 0);
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

// ── a conversation the agent would not open ────────────────────────────
//
// The panel's third body, and the one that is about a LIVE agent: it answered,
// and what it answered was no. The claims are what tells that apart from a dead
// one — the header still names the model, the reason is the agent's own words,
// and there is something to press.

Then("the panel says the conversation could not be opened", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_UNOPENED)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the panel shows no such refusal", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_UNOPENED).count()) === 0,
    "the refused-conversation face to go",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the refusal is in the agent's own words, {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, CHAT_UNOPENED_WHY, said, "refusal");
  },
);

When("I try to open it again", async function (this: OlaiWorld) {
  const again = this.page.locator(CHAT_REOPEN);
  await again.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await again.click();
});

/** What a CLICK was told, wherever the panel says it. The refused-conversation
 *  body draws the same line the transcript does — there is no transcript in it
 *  to put one in, and the button it sits under is the only control there is. */
Then(
  "the chat says the click was refused, with {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, CHAT_REFUSAL, said, "refused click");
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

// ── which servers this conversation has ────────────────────────────────
//
// The claim is about the PANEL, which is the whole of `mcp-roster-visible`:
// what the session was handed is already asserted through the agent's own
// `servers` answer (`a_failed_mcp_server.feature`), and it was asserted there
// while a person looking at the app could only ever see the failures.
//
// THE STANDING IS READ AS DATA, never as a mark. Which glyph says "connected"
// is a decision about pixels and belongs to whoever is drawing it next; that
// the panel says the agent attached a named server is the behaviour, and it is
// what these assert (HACKING.md — tests assert behaviour, not styling).

/** One roster row's standing, waited for. The four steps below differ in one
 *  word, so the selector shape, the attribute name, the failure label and the
 *  timeout are chosen once: a fifth standing (the union is designed to grow) is
 *  then one more registration rather than a fifth copy of this call.
 *
 *  HYDRATION_TIMEOUT because the roster cannot exist until the probe has
 *  answered and the session has been asked for, which is a boot rather than a
 *  render. */
const standingIs = (
  world: OlaiWorld,
  name: string,
  standing: string,
): Promise<void> =>
  world.expectAttribute(
    `${CHAT_SERVER}${attr("data-server", name)}`,
    "data-standing",
    standing,
    `the roster row for "${name}"`,
    HYDRATION_TIMEOUT,
  );

Then(
  "the panel says this conversation has {string}",
  async function (this: OlaiWorld, name: string) {
    await this.expectAttribute(
      CHAT_SERVER,
      "data-server",
      name,
      "this conversation's server list",
      HYDRATION_TIMEOUT,
    );
  },
);

/** ... and the layer above it: the agent itself said it attached. Its own step
 *  because the two are two facts with two sources — olai knows what it handed
 *  over, and only the agent knows what it did with it — and a panel that drew
 *  the second on the strength of the first would be making the claim the model
 *  made wrongly. */
Then(
  "the panel says the agent attached {string}",
  async function (this: OlaiWorld, name: string) {
    await standingIs(this, name, "connected");
  },
);

/** ... and the honest silence where nobody has said so. `handed` is what a
 *  conversation looks like before its agent has spoken and on an agent that
 *  never speaks per server, and it is the state a panel must not quietly
 *  promote — a tick nobody asserted is exactly what this feature is against. */
Then(
  "the panel does not claim the agent attached {string}",
  async function (this: OlaiWorld, name: string) {
    await standingIs(this, name, "handed");
  },
);

Then(
  "the panel says the list is not the whole of it",
  async function (this: OlaiWorld) {
    // The apostrophe is normalised because the panel sets a TYPOGRAPHIC one and
    // this claim is about the sentence rather than about the glyph — a step
    // that spelled `’` would be one more place to edit the day somebody
    // reworded the line, and would fail for a reason no reader would guess.
    const said = oneLine(await this.page.locator(CHAT_ROSTER_OWN).innerText())
      .replace(/[‘’]/g, "'");
    assert.ok(
      said.includes("the agent's own"),
      `the panel lists this conversation's servers without saying that an agent ` +
        `may have servers of its own that olai never handed it — which makes the ` +
        `list a completeness claim olai has no way to make. It reads: ${said}`,
    );
  },
);

/** The other side of every claim above: the strip is there at all. Asserted on
 *  its own where a scenario's point is that a conversation HAS a roster rather
 *  than which servers are on it. */
Then("the panel says nothing about this conversation's servers", async function (
  this: OlaiWorld,
) {
  assert.strictEqual(
    await this.page.locator(CHAT_ROSTER).count(),
    0,
    "the panel lists servers for a conversation there is none of — the roster " +
      "is a property of a session, and a list left standing between two of them " +
      "describes a conversation nobody is in",
  );
});

// ── a server that did not attach ───────────────────────────────────────
//
// #140's half, unchanged: the SENTENCE, for a server this conversation does not
// have. It is the half that never helped anybody when it was only a debug log
// line, and it is why a roster of names alone would not have been enough.

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

/** The OTHER way a conversation ends up short of a server, and the one olai
 *  could not report at all until `mcp-roster-visible`: olai handed it over and
 *  the AGENT could not attach it. Its own step because the two are different
 *  facts with different fixes — nothing olai's probe can see is wrong with this
 *  one — and because the panel says it in the agent's own word rather than in a
 *  category of ours. */
Then(
  "the panel says the agent could not attach {string}",
  async function (this: OlaiWorld, name: string) {
    await standingIs(this, name, "unattached");
    await this.expectAttribute(
      CHAT_MISSING_SERVER,
      "data-server",
      name,
      "the sentence under the roster",
      HYDRATION_TIMEOUT,
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
      // Inside an `evaluate`: the world's `attr` cannot be called here, and `at`
      // is a `TestId` — a kebab-case literal from a closed table.
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
    // `attr` is unreachable inside an `evaluate`, and `at` is a `TestId`.
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
      // `[multiple]`: the ROLL input, not the camera's — on a phone there are
      // two file inputs in the panel and the unscoped selector below is a
      // strict-mode violation rather than a reading.
      .locator(`${CHAT_PANEL} input[type=file][multiple]`)
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

When(
  "I take a photo called {string} with the camera",
  async function (this: OlaiWorld, name: string) {
    const spec = fileSpec(name);
    // The DOM fact the whole door hangs on, asserted before the photo is
    // handed over: what makes a phone's browser open the CAMERA rather than
    // a picker for this input is `capture="environment"`. No browser this
    // suite can drive opens a real camera, so the attribute is what the
    // claim is asserted on — the same arrangement as the pick step beside
    // it, which asserts `accept` because the dialog itself cannot be
    // photographed either.
    const hole = this.page.locator(`${CHAT_PANEL} input[type=file][capture]`);
    assert.strictEqual(
      await hole.getAttribute("capture"),
      "environment",
      "the camera input must spell capture=\"environment\" — without it a " +
        "phone opens the file picker, and the button is a second roll door",
    );
    const accept = await hole.getAttribute("accept");
    assert.ok(
      accept !== null && accept.includes("image/"),
      `the camera offers "${accept}" — and one shot is only ever a picture`,
    );
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.page.locator(CHAT_CAMERA_BUTTON).click(),
    ]);
    await chooser.setFiles({
      name: spec.name,
      mimeType: spec.type,
      buffer: Buffer.from(spec.data, "base64"),
    });
    // The mechanism the identical-second-shot case rides on, asserted AT the
    // mechanism: this harness INJECTS files and fires `change`
    // unconditionally, so two identical shots can never see whether the input
    // was cleared between them — and the clear is the only way a real second
    // identical shot fires at all. What the chips prove is the server's `-1`
    // answer and the strip's order; what this proves is the clear.
    assert.strictEqual(
      await hole.inputValue(),
      "",
      "the shutter input must be cleared after a shot — an identical second " +
        "capture fires no `change` on an uncleared one",
    );
  },
);

When("I dismiss the camera", async function (this: OlaiWorld) {
  // The empty answer: backing out of a shutter hands the input no files and
  // (on the browsers that fire for it) a `change` — the same shape a
  // cancelled picker takes. The box must then be exactly as it was, which is
  // what the next step is for.
  const [chooser] = await Promise.all([
    this.page.waitForEvent("filechooser"),
    this.page.locator(CHAT_CAMERA_BUTTON).click(),
  ]);
  await chooser.setFiles([]);
});

Then("the composer is not offering a camera", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_CAMERA_BUTTON).count(),
    0,
    "a desktop draws no camera door: the attribute behind it would be " +
      "ignored there, and a camera button that opens a file dialog lies",
  );
});

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
    // Same as above: browser-side code, and a `TestId` for a value.
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

const pictureChip = (name: string): string => `${CHAT_ATTACHMENT}${attr("data-name", name)}`;

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

// ── which agent ────────────────────────────────────────────────────────
//
// A conversation is bound to one agent, chosen when it is created. The claims
// here are about the PANEL — that it asks, that it stops asking once answered,
// and that the header says who — because everything under them has unit tests
// of its own: the roster's rules, the fail-safe rule per leg, and which body a
// state asks for are all functions over values.

Then("the panel asks which agent", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_CHOOSE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/** ... and that it does not, which is a different claim from "a conversation is
 *  open" and is asserted separately for the reason the panel's other faces are:
 *  a question drawn where a conversation belongs is a face outliving its
 *  cause. */
Then("the panel does not ask which agent", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => {
      const status = await this.page.locator(CHAT_PANEL).getAttribute("data-status");
      return (
        (status === "idle" || status === "thinking") &&
        (await this.page.locator(CHAT_CHOOSE).count()) === 0
      );
    },
    "the panel to hold a conversation rather than a question about which agent",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the picker offers the agent {string}",
  async function (this: OlaiWorld, id: string) {
    // BY ID rather than by the name on the row: what a scenario is about is
    // that this machine's opencode is offered, and the words beside it are a
    // brand's to change.
    await this.page
      .locator(`${CHAT_CHOOSE_AGENT}${attr("data-agent", id)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When("I choose the agent {string}", async function (this: OlaiWorld, id: string) {
  const row = this.page.locator(`${CHAT_CHOOSE_AGENT}${attr("data-agent", id)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await row.click();
  // The answer starts a subprocess and opens a conversation, so the panel goes
  // through `booting` on its way back to a body a scenario can act on.
  await this.waitUntil(
    async () => {
      const status = await this.page.locator(CHAT_PANEL).getAttribute("data-status");
      return status === "idle" || status === "thinking";
    },
    `the panel to settle after choosing "${id}"`,
    HYDRATION_TIMEOUT,
  );
});

/** Choose, and come straight back — the panel is left mid-boot on purpose,
 *  because the window this is for is the one BEFORE it settles. Its sibling
 *  above waits, which is right for every scenario that is about what happens
 *  after. */
When(
  "I choose the agent {string} without waiting for it",
  async function (this: OlaiWorld, id: string) {
    const row = this.page.locator(`${CHAT_CHOOSE_AGENT}${attr("data-agent", id)}`);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await row.click();
  },
);

Then(
  "the header names the agent {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      CHAT_AGENT,
      "data-agent",
      id,
      "the agent named in the panel header",
    );
  },
);

/** The ICON half of the ruling, which an assertion about the name passes
 *  without. `data-mark` is what was DRAWN — the agent's own shape, or the
 *  generic one an agent olai has no mark for gets — so this fails on a build
 *  where every agent fell back to the same glyph. */
Then("the header draws that agent's own mark", async function (this: OlaiWorld) {
  const id = await this.page.locator(CHAT_AGENT).getAttribute("data-agent");
  assert.ok(id !== null, "the header names no agent, so there is no mark to check");
  await this.expectAttribute(
    `${CHAT_AGENT} ${CHAT_AGENT_MARK}`,
    "data-mark",
    id,
    "the mark drawn beside the agent's name",
  );
});

Then(
  "the panel tells me how to install {string}",
  async function (this: OlaiWorld, id: string) {
    await this.page
      .locator(`${CHAT_INSTALL}${attr("data-agent", id)}`)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then("the composer says a message would queue", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_QUEUES)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** ... and that it says nothing when there is nothing to say: an idle agent
 *  takes what you type at once whichever agent it is, so a line about queueing
 *  outside a running turn would be a claim about nothing. */
Then("the composer says nothing about queueing", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_QUEUES).count()) === 0,
    "the composer to say nothing about queueing",
    POLL_TIMEOUT,
  );
});

/** The way out of the picker that `+ new` raised. It exists only for THAT
 *  door: the panel's own question has no conversation behind it to keep. */
When("I keep the conversation I am in", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_CHOOSE_CANCEL).click();
});

/** ... and that it has NOT — the half a queued message needs, because "the
 *  words went out at once" and "the agent has not reached them yet" are two
 *  facts and only the second one is about the queue. Checked twice with a beat
 *  between, so an answer that was merely a moment away fails this rather than
 *  passing it. */
Then(
  "the chat has not answered {string}",
  async function (this: OlaiWorld, text: string) {
    const answered = async (): Promise<boolean> =>
      oneLine(await this.page.locator(CHAT_TRANSCRIPT).innerText()).includes(text);
    assert.ok(!(await answered()), `the chat has already answered "${text}"`);
    await this.page.waitForTimeout(700);
    assert.ok(!(await answered()), `the chat answered "${text}" while it was held`);
  },
);

/** This machine stops having opencode, for the next start of its server. A
 *  property of the MACHINE rather than of anything the client says — the same
 *  thing the `@opencode` tag decides, moved mid-scenario, which is what
 *  uninstalling an agent between two serves looks like from here. */
When("opencode is no longer installed", function (this: OlaiWorld) {
  this.hasOpencode = false;
});

/**
 * WHAT A SUBAGENT LEFT BEHIND IN THE CONVERSATION, which is meant to be
 * nothing but the call that sent it.
 *
 * A lane in the column is not by itself a failure — a QUESTION is deliberately
 * still drawn in one, because a form behind a click is a turn that hangs
 * forever. What may not be there is a subagent's WORK, so the claim is spelled
 * over lanes that contain a tool call rather than over lanes.
 */
const laneCalls = (world: OlaiWorld) =>
  world.page.locator(`${CHAT_LANE}:has(${CHAT_TOOL})`);

Then(
  "the conversation carries none of the subagent's calls",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await laneCalls(this).count()) === 0,
      "the transcript to carry no subagent tool calls",
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the call that spawned it offers a door to {int} calls, as {string}",
  async function (this: OlaiWorld, many: number, named: string) {
    const door = this.page.locator(CHAT_LANE_DOOR).first();
    await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = oneLine(await door.innerText());
    assert.ok(
      said.includes(String(many)),
      `the door says "${said}" rather than naming ${many} calls behind it`,
    );
    // ... AND WHICH AGENT, which is the half a count cannot carry. The adapter
    // titles every `Agent` call `Task`, so a fan-out is a column of identical
    // rows and the door is where the difference has to be said. The fake agent
    // titles its spawns the same way for exactly this reason, so a door that
    // read the row's title instead of the description fails here.
    assert.ok(
      said.includes(named),
      `the door says "${said}" rather than naming "${named}" — the row above it ` +
        "is titled with the tool's name, so this is the only thing on it that " +
        "says which agent is behind the door",
    );
    // WHICH agent it opens, off the attribute rather than off the words: the
    // door and the record are one thing named twice, and a control that named
    // nothing would be an indent rather than a way in.
    const opens = await door.getAttribute("data-lane");
    assert.ok(opens !== null && opens !== "", "a door that names no agent opens onto nothing");
    // ... and the same geometry a lane owes, because it is the same rail: a
    // door drawn level with the conversation says the main agent did this.
    await insetBelow(this, opens ?? "", door, "the door onto a subagent's work");
  },
);

Then("the call that spawned it offers no door yet", async function (this: OlaiWorld) {
  // The other half of the stretch this scenario is about: the agent has made
  // no calls, so there is nothing behind a door — and a control that opened an
  // empty box at the one moment somebody is watching hardest is worse than the
  // rail above it, which is already saying the true thing.
  assert.strictEqual(
    await this.page.locator(CHAT_LANE_DOOR).count(),
    0,
    "a door is offered onto an agent that has not called anything",
  );
});

When("I open the agent's work from the transcript", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_LANE_DOOR).first().click();
});

When("I open {string} from the strip", async function (this: OlaiWorld, named: string) {
  // BY NAME, because the strip is the tab bar of a fan-out and the whole point
  // of pressing one entry rather than another is which agent you get.
  const entry = this.page
    .locator(`${CHAT_WATCHING_TASK}[data-kind="agent"]`, { hasText: named })
    .first();
  await entry.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await entry.click();
});

Then("I can close the agent's work", async function (this: OlaiWorld) {
  // THROUGH THE DOOR IT WAS OPENED BY, which is the only way there is now: the
  // shelf's own × was retired (the human, 2026-08-28), because a control on a
  // box about an agent reads as a control over the AGENT — and one reader had
  // already read it that way. Pressing the door again is what "put it away"
  // means at both doors, and this scenario opened the shelf from the row's.
  await this.page.locator(CHAT_LANE_DOOR).first().click();
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_PREVIEW).count()) === 0,
    "the shelf to close",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the agent's work is open, and it is {string}",
  async function (this: OlaiWorld, named: string) {
    const head = this.page.locator(CHAT_PREVIEW_OF);
    await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = oneLine(await head.innerText());
    assert.ok(
      said.includes(named),
      `the shelf is about "${said}" rather than about "${named}"`,
    );
  },
);

Then(
  "the agent's work shows {int} calls",
  async function (this: OlaiWorld, many: number) {
    const rows = this.page.locator(`${CHAT_PREVIEW} ${CHAT_TOOL}`);
    await this.waitUntil(
      async () => (await rows.count()) === many,
      `${many} of the agent's own calls to be drawn in the shelf`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the agent's work says a question is waiting",
  async function (this: OlaiWorld) {
    // THE PROMISE THIS KEEPS is `docs/chat.md`'s: with the conversation in front
    // of you, a form arriving is the whole of it — it lands where you are
    // already looking and nothing rings, because a notification about something
    // on your screen is nagging. A shelf is the one surface that takes a
    // reader's eye off the transcript while the panel counts as open, so it
    // owes them the sentence the transcript would have given them.
    await this.page
      .locator(CHAT_PREVIEW_ASKED)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

When(
  "I go to the question from the agent's work",
  async function (this: OlaiWorld) {
    await this.page.locator(CHAT_PREVIEW_ASKED).click();
  },
);

Then("no agent's work is open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(CHAT_PREVIEW).count()) === 0,
    "the shelf to be put away",
    HYDRATION_TIMEOUT,
  );
});

Then("the agent's work shows nothing yet", async function (this: OlaiWorld) {
  // AN HONEST SENTENCE rather than an empty box: an agent's first act is to
  // read its instructions, which produces no frame, and a shelf that drew
  // nothing at all would read as one that had failed to load.
  await this.page
    .locator(CHAT_PREVIEW_NOTHING)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the agent's work is above the conversation and clear of the box",
  async function (this: OlaiWorld) {
    // THE THREE THINGS THE PLACEMENT WAS CHOSEN FOR, measured rather than
    // asserted in a docstring. It is a real browser claim and it earns a
    // scenario: a shelf that overlapped the transcript would hide a question a
    // subagent asked — which is the one row this whole design keeps in the
    // conversation on purpose — and one that overlapped the box would take the
    // reply away from somebody in the middle of typing it.
    const shelf = await this.page.locator(CHAT_PREVIEW).boundingBox();
    const pane = await this.page.locator(CHAT_TRANSCRIPT).boundingBox();
    const box = await this.page.locator(CHAT_INPUT).boundingBox();
    assert.ok(
      shelf !== null && pane !== null && box !== null,
      "the shelf, the conversation or the box is not drawn",
    );
    assert.ok(
      shelf.y + shelf.height <= pane.y + 1,
      `the shelf ends at ${shelf.y + shelf.height} and the conversation starts at ` +
        `${pane.y} — a shelf drawn over the transcript hides the one row a ` +
        "subagent's question is allowed to be",
    );
    assert.ok(
      shelf.y + shelf.height <= box.y,
      "the shelf reaches the composer; the reply is never what a preview costs",
    );
    assert.ok(
      pane.height > 0,
      "the conversation has been squeezed to nothing by the shelf above it",
    );
  },
);

Then(
  "the strip lists {int} agents still out",
  async function (this: OlaiWorld, many: number) {
    const agents = this.page.locator(`${CHAT_WATCHING_TASK}[data-kind="agent"]`);
    await this.waitUntil(
      async () => (await agents.count()) === many,
      `${many} agents to be listed on the strip`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then("the strip lists no agent still out", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${CHAT_WATCHING_TASK}[data-kind="agent"]`).count()) === 0,
    "the strip to stop listing any agent",
    HYDRATION_TIMEOUT,
  );
});
