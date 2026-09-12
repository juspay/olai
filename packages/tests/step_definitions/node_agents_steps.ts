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
import { sessionStore } from "../agent/session-store.ts";
import { Then, When } from "@cucumber/cucumber";

import { selector } from "@olai/web/testlib";
// ...and the ids themselves from the PLUGIN that draws them. The roster, the
// door and the panel are `olai-plugin-chat`'s faces since chat became a
// plugin, so their names are its `./testids` door, merged for this suite by the
// registry — the same route the padi pill's ids take (`support/world.ts`
// argues it where the import sits).
import { PLUGIN_TESTID } from "@olai/bundle/testids";

import { attr } from "../support/selectors.ts";
import { answering } from "../support/shortlist.ts";

import { POLL_TIMEOUT, PROP_EDIT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { FAST_NODE_IDLE_MS } from "../support/node_idle.ts";

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
 *
 * TWO OF THEM since migration, because there are two contracts — one for a
 * session olai OPENED for a node and one for a chat somebody ASSIGNED to it
 * (`olai-plugin-chat`'s `teaching.ts`) — and "how many times was this session told
 * what it is" is one question about both. WHICH of the two went out is asserted
 * by the steps under this one, where the words are the claim.
 */
const OPENS = [
  "This conversation is the node agent for",
  "This conversation has been ASSIGNED to the node agent",
];

/** How many times olai has told this agent what it is.
 *
 *  COUNTED OVER THE PAGE'S TEXT rather than over notice rows, because the
 *  scripted agent SAYS THE PROMPT BACK (`agent/fake-acp-agent.ts` echoes what
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

/** ... and what it SAYS, which is the half that matters: the node it names and
 *  the law that node's subtree is the memory. */
Then(
  "the contract names {string} and its subtree",
  async function (this: OlaiWorld, title: string) {
    const said = await this.page.locator("body").innerText();
    assert.ok(
      said.includes(title),
      `the contract to name ${JSON.stringify(title)}, and it says ${JSON.stringify(said)}`,
    );
    assert.ok(
      said.includes("SUBTREE is your memory") && said.includes("HISTORY"),
      `the contract to say the subtree is the memory and the transcript is history, ` +
        `and it says ${JSON.stringify(said)}`,
    );
  },
);

/** ... and WHICH contract it was, where the difference is the claim: a chat
 *  somebody assigned is told it was moved here, and told to bank what its
 *  transcript is the only copy of. */
Then(
  "the contract says the conversation was assigned",
  async function (this: OlaiWorld) {
    const said = await this.page.locator("body").innerText();
    assert.ok(
      said.includes("has been ASSIGNED to the node agent"),
      `the contract to say this conversation was assigned, and it says ${JSON.stringify(said)}`,
    );
  },
);

Then(
  "the contract orders it to bank what it knows into the subtree",
  async function (this: OlaiWorld) {
    const said = await this.page.locator("body").innerText();
    assert.ok(
      said.includes("NOW your memory") && said.includes("WRITE INTO IT"),
      `the contract to order the session to write what it knows into the subtree, ` +
        `and it says ${JSON.stringify(said)}`,
    );
    // ... and the standing law is still under it, in the same words the other
    // contract uses: the transcript is history.
    assert.ok(
      said.includes("HISTORY"),
      `the contract to say the transcript is history, and it says ${JSON.stringify(said)}`,
    );
  },
);

// ── migration: the chats that are nobody's yet ─────────────────────────
//
// The sidebar's last row, the list it opens in the panel, and the gesture that
// gives one conversation a node. Addressed the way everything else here is: a
// chat by the TITLE its agent stored it under, a node by its own id — so a
// scenario names the same thing the property does.

const UNASSIGNED = selector(PLUGIN_TESTID.agentUnassigned);
const UNASSIGNED_COUNT = selector(PLUGIN_TESTID.agentUnassignedCount);
const LIST = selector(PLUGIN_TESTID.unassignedPanel);
const CHAT = selector(PLUGIN_TESTID.unassignedChat);
const ASSIGN = selector(PLUGIN_TESTID.unassignedAssign);
const DONE = selector(PLUGIN_TESTID.unassignedDone);
const EMPTY = selector(PLUGIN_TESTID.unassignedEmpty);
const ASSIGN_SEARCH = selector(PLUGIN_TESTID.assignSearch);
const ASSIGN_HIT = selector(PLUGIN_TESTID.assignHit);
const ASSIGN_REFUSED = selector(PLUGIN_TESTID.assignRefused);
const PAST = selector(PLUGIN_TESTID.chatPastSessions);
const PAST_SESSION = selector(PLUGIN_TESTID.chatPastSession);
const FRESH = selector(PLUGIN_TESTID.chatFreshSession);

/** HOW MANY the row says, waited for rather than read once: the count is a
 *  difference between an answer from the agents and a cell that moves on every
 *  revision, so the frame a write lands on is the frame it changes. */
const offers = async (world: OlaiWorld, many: number): Promise<void> => {
  await world.showSidebar();
  if (many === 0) {
    await world.waitUntil(
      async () => (await world.page.locator(UNASSIGNED).count()) === 0,
      "the roster to offer no unassigned chats",
    );
    return;
  }
  const count = world.page.locator(`${UNASSIGNED} ${UNASSIGNED_COUNT}`);
  await count.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.waitUntil(
    async () => (await count.innerText()).trim() === String(many),
    `the roster to offer ${many} unassigned chats, and it offers ${await count.innerText()}`,
  );
};

Then(
  "the roster offers {int} unassigned chats",
  async function (this: OlaiWorld, many: number) {
    await offers(this, many);
  },
);

/** The same reading at zero, where the ROW ITSELF is gone — a count of nothing
 *  is nothing at all, which is the section's own rule read at its last row. */
Then("the roster offers no unassigned chats", async function (this: OlaiWorld) {
  await offers(this, 0);
});

When("I open the unassigned chats", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(UNASSIGNED));
  await this.page.locator(LIST).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** One listed conversation, by the title its agent stored it under. */
const chatFor = (world: OlaiWorld, title: string) =>
  world.page.locator(CHAT, { hasText: title }).first();

/** ... and the way back to the conversation the panel was in. The list stays
 *  up across an assignment on purpose — moving several chats is one job — so
 *  leaving it is a gesture of its own. */
When("I close the unassigned chats", async function (this: OlaiWorld) {
  await this.press(this.page.locator(DONE));
  await this.page.locator(LIST).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Then(
  "the unassigned list holds {string}",
  async function (this: OlaiWorld, title: string) {
    await chatFor(this, title).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** ... and the same negated, WAITED for: a row leaves this list on the frame
 *  the property lands, which is a revision after the press. */
Then(
  "the unassigned list does not hold {string}",
  async function (this: OlaiWorld, title: string) {
    await this.waitUntil(
      async () => (await this.page.locator(CHAT, { hasText: title }).count()) === 0,
      `${JSON.stringify(title)} to leave the unassigned list`,
    );
  },
);

/** The claim a list may only make when every agent actually answered: an
 *  unread disk drawn as *there is nothing here* is the honesty this view
 *  exists to keep. */
Then(
  "the list does not claim every conversation belongs to a node agent",
  async function (this: OlaiWorld) {
    assert.strictEqual(await this.page.locator(EMPTY).count(), 0);
  },
);

/** Open the search under one chat and ask it for a node — the shortlist's own
 *  ritual (`../support/shortlist.ts`), which every panel in this suite that
 *  searches waits for the same way. */
const looking = async (
  world: OlaiWorld,
  title: string,
  query: string,
): Promise<void> => {
  const row = chatFor(world, title);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if ((await row.locator(ASSIGN_SEARCH).count()) === 0) {
    await world.press(row.locator(ASSIGN));
  }
  await row.locator(ASSIGN_SEARCH).fill(query);
  await answering(world, LIST, ASSIGN_HIT, query);
};

When(
  "I look for a node to give {string} to, with {string}",
  async function (this: OlaiWorld, title: string, query: string) {
    await looking(this, title, query);
  },
);

/**
 * The whole gesture, as a person makes it: open the search under the chat, type
 * words, and take the row.
 *
 * THREE ARGUMENTS, and the third is not ceremony: the words are what somebody
 * TYPES and the node id is what the property will name, and the two are
 * deliberately not derived from each other. A step that searched for a node's
 * whole title would be typing a sentence nobody types — and, on this suite's
 * own fixture, one that the query grammar reads as an operator (`has`), which
 * is a refusal rather than a shortlist and would fail about the wrong thing.
 */
When(
  "I assign the conversation {string} to the node titled {string}, searching for {string}",
  async function (this: OlaiWorld, chat: string, node: string, words: string) {
    await looking(this, chat, words);
    // BY THE TITLE A READER SEES, which is how every other shortlist in this
    // suite takes a row: a hit's `data-id` is its printed ADDRESS rather than
    // the node's id (`client/search/row.ts`), so the id a scenario names its
    // nodes by is not on the row a person clicks.
    await this.page.locator(ASSIGN_HIT, { hasText: node }).first().click();
  },
);

/** Put the cursor on a hit without taking it — which is what makes a refusal a
 *  thing a scenario can read one row at a time, exactly as the move picker's
 *  own aim does. */
When(
  "I point the assign search at {string}",
  async function (this: OlaiWorld, title: string) {
    await this.page.locator(ASSIGN_HIT, { hasText: title }).first().hover();
  },
);

Then(
  "the assign search refuses it, saying {string}",
  async function (this: OlaiWorld, words: string) {
    const said = this.page.locator(ASSIGN_REFUSED);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await said.innerText()).includes(words),
      `the assign search to refuse the node saying ${JSON.stringify(words)}, and it says ` +
        JSON.stringify(await said.innerText()),
    );
  },
);

/** Press the row it just refused, which must send nothing — the answer is
 *  already on screen, and the assertion is what did NOT change after it. */
When("I take the node the assign search refused", async function (this: OlaiWorld) {
  await this.page.locator(ASSIGN_HIT, { hasText: /./ }).first().click();
});

// ── the node agent's own sessions, in the panel header's pill ─────────

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
 *  paint. */
Then(
  "the panel offers a fresh session, saying {string}",
  async function (this: OlaiWorld, words: string) {
    const fresh = this.chat(FRESH);
    await fresh.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await fresh.innerText()).replaceAll("\n", " ").includes(words),
      `the fresh session to say ${JSON.stringify(words)}, and it says ` +
        JSON.stringify((await fresh.innerText()).replaceAll("\n", " ")),
    );
  },
);

/** PRESS THE FRESH SESSION — the one gesture that re-points a node's property,
 *  wherever the panel is drawing it.
 *
 *  It has two homes and this step names neither: the session picker in the
 *  header, and the refusal body drawn when the engine would not open the
 *  conversation the node names. The second is the one the trap needs, and a step
 *  that spelled a location would have to be two steps for one act. */
When("I start a fresh session", async function (this: OlaiWorld) {
  const fresh = this.chat(FRESH);
  await fresh.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await fresh.first().click();
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

/** The list is not on screen — the other half of every door that opens a
 *  conversation: it says so to the list on its way through. */
Then("the unassigned list is not drawn", async function (this: OlaiWorld) {
  await this.page.locator(LIST).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
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
    const line = this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", this.nodeId(this.activeAgent))}`);
    await this.waitUntil(
      async () => (await line.getAttribute("aria-label")) === title,
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
  const button = this.chatRoot().getByRole("button", { name: "current session", exact: true });
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
  await this.waitUntil(async () => (await button.innerText()).trim() === `sessions (${count})`, "the node's session count to reflect its current history");
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

When("I give the conversation to the offered node titled {string}", async function (this: OlaiWorld, node: string) {
  await this.page.locator(ASSIGN_HIT, { hasText: node }).first().click();
});
Then("the unassigned list waits for the assignment to finish", async function (this: OlaiWorld) {
  await this.waitUntil(() => this.page.locator(DONE).isDisabled(), "the list to wait for the session handoff");
});

When("I fold node agent {string}", async function (this: OlaiWorld, node: string) {
  const standing = this.page.locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", this.nodeId(node))}`);
  await this.press(standing);
  await this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", this.nodeId(node))}`).waitFor({ state: "detached" });
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

Then("all bound node agents are asleep", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.waitUntil(async () => {
    const standings = await this.page.locator(`${ROSTER} ${ROW}`).evaluateAll(rows =>
      rows.map(row => row.getAttribute("data-standing")).filter(value => value !== "unbound"));
    return standings.length > 0 && standings.every(value => value === "asleep");
  }, "every bound node agent to remain asleep before a conversation is opened");
});

/** Filed ids are minted; bind a scenario name after finding the actual row. */
When("I open the filed conversation {string} as node {string}", async function (this: OlaiWorld, title: string, name: string) {
  await this.showSidebar();
  const row = this.page.locator(`${ROSTER} ${ROW}${attr("title", `${title} — claude:`, "^=")}`);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const id = await row.getAttribute("data-agent");
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
  await this.press(row);
});

Then("the Inbox has {int} filed conversations", async function (this: OlaiWorld, count: number) {
  await this.waitUntil(async () => {
    const records = this.servedNodesSoFar("_olai/Inbox.olai");
    return records.filter(node => node.parent === "chats").length === count;
  }, `the Inbox to hold ${count} filed conversations`);
  const records = this.servedNodes("_olai/Inbox.olai");
  assert.equal(records.filter(node => node.id === "chats").length, 1);
  assert.equal(records.find(node => node.id === "chats")?.parent, undefined);
  for (const node of records.filter(node => node.parent === "chats")) {
    const custom = node.custom as Record<string, unknown>;
    assert.ok(Object.values(custom).some(value => typeof value === "string" && value.includes(":")));
  }
});

Then("the node {string} keeps the session {string} in file {string}", async function (this: OlaiWorld, name: string, session: string, file: string) {
  await this.waitUntil(async () => {
    const node = this.servedNodesSoFar(file).find(node => node.id === this.nodeId(name));
    return node !== undefined && Object.values(node.custom as Record<string, unknown>).includes(session);
  }, `${name} to keep ${session} in ${file}`);
});

Then("the Unassigned row and list are absent", async function (this: OlaiWorld) {
  await this.showSidebar();
  assert.equal(await this.page.getByRole("button", { name: /^Unassigned/ }).count(), 0);
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.unassignedPanel)).count(), 0);
});

Then("the filer's boot run has settled", async function (this: OlaiWorld) {
  await this.waitUntil(async () => this.serverLog.text.includes("filer: full run complete"), "the filer's boot listing and writes to finish");
});

When("a terminal stores a conversation titled {string}", function (this: OlaiWorld, title: string) {
  const store = sessionStore(this.scratch());
  assert.ok(store.enabled, "the scenario must enable distinct disk sessions");
  store.prompt(store.newId(), title);
});

When("I open the filed {string} conversation {string} as node {string}", async function (this: OlaiWorld, engine: string, title: string, name: string) {
  await this.showSidebar();
  const row = this.page.locator(`${ROSTER} ${ROW}${attr("title", `${title} — ${engine}:`, "^=")}`);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const id = await row.getAttribute("data-agent");
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
  await this.press(row);
});

Then("the filed node {string} has a note containing {string}", async function (this: OlaiWorld, name: string, words: string) {
  const node = this.servedNodes("_olai/Inbox.olai").find(node => node.id === this.nodeId(name));
  assert.ok(typeof node?.desc === "string" && node.desc.includes(words));
});
Then("the filed node {string} has no message count in its note", async function (this: OlaiWorld, name: string) {
  const node = this.servedNodes("_olai/Inbox.olai").find(node => node.id === this.nodeId(name));
  assert.ok(node);
  assert.ok(!/\d+ messages?/.test(String(node.desc ?? "")));
});

When("I open the {string} conversation for delivery", async function (this: OlaiWorld, kind: string) {
  await this.showSidebar();
  const row = kind === "node-bound" ? rowFor(this, "door-live")
    : this.page.locator(`${ROSTER} ${ROW}${attr("title", "the last conversation — claude:", "^=")}`);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  this.activeAgent = await row.getAttribute("data-agent");
  await this.press(row);
});

Then("node {string} still binds remembered conversation {string} in {string}", async function(this: OlaiWorld, node: string, name: string, file: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  await this.waitUntil(async () => {
    const row = this.servedNodesSoFar(file).find(row => row.id === this.nodeId(node));
    return row !== undefined && Object.values(row.custom as Record<string, unknown>).some(value => typeof value === "string" && value.endsWith(`:${id}`));
  }, `${node}'s binding to remain on ${name}`);
});

When("I begin opening the past session {string}", async function(this: OlaiWorld, title: string) {
  await this.chat(PAST_SESSION, { hasText: title }).click();
});
