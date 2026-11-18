/**
 * NODE AGENTS: the roster in the column, and the door on the row.
 *
 * The steps come in two kinds, and the split is the feature's whole point. Some
 * ask what the SIDEBAR draws — which node agents, how each one stands — and
 * some ask what an outline ROW wears, because the roster and the door are two
 * faces of one answer and a scenario has to be able to catch them disagreeing.
 *
 * Everything is addressed by the NODE'S OWN ID, on both faces, which is what
 * makes that possible: `data-agent` is the node id on the roster row and on the
 * door alike (`olai-plugin-chat`'s `browser/agents/`), so one scenario names one thing twice
 * and never a title that two faces might spell differently.
 *
 * The STANDING is read off `data-standing` rather than off the words, on this
 * suite's standing rule: which colour or which phrase says *asleep* is a
 * decision about pixels, and a scenario that pinned one would go red the next
 * time somebody improved it — tests assert behaviour, not styling. The WORDS are asserted only where the
 * claim is about the words — the door's memory count, and its one line of the
 * agent's latest message, both of which are the feature rather than its paint.
 */

import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionStore } from "@olai/tests/agent/session-store.ts";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib";
// ...and the ids themselves from the PLUGIN that draws them. The roster, the
// door and the panel are `olai-plugin-chat`'s faces since chat became a
// plugin, so their names are its `./testids` door, merged for this suite by the
// registry — the same route the padi pill's ids take (`support/world.ts`
// argues it where the import sits).
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";

import { attr } from "@olai/tests/harness/selectors.ts";
import { REMINDER } from "../../src/teaching.ts";

import { oneLine, POLL_TIMEOUT, PROP_EDIT, PROP_EDIT_KEY, ZOOM_TITLE } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { FAST_NODE_IDLE_MS } from "@olai/tests/harness/node_idle.ts";
import { returnToOutline, openAgentRowInOutline } from "./node_agent_folds_steps.ts";

const ROSTER = selector(PLUGIN_TESTID.agentRoster);
const ROW = selector(PLUGIN_TESTID.agentRow);
const DOOR = selector(PLUGIN_TESTID.agentDoor);
const SAID = selector(PLUGIN_TESTID.agentSaid);
const REFUSED = selector(PLUGIN_TESTID.agentRefused);
const CHAT_SESSIONS = selector(PLUGIN_TESTID.chatSessions);
const CHAT_INPUT = selector(PLUGIN_TESTID.chatInput);

/** One roster row, by the node it is about. */
const rowFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${ROSTER} ${ROW}${attr("data-agent", world.nodeId(node))}`);

/** ... and one door, by the same id — which is the point of them sharing it. */
const doorFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${DOOR}${attr("data-agent", world.nodeId(node))}`);

Then(
  "the agents roster lists {string}",
  async function (this: OlaiWorld, node: string) {
    await this.showSidebar();
    await rowFor(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** ... and the same claim for a node that is NOT in the roster — the plain
 *  half of the release: a node whose binding is off is not offered as an
 *  agent any more. Waited for, because the row leaves on a revision. */
Then(
  "the agents roster has no row for {string}",
  async function (this: OlaiWorld, node: string) {
    await this.showSidebar();
    await rowFor(this, node).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  },
);

Then("the agents roster is not drawn", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(ROSTER).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

/** How many node agents the column lists — the half presence cannot answer, and
 *  the one that catches a roster drawing rows the query never asked for. */
Then(
  "the agents roster holds {int} agents",
  async function (this: OlaiWorld, many: number) {
    await this.showSidebar();
    await this.waitUntil(
      async () => (await this.page.locator(`${ROSTER} ${ROW}`).count()) === many,
      `the roster to hold ${many} agents, and it holds ${await this.page
        .locator(`${ROSTER} ${ROW}`)
        .count()}`,
    );
  },
);

Then(
  "the agent {string} stands {string}",
  async function (this: OlaiWorld, node: string, standing: string) {
    await this.showSidebar();
    const row = rowFor(this, node);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await row.getAttribute("data-standing")) === standing,
      `the agent ${node} to stand ${standing}, and it stands ${await row.getAttribute("data-standing")}`,
    );
  },
);

Then(
  "the agent {string} is named {string}",
  async function (this: OlaiWorld, node: string, name: string) {
    await this.showSidebar();
    const row = rowFor(this, node);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.match((await row.innerText()).replaceAll("\n", " "), new RegExp(name));
  },
);

// ── and the same agent, on its own row in the outline ──────────────────

Then(
  "the door on {string} stands {string}",
  async function (this: OlaiWorld, node: string, standing: string) {
    const door = doorFor(this, node);
    await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await door.getAttribute("data-standing"), standing);
  },
);

/** What the door SAYS — asserted as words, deliberately, where the words are
 *  the claim: how big the agent's memory is, and whether it has a session. */
Then(
  "the door on {string} reads {string}",
  async function (this: OlaiWorld, node: string, words: string) {
    const door = doorFor(this, node);
    await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await door.innerText()).replaceAll("\n", " ").includes(words),
      `the door on ${node} to read ${JSON.stringify(words)}, and it reads ${
        JSON.stringify((await door.innerText()).replaceAll("\n", " "))
      }`,
    );
  },
);

