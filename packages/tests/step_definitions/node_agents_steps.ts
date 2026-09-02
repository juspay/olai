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
import { POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const ROSTER = selector(TESTID.agentRoster);
const ROW = selector(TESTID.agentRow);
const DOOR = selector(TESTID.agentDoor);
const SAID = selector(TESTID.agentSaid);

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

// ── the contract that rides on a binding ───────────────────────────────

/** THE CONTRACT'S OPENING WORDS, which are unique to it and to the panel: no
 *  other sentence in this app names a node agent, and a person typing them
 *  would be typing the thing under test. */
const OPENS = "This conversation is the node agent for";

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
  return Math.floor((said.split(OPENS).length - 1) / 2);
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
