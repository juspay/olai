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
 * door alike (`@olai/web`'s `agents/`), so one scenario names one thing twice
 * and never a title that two faces might spell differently.
 *
 * The STANDING is read off `data-standing` rather than off the words, on this
 * suite's standing rule: which colour or which phrase says *asleep* is a
 * decision about pixels, and a scenario that pinned one would go red the next
 * time somebody improved it (HACKING.md). The WORDS are asserted only where the
 * claim is about the words — the door's memory count, and its one line of the
 * agent's latest message, both of which are the feature rather than its paint.
 */

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

import { selector, TESTID } from "@olai/web/testlib";

import { attr } from "../support/selectors.ts";
import { answering } from "../support/shortlist.ts";
import { POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const ROSTER = selector(TESTID.agentRoster);
const ROW = selector(TESTID.agentRow);
const DOOR = selector(TESTID.agentDoor);
const SAID = selector(TESTID.agentSaid);
const CHAT_SESSION_LIST = selector(TESTID.chatSessionList);

/** One roster row, by the node it is about. */
const rowFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${ROSTER} ${ROW}${attr("data-agent", node)}`);

/** ... and one door, by the same id — which is the point of them sharing it. */
const doorFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${DOOR}${attr("data-agent", node)}`);

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
    assert.strictEqual(await row.getAttribute("data-standing"), standing);
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
  await this.press(rowFor(this, node));
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
 * (`@olai/chat`'s `teaching.ts`) — and "how many times was this session told
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

const UNASSIGNED = selector(TESTID.agentUnassigned);
const UNASSIGNED_COUNT = selector(TESTID.agentUnassignedCount);
const LIST = selector(TESTID.unassignedPanel);
const CHAT = selector(TESTID.unassignedChat);
const ASSIGN = selector(TESTID.unassignedAssign);
const DONE = selector(TESTID.unassignedDone);
const ASSIGN_SEARCH = selector(TESTID.assignSearch);
const ASSIGN_HIT = selector(TESTID.assignHit);
const ASSIGN_REFUSED = selector(TESTID.assignRefused);
const PAST = selector(TESTID.chatPastSessions);
const PAST_SESSION = selector(TESTID.chatPastSession);
const FRESH = selector(TESTID.chatFreshSession);

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

// ── the node agent's own sessions, in the panel's picker ───────────────

Then(
  "the panel says this agent has had {int} past session(s)",
  async function (this: OlaiWorld, many: number) {
    const line = this.page.locator(PAST);
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await line.getAttribute("data-count"), String(many));
  },
);

Then("the past sessions hold {string}", async function (this: OlaiWorld, title: string) {
  await this.page
    .locator(PAST_SESSION, { hasText: title })
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** WHAT THE FRESH SESSION SAYS, asserted as words: the label is the whole
 *  reason the gesture is safe to press, so it is the feature rather than its
 *  paint. */
Then(
  "the panel offers a fresh session, saying {string}",
  async function (this: OlaiWorld, words: string) {
    const fresh = this.page.locator(FRESH);
    await fresh.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await fresh.innerText()).replaceAll("\n", " ").includes(words),
      `the fresh session to say ${JSON.stringify(words)}, and it says ` +
        JSON.stringify((await fresh.innerText()).replaceAll("\n", " ")),
    );
  },
);

Then("the panel offers no fresh session", async function (this: OlaiWorld) {
  // The picker is open and has answered — the step before this one opened it —
  // so an absent affordance is the claim rather than a race with the list.
  await this.page.locator(CHAT_SESSION_LIST).waitFor({
    state: "visible",
    timeout: POLL_TIMEOUT,
  });
  assert.strictEqual(await this.page.locator(FRESH).count(), 0);
});