/** The same reading, negated — and WAITED for rather than read once, because
 *  what it is about is words a door STOPPED saying: a press writes a file, the
 *  file arrives on the collection, and the door redraws a frame later. Read
 *  once, this would pass on the frame before the write landed. */
Then(
  "the door on {string} does not read {string}",
  async function (this: OlaiWorld, node: string, words: string) {
    const door = doorFor(this, node);
    await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => !(await door.innerText()).replaceAll("\n", " ").includes(words),
      `the door on ${node} to stop reading ${JSON.stringify(words)}`,
    );
  },
);

Then("there is no door on {string}", async function (this: OlaiWorld, node: string) {
  assert.strictEqual(await doorFor(this, node).count(), 0);
});

/**
 * WHAT OLAI HEARD, on the door — waited for rather than read once, and that is
 * the assertion rather than politeness: the line is written at the turn
 * boundary, forked off it, and the roster is re-assembled on the FRAME that
 * write publishes. A door that only filled in when something else moved the
 * panel is exactly the defect this step is here to catch.
 */
Then(
  "the door on {string} last said {string}",
  async function (this: OlaiWorld, node: string, words: string) {
    const said = doorFor(this, node).locator(SAID);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await said.innerText()).includes(words),
      `the door on ${node} to say it last heard ${JSON.stringify(words)}`,
    );
  },
);

/** An agent olai has not heard yet draws no line at all, which is different
 *  from drawing an empty one. */
Then(
  "the door on {string} has no last message",
  async function (this: OlaiWorld, node: string) {
    await doorFor(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await doorFor(this, node).locator(SAID).count(), 0);
  },
);

When("I press the agent {string}", async function (this: OlaiWorld, node: string) {
  await this.showSidebar();
  this.activeAgent = node;
  await this.press(rowFor(this, node));
});
When("I press the agent {string} in its outline", async function (this: OlaiWorld, node: string) {
  this.activeAgent = node;
  await openAgentRowInOutline(this, node);
});

// ── what nobody has read, on the Chats row ─────────────────────────────

/**
 * THE MARK ON A CHATS ROW, read off `data-unread` rather than off the weight of
 * the type or the mark's paint — the same rule the standing is read on: which
 * colour says *unread* is a decision about pixels.
 *
 * And WAITED FOR in both directions, which here is more than politeness: the
 * fact is written by the server at a tab's request, so a row that is unread
 * becomes read a round trip later, and a row that is read is never read once —
 * an assertion about the frame before the write landed would be an assertion
 * about nothing. Neither direction is a "wait for it to change": an unread row
 * stays unread until somebody looks, so a run that never acknowledges it fails
 * by TIMEOUT rather than by luck.
 */
Then(
  "the Chats row {string} is unread",
  async function (this: OlaiWorld, node: string) {
    await this.showSidebar();
    const row = rowFor(this, node);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await row.getAttribute("data-unread")) === "true",
      `the Chats row for ${node} to be marked unread`,
    );
  },
);

Then(
  "the Chats row {string} is not unread",
  async function (this: OlaiWorld, node: string) {
    await this.showSidebar();
    const row = rowFor(this, node);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await row.getAttribute("data-unread")) === null,
      `the Chats row for ${node} to stop being marked unread`,
    );
  },
);

/** ...AND THE ROW NAMES IT OUT LOUD, which is the half a person who cannot see
 *  the weight of the type is owed. There is no unread DOT — the only dot a
 *  Chats row wears is the standing one — so the word in its text is the whole
 *  of this mark. */
Then(
  "the Chats row {string} says it is unread",
  async function (this: OlaiWorld, node: string) {
    await this.showSidebar();
    const row = rowFor(this, node);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await row.innerText()).includes("Unread"),
      `the Chats row for ${node} to say it is unread, and it reads ` +
        `${JSON.stringify((await row.innerText()).replaceAll("\n", " "))}`,
    );
  },
);

/** ...AND A SLEEPING ROW WEARS NO DOT: the Chats dot says one thing only —
 *  this agent is AWAKE, holding one of the eight seats — so an asleep,
 *  unbound or stopped row draws nothing, and the unread mark remains the
 *  title's weight and the word in its text rather than a second mark.
 *  Counted by the role a dot answers to (`role="img"`; the engine's own glyph
 *  is `aria-hidden`), which is what a scenario can count that a reader can
 *  see. */
Then("the Chats row {string} wears no dot", async function (this: OlaiWorld, node: string) {
  await this.showSidebar();
  const row = rowFor(this, node);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => await row.getByRole("img").count() === 0,
    `the Chats row for ${node} to draw no standing mark`,
  );
});

/** ...AND AN AWAKE ONE WEARS ITS OWN. Named rather than coloured: the dot
 *  carries the standing's label for a reader who cannot see it
 *  (`roster.ts`'s `LOOK`), which is also the one thing a scenario can assert
 *  without asserting about a class name. */
Then(
  "the Chats row {string} wears the {string} dot",
  async function (this: OlaiWorld, node: string, label: string) {
    await this.showSidebar();
    const row = rowFor(this, node);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => await row.getByRole("img", { name: label, exact: true }).count() === 1,
      `the Chats row for ${node} to wear the ${label} dot`,
    );
  },
);

/** ... and the one claim that gesture may only make by NOT drawing: a press
 *  that could not do something says so on the roster's own refused line
 *  (`PLUGIN_TESTID.agentRefused`), so an unbound row — pressed the way it is
 *  SUPPOSED to be pressed — leaves exactly nothing there. Read after the
 *  press's other halves have settled: a refusal worth reading about would
 *  have arrived before the route moved. */
Then("the agents roster says nothing", async function (this: OlaiWorld) {
  await this.showSidebar();
  assert.strictEqual(await this.page.locator(REFUSED).count(), 0);
});

/** ... and the other face of the same press: the DOOR under the agent's own
 *  outline row, which switches the panel and navigates nowhere. Reached from
 *  the outline rather than from the column, which is what a reader standing on
 *  the node does — and the one that stays in reach on a board whose roster is
 *  longer than the column. */
When("I press the door on {string}", async function (this: OlaiWorld, node: string) {
  await this.press(doorFor(this, node));
});

// ── the contract that rides on a binding ───────────────────────────────

/**
 * THE CONTRACT'S OPENING WORDS, which are unique to it and to the panel: no
 * other sentence in this app names a node agent, and a person typing them would
 * be typing the thing under test.
 */
const OPENS = ["This conversation is the node agent for"];

/** How many times olai has told this agent what it is.
 *
 *  COUNTED OVER THE PAGE'S TEXT rather than over notice rows, because the
 *  scripted agent SAYS THE PROMPT BACK (`@olai/tests/agent/scripted-acp.ts` echoes what
 *  it was given) — so the words appear twice per teaching, once as olai's
 *  notice and once inside the agent's echo of the message they rode under.
 *  Halving that is what makes the count mean teachings, and it is also the
 *  assertion that BOTH halves happened: the notice a person reads, and the
 *  lines the agent was actually handed. */
const taughtTimes = async (world: OlaiWorld): Promise<number> => {
  const said = await world.page.locator("body").innerText();
  const times = OPENS.reduce((sum, opens) => sum + said.split(opens).length - 1, 0);
  return Math.floor(times / 2);
};

Then(
  "the agent was told its contract {int} time(s)",
  async function (this: OlaiWorld, times: number) {
    await this.waitUntil(
      async () => (await taughtTimes(this)) === times,
      `the conversation to carry the contract ${times} time(s), and it carries ` +
        `${await taughtTimes(this)}`,
    );
  },
);

/** ... and what it SAYS, which is the half that matters: the node it names,
 *  that the node's note is its charter, that the subtree is a knowledge base
 *  written only when a durable fact changed, and the line every contract
 *  carries — the agent has no memory of its own here. */
Then(
  "the contract names {string} and its subtree",
  async function (this: OlaiWorld, title: string) {
    const said = await this.page.locator("body").innerText();
    for (const [words, claim] of [
      [title, `the contract to name ${JSON.stringify(title)}`],
      ["own note is your charter", "the contract to make the node's note the charter"],
      ["SUBTREE is your knowledge base", "the contract to say the subtree is the knowledge base"],
      ["write to it only when a durable fact changed", "the contract to say when to write"],
      ["One node per fact", "the contract to say what shape a write takes"],
      [
        "You have no memory of your own here: this subtree is the only memory.",
        "the contract to say the agent has no memory of its own",
      ],
    ] as const) {
      assert.ok(said.includes(words), `${claim}, and it says ${JSON.stringify(said)}`);
    }
  },
);

/** How many times olai reminded this agent, counted by `REMINDER` itself the
 *  way {@link taughtTimes} counts the contract: the scripted agent says the
 *  prompt back, so each reminder is on the page twice — olai's notice, and the
 *  agent's echo of the message it rode under. */
const remindedTimes = async (world: OlaiWorld): Promise<number> => {
  const said = await world.page.locator("body").innerText();
  return Math.floor((said.split(REMINDER).length - 1) / 2);
};

Then(
  "the agent was reminded of its writing rule {int} time(s)",
  async function (this: OlaiWorld, times: number) {
    await this.waitUntil(
      async () => (await remindedTimes(this)) === times,
      `the conversation to carry the reminder ${times} time(s), and it carries ` +
        `${await remindedTimes(this)}`,
    );
  },
);

// ── the node agent's own sessions, in the panel header's pill ─────────

const PAST = selector(PLUGIN_TESTID.chatPastSessions);
const PAST_SESSION = selector(PLUGIN_TESTID.chatPastSession);
const FRESH = selector(PLUGIN_TESTID.chatFreshSession);

Then(
  "the panel says this agent has had {int} past session(s)",
  async function (this: OlaiWorld, many: number) {
    const line = this.chat(PAST);
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await line.getAttribute("data-count"), String(many));
  },
);

Then("the past sessions hold {string}", async function (this: OlaiWorld, title: string) {
  await this
    .chat(PAST_SESSION, { hasText: title })
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** WHAT THE FRESH SESSION SAYS, asserted as words: the label is the whole
 *  reason the gesture is safe to press, so it is the feature rather than its
 *  paint. It is the BUTTON'S OWN NAME now rather than a `title` — the drawn
 *  words plus an sr-only run saying where the memory stays — so a reader who
 *  never hovers gets the same promise a pointer does. */
Then(
  "the panel offers a fresh session, saying {string}",
  async function (this: OlaiWorld, words: string) {
    const fresh = this.chat(FRESH).first();
    await fresh.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const says = (await fresh.innerText()).replace(/\s+/g, " ").trim();
    assert.ok(
      says.includes(words),
      `the fresh session to say ${JSON.stringify(words)}, and it says ${JSON.stringify(says)}`,
    );
    assert.equal(
      await fresh.getAttribute("title"),
      null,
      "the fresh session still wears a native tooltip beside this app's own",
    );
  },
);

/** PRESS THE AGENT LINE'S FRESH SESSION — the one gesture that re-points a
 *  node's property, through the confirmation that is the whole reason it is
 *  safe to press.
 *
 *  THE CONFIRM GROUP IS NAMED, and that is not decoration: the refusal body
 *  below the line now carries a *Start fresh chat* of its own — one press, no
 *  question, because a chat the engine has no record of cannot be moved to
 *  earlier chats. Two buttons with one name are on screen together whenever
 *  that body is drawn, so an unscoped `getByRole` would be ambiguous exactly
 *  where the trap scenarios live. */
const confirmFresh = async (world: OlaiWorld) => {
  await world.page.getByRole("group", { name: "Confirm fresh start", exact: true })
    .getByRole("button", { name: "Start fresh chat", exact: true }).click();
};

When("I start a fresh session", async function (this: OlaiWorld) {
  const fresh = this.chat(FRESH);
  await fresh.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await fresh.first().click();
  await confirmFresh(this);
});

/** PRESS THE FRESH SESSION AND NAME THE ENGINE — the multi-engine form of the
 *  same gesture: with several engines installed the pill opens the engine
 *  menu, and this step picks one from it by the name a person sees. Relies on
 *  the menu being a real Kobalte menu of `menuitem` rows, so it is the engine
 *  `{string}` is expected to appear as. */
When("I start a fresh session with {string}", async function (this: OlaiWorld, engine: string) {
  const fresh = this.chat(FRESH);
  await fresh.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await fresh.first().click();
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).click();
  await confirmFresh(this);
});

/** PRESS THE CLOSE sentinel in the agent line — the gesture that takes the
 *  node's tie off. Nothing re-files the conversation: it stays in the
 *  engine's own store, and the node becomes a PLAIN row again, so the release
 *  is read where a plain row shows it: the start pill replacing the fold. */
When("I press the close-agent control", async function (this: OlaiWorld) {
  const close = this.chat(selector(PLUGIN_TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await close.click();
  await startFor(this, "install").waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** WHAT THE CLOSE CONTROL SAYS IT WILL DO — its own name, which is the word
 *  on it plus the sentence only a reader and the tip get (`../../src/browser/
 *  agents/closing.ts`). VERBATIM, because the whole point of the sentence is
 *  the loss it names: the tie comes off, and nothing lists that conversation
 *  afterwards. */
Then("the close control says {string}", async function (this: OlaiWorld, words: string) {
  const close = this.chat(selector(PLUGIN_TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const says = (await close.innerText()).replace(/\s+/g, " ").trim();
  assert.strictEqual(says, words);
  assert.equal(await close.getAttribute("title"), null);
});

/** A conversation no node claims has no sessions control at all — the header
 *  offers its own history only where there IS one, and the way to every other
 *  stored conversation is the sidebar. Waited for rather than read once: the
 *  panel is drawn before `bound` has arrived, and the claim is about where it
 *  settles. */
Then("the panel offers no sessions of its own", async function (this: OlaiWorld) {
  await this.chat(CHAT_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => (await this.chat(CHAT_SESSIONS).count()) === 0,
    "the panel to offer no sessions control",
  );
});

/** WHAT THE PANEL REFUSED, where a person is looking — the panel's own
 *  talk-back at the foot of the transcript, which is where a verb's refusal has
 *  always landed (`chat/state.ts`'s `verb`). Its own step here because the
 *  claim is about a refusal reaching the reader at all: the door that raised it
 *  is a list that has already dismissed itself. */
Then(
  "the panel refuses, saying {string}",
  async function (this: OlaiWorld, words: string) {
    const line = this.chat(selector(PLUGIN_TESTID.chatRefused));
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await line.innerText()).replaceAll("\n", " ").includes(words),
      `the panel to refuse saying ${JSON.stringify(words)}, and it says ` +
        JSON.stringify((await line.innerText()).replaceAll("\n", " ")),
    );
  },
);

/** WHOSE CONVERSATION THE PANEL IS IN, off the header's own line
 *  (`PLUGIN_TESTID.chatNode`) — the node agent, by the title a person reads it
 *  under rather than by its id.
 *
 *  Its own step because of the one place it is asserted from: a REFUSED open,
 *  where the panel has no conversation at all and used to have no node either.
 *  The node is what draws that agent's session control, which is the only way
 *  out of a conversation the engine has lost — so "the header still names the
 *  agent" is the claim the way out stands on, and it is worth making before
 *  pressing anything. */
Then(
  "the panel header names the node agent {string}",
  async function (this: OlaiWorld, title: string) {
    assert.ok(this.activeAgent);
    const id = this.nodeId(this.activeAgent);
    const line = this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", id)}`);
    const pageHead = this.page.locator(`${selector(PLUGIN_TESTID.agentPageHead)}${attr("data-agent", id)}`);
    // The conversation's two page faces name their subject in one line each:
    // the node's own page heads with the node's title, and the chat's own page
    // heads with the name of the item the chat belongs to.
    const titled = this.page.locator(`${ZOOM_TITLE}, ${selector(PLUGIN_TESTID.chatPageTitle)}`).first();
    await this.waitUntil(
      async () => (await line.count()) > 0
        ? (await line.getAttribute("aria-label")) === title
        : await pageHead.isVisible() && oneLine(await titled.innerText()) === title,
      `the panel header to name the node agent ${JSON.stringify(title)}`,
    );
  },
);

When("I open the past session {string}", async function (this: OlaiWorld, title: string) {
  const row = this.chat(PAST_SESSION, { hasText: title }).first();
  const session = await row.getAttribute("data-session-id");
  assert.ok(session);
  await row.click();
  await this.waitUntil(async () =>
    await this.chat(selector(PLUGIN_TESTID.chatPanel)).getAttribute("data-session-id") === session,
    "the selected past conversation to open",
  );
});

Then("the past session {string} is selected", async function (this: OlaiWorld, title: string) {
  const row = this.chat(PAST_SESSION, { hasText: title }).first();
  await this.waitUntil(async () => await row.getAttribute("data-current") === "true", "the past conversation to be selected");
  assert.ok(await row.isDisabled());
});

When("I return to the node agent's current session", async function (this: OlaiWorld) {
  const button = this.chatRoot().getByRole("button", { name: "Back to current chat ↩", exact: true });
  const session = await button.getAttribute("data-session-id");
  assert.ok(session);
  await button.click();
  await this.waitUntil(async () => {
    const panel = this.chat(selector(PLUGIN_TESTID.chatPanel));
    return await panel.getAttribute("data-session-id") === session
      && await panel.getAttribute("data-status") === "idle";
  }, "the node's current conversation to be ready");
});

const notedSessions = new WeakMap<OlaiWorld, Map<string, string>>();
When("I remember this conversation as {string}", async function (this: OlaiWorld, name: string) {
  const panel = this.chat(selector(PLUGIN_TESTID.chatPanel));
  await this.waitUntil(async () => await panel.getAttribute("data-status") === "idle", "the conversation to be ready");
  const id = await panel.getAttribute("data-session-id");
  assert.ok(id);
  const sessions = notedSessions.get(this) ?? new Map<string, string>();
  sessions.set(name, id);
  notedSessions.set(this, sessions);
});

Then("the panel is in the remembered conversation {string}", async function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  await this.waitUntil(async () => {
    const panel = this.chat(selector(PLUGIN_TESTID.chatPanel));
    return await panel.getAttribute("data-session-id") === id
      && await panel.getAttribute("data-status") === "idle";
  }, `the panel to open ${name}`);
});

Then("the panel is ready in a new conversation after {string}", async function (this: OlaiWorld, name: string) {
  const previous = notedSessions.get(this)?.get(name);
  assert.ok(previous, `no conversation remembered as ${name}`);
  // Clicking fresh starts an asynchronous switch. Idle on its own can still
  // describe the old conversation; require the new identity before typing.
  await this.waitUntil(async () => {
    const panel = this.chat(selector(PLUGIN_TESTID.chatPanel));
    const current = await panel.getAttribute("data-session-id");
    return current !== null && current !== "" && current !== previous
      && await panel.getAttribute("data-status") === "idle";
  }, "the fresh conversation to replace the old one and become ready");
});

Then("the panel is in the working conversation {string}", async function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  await this.waitUntil(async () => {
    const panel = this.chat(selector(PLUGIN_TESTID.chatPanel));
    return await panel.getAttribute("data-session-id") === id
      && await panel.getAttribute("data-status") === "thinking";
  }, `the panel to show the running conversation ${name}`);
});

Then("the panel has a different conversation from {string}", async function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  await this.waitUntil(async () => {
    const panel = this.chat(selector(PLUGIN_TESTID.chatPanel));
    const current = await panel.getAttribute("data-session-id");
    return current !== null && current !== id && await panel.getAttribute("data-status") === "idle";
  }, `a fresh conversation replacing ${name}`);
});

When("I press the fresh-session button position again", async function (this: OlaiWorld) {
  const button = this.chat(FRESH).first();
  const box = await button.boundingBox();
  assert.ok(box, "the pending fresh-session button must remain visible");
  // A physical repeat press must land even if the control is now disabled.
  await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
});

Then("the fresh-session request is pending", async function (this: OlaiWorld) {
  const button = this.chat(FRESH).first();
  await this.waitUntil(() => button.isDisabled(), "the fresh-session button to block repeat submissions");
  assert.equal(await button.getAttribute("aria-busy"), "true");
});

Then("the fresh-session control refuses {string} and allows retry", async function (this: OlaiWorld, text: string) {
  const refusal = this.chat(selector(PLUGIN_TESTID.chatFreshSaid));
  await refusal.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => (await refusal.innerText()).includes(text), "the fresh-session refusal to explain the failed request");
  await this.waitUntil(async () => !(await this.chat(FRESH).first().isDisabled()), "the fresh-session button to allow retry");
});

Then("the node session control counts {int} conversations", async function (this: OlaiWorld, count: number) {
  const button = this.chat(CHAT_SESSIONS);
  await this.waitUntil(async () => await button.getAttribute("data-count") === String(count), "the node's session count to reflect its current history");
});

Then("the agent {string} remains {string} across two idle deadlines", async function (this: OlaiWorld, node: string, standing: string) {
  assert.ok(this.fastNodeIdle, "this observation requires @node-idle-fast");
  const row = this.page.locator(`${ROW}${attr("data-agent", this.nodeId(node))}`);
  const until = Date.now() + FAST_NODE_IDLE_MS * 2;
  do {
    assert.equal(await row.getAttribute("data-standing"), standing);
    await this.page.waitForTimeout(100);
  } while (Date.now() < until);
});

When("I fold node agent {string}", async function (this: OlaiWorld, node: string) {
  await returnToOutline(this, node);
  const standing = this.page.locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", this.nodeId(node))}`);
  await this.press(standing);
  await this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", this.nodeId(node))}`).waitFor({ state: "hidden" });
});

const asideFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", world.nodeId(node))}`);
const startFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${selector(PLUGIN_TESTID.agentStart)}${attr("data-agent", world.nodeId(node))}`);
Then("the aside on {string} stands {string}", async function (this: OlaiWorld, node: string, standing: string) {
  await this.waitUntil(async () => await asideFor(this, node).getAttribute("data-standing") === standing, "the aside standing to arrive");
});
Then("the aside on {string} reads {string}", async function (this: OlaiWorld, node: string, words: string) {
  assert.ok((await asideFor(this, node).innerText()).includes(words));
});
Then("the standing on {string} cannot be pressed", async function (this: OlaiWorld, node: string) {
  assert.ok(await asideFor(this, node).isDisabled());
});
When("I hover the agent start pill on {string}", async function (this: OlaiWorld, node: string) {
  await startFor(this, node).hover({ force: true });
});
When("I press the agent start pill on {string}", async function (this: OlaiWorld, node: string) {
  this.activeAgent = node;
  await this.press(startFor(this, node));
});
/** The same offer, taken with a thumb: no hover before it and no `force` on
 *  it, because a screen with no hover draws the pill rather than fading it in
 *  (`@olai/ui-primitives`'s `SHOWN_WITHOUT_HOVER`). */
When("I tap the agent start pill on {string}", async function (this: OlaiWorld, node: string) {
  this.activeAgent = node;
  await this.press(startFor(this, node), "tap");
});
Then("the agent start pill on {string} is visible", async function (this: OlaiWorld, node: string) {
  await startFor(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await startFor(this, node).evaluate(el => getComputedStyle(el).opacity), "1");
});
Then("the agent start pill on {string} is absent", async function (this: OlaiWorld, node: string) {
  await startFor(this, node).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});
Then("node agent {string} is unfolded", async function (this: OlaiWorld, node: string) {
  await this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", this.nodeId(node))}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the agent engine menu offers {string}", async function (this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I type the binding for remembered conversation {string} into the property editor", async function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  const editor = this.page.locator(PROP_EDIT);
  await editor.fill(`claude:${id}`);
  await editor.press("Enter");
});

/** NAMING A CONVERSATION ON A ROW BY HAND, in the boxes the `+` at the end of
 *  a property run opens: the key, then the engine and the conversation this
 *  scenario watched being made. The recovery a person has after closing an
 *  agent — nothing files a freed conversation anywhere, and the engine still
 *  has it, so writing the tie again is the whole of going back to it. */
When("I name the chat tie of remembered conversation {string} on {string}", async function (this: OlaiWorld, name: string, node: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  const key = this.node(node).locator(PROP_EDIT_KEY).first();
  await key.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await key.fill("chat-agent-session");
  const editor = this.node(node).locator(PROP_EDIT).first();
  await editor.fill(`claude:${id}`);
  await editor.press("Enter");
});

Then("all bound node agents are asleep", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.waitUntil(async () => {
    const standings = await this.page.locator(`${ROSTER} ${ROW}`).evaluateAll(rows =>
      rows.map(row => row.getAttribute("data-standing")).filter(value => value !== "unbound"));
    return standings.length > 0 && standings.every(value => value === "asleep");
  }, "every bound node agent to remain asleep before a conversation is opened");
});

/**
 * A NODE TIED TO A CONVERSATION THE ENGINE ALREADY HAS — the one way into a
 * stored conversation, and the seeding step every scenario about one uses.
 *
 * Nothing files an engine's stored conversations any more: a conversation is
 * reachable because an ITEM names it, so the fixture names it the way a person
 * (or a `git pull`) would — `chat-agent-session: <engine>:<session>` on the
 * row, written into the served outline before the chat is opened. The press
 * that follows is an ordinary one: the roster row, or the node's own fold.
 *
 * WHICH SESSION a title means is the fake agent's own constant, and the four
 * fakes are named here rather than in each scenario: a feature says the words
 * a person reads in the picker, and nothing in it spells an id.
 */
const STORED_SESSIONS: Record<string, Record<string, string>> = {
  // `@olai/tests/agent/scripted-acp.ts`, which both claude and codex run.
  claude: { "the last conversation": "fake-stored-new", "an older conversation": "fake-stored-old" },
  codex: { "the last conversation": "fake-stored-new", "an older conversation": "fake-stored-old" },
  opencode: { "an opencode conversation": "ses_opencode_stored" },
  omp: { "an Oh My Pi conversation": "ses_omp_stored" },
  pi: { "a pi conversation": "pi_stored_session" },
};

Given(
  "node {string} in {string} is tied to the stored {string} conversation {string}",
  function (this: OlaiWorld, node: string, file: string, engine: string, title: string) {
    const session = STORED_SESSIONS[engine]?.[title];
    assert.ok(session, `no stored ${engine} conversation called ${JSON.stringify(title)}`);
    const id = this.nodeId(node);
    const rows = this.servedNodes(file);
    assert.ok(rows.some((row) => row.id === id), `no node "${node}" in ${file}`);
    this.writeServed(
      file,
      rows
        .map((row) =>
          JSON.stringify(
            row.id === id
              ? {
                ...row,
                custom: {
                  ...(row.custom as Record<string, unknown> | undefined),
                  "chat-agent-session": `${engine}:${session}`,
                },
              }
              : row,
          )
        )
        .join("\n"),
    );
  },
);

Then("the node {string} keeps the session {string} in file {string}", async function (this: OlaiWorld, name: string, session: string, file: string) {
  await this.waitUntil(async () => {
    const node = this.servedNodesSoFar(file).find(node => node.id === this.nodeId(name));
    return node !== undefined && Object.values(node.custom as Record<string, unknown>).includes(session);
  }, `${name} to keep ${session} in ${file}`);
});

/** The face the migration had — the sidebar's *Unassigned* row and the panel it
 *  opened — is gone from the app, so this is read as a name a person would
 *  see rather than through a test id nothing draws any more. */
Then("the Unassigned row and list are absent", async function (this: OlaiWorld) {
  await this.showSidebar();
  assert.equal(await this.page.getByRole("button", { name: /^Unassigned/ }).count(), 0);
});

When("a terminal stores a conversation titled {string}", function (this: OlaiWorld, title: string) {
  const store = sessionStore(this.scratch());
  assert.ok(store.enabled, "the scenario must enable distinct disk sessions");
  store.prompt(store.newId(), title);
});

Then("node {string} still binds remembered conversation {string} in {string}", async function(this: OlaiWorld, node: string, name: string, file: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  await this.waitUntil(async () => {
    const row = this.servedNodesSoFar(file).find(row => row.id === this.nodeId(node));
    return row !== undefined && Object.values(row.custom as Record<string, unknown>).some(value => typeof value === "string" && value.endsWith(`:${id}`));
  }, `${node}'s binding to remain on ${name}`);
});

/**
 * THE ENGINE LOSES A CHAT IT STILL NAMES — the second machine, reachable.
 *
 * A dot-file per session id in the served directory, read at the moment of the
 * `session/load` (`@olai/tests/agent/scripted-acp.ts`'s `missingHere`), so the
 * conversation stays in `session/list` — a row in past sessions a person can
 * press — and only the transcript behind it is unreadable. The agent answers
 * ACP's `-32002` for it, which is the one code the panel's *this chat isn't on
 * this machine* face is drawn out of.
 */
When("the engine has no record of the chat remembered as {string}", function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  writeFileSync(join(this.scratch(), `.agent-missing-${id}`), "");
});

/** ...AND FINDS IT AGAIN, which is what *Try again* exists for: a history
 *  volume that was not mounted a second ago answers the same `-32002` and then
 *  opens the chat on the very next press. */
When("the engine finds the chat remembered as {string} again", function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  rmSync(join(this.scratch(), `.agent-missing-${id}`), { force: true });
});

/** THE PROPERTY MOVED, asserted as a change rather than as a value: a fresh
 *  start mints an id nobody can write down in advance, and what the trap's way
 *  out owes is that the node no longer names the chat that could not be
 *  opened. Both halves — it names SOMETHING on the same engine, and it is not
 *  that one — because an `agent-session` that had merely been emptied would
 *  pass the second alone. */
Then(
  "the vault node {string} has property {string} naming a chat other than {string}",
  async function (this: OlaiWorld, name: string, key: string, was: string) {
    const file = await this.node(name).getAttribute("data-file");
    assert.ok(file);
    const engine = `${was.split(":")[0]}:`;
    await this.waitUntil(async () => {
      const node = this.servedNodes(file).find(row => row.id === this.nodeId(name));
      const value = (node?.custom as Record<string, unknown> | undefined)?.[key];
      return typeof value === "string" && value.startsWith(engine) && value !== was;
    }, `the stored property ${key} on ${name} to name a chat other than ${was}`);
  },
);

When("I begin opening the past session {string}", async function(this: OlaiWorld, title: string) {
  await this.chat(PAST_SESSION, { hasText: title }).click();
});

When("I request a fresh session without confirming", async function (this: OlaiWorld) {
  await this.chat(FRESH).first().click();
  await this.page.getByRole("group", { name: "Confirm fresh start", exact: true }).waitFor({ state: "visible" });
});

/** What the confirmation says will happen — the sentence that makes the
 *  gesture safe to press, read where it is asked. */
Then("the fresh-session confirmation says {string}", async function (this: OlaiWorld, words: string) {
  const asking = this.page.getByRole("group", { name: "Confirm fresh start", exact: true });
  await asking.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => oneLine(await asking.innerText()).includes(words),
    `the fresh-session confirmation to say ${JSON.stringify(words)}`);
});

When("I cancel the fresh session", async function (this: OlaiWorld) {
  await this.page.getByRole("group", { name: "Confirm fresh start", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
});

When("I confirm the fresh session", async function (this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Start fresh chat", exact: true }).click();
});

Then("the fresh-session confirmation is absent", async function (this: OlaiWorld) {
  await this.page.getByRole("group", { name: "Confirm fresh start", exact: true }).waitFor({ state: "hidden" });
});

When("I request a fresh session with {string} without confirming", async function (this: OlaiWorld, engine: string) {
  await this.chat(FRESH).first().click();
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).click();
  await this.page.getByRole("group", { name: "Confirm fresh start", exact: true }).waitFor({ state: "visible" });
});

When("I open the fresh-session engine menu", async function (this: OlaiWorld) {
  await this.chat(FRESH).first().click();
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).waitFor({ state: "visible" });
});
