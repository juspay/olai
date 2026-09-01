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
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Given, Then, When } from "@cucumber/cucumber";

import { canonical, fileFor } from "@olai/state";
import { selector, TESTID } from "@olai/web/testlib";

import { attr } from "../support/selectors.ts";
import { scratchState } from "../support/hooks.ts";
import { stateHomeIn } from "../support/workers.ts";
import { CHAT_ENTRY, CHAT_TRANSCRIPT, POLL_TIMEOUT } from "../support/world.ts";
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

// ── the binding, and the contract that rides on it ─────────────────────

/**
 * WHERE OLAI KEEPS THIS MACHINE'S BINDINGS, asked of the package that decides
 * it (`@olai/state`) rather than spelled here.
 *
 * The path is a digest of the served directory's realpath under a per-kind
 * subdirectory, and a second spelling of that rule is the silent drift this
 * suite's dependency note is about: a copy would go on writing a file nothing
 * reads, and the scenario would fail thirty seconds later as a timeout with
 * nothing to say about why. WHERE that home is, is the harness's own two joins
 * and they are asked too (`support/hooks.ts`'s `scratchState`, beside the copy
 * rather than inside it, and `support/workers.ts`'s `stateHomeIn`) — a copy of
 * either was exactly this step failing silently the first time it ran.
 */
const bindingsAt = (world: OlaiWorld): string => {
  const home = stateHomeIn(scratchState(world.scratch()));
  const was = process.env["XDG_STATE_HOME"];
  // `fileFor` reads the variable at CALL time, which is the seam that lets a
  // step ask it about a serve other than this process — set for the one call,
  // and put back, because this process has an XDG state of its own.
  process.env["XDG_STATE_HOME"] = home;
  try {
    return fileFor("agents", canonical(world.scratch()));
  } finally {
    if (was === undefined) delete process.env["XDG_STATE_HOME"];
    else process.env["XDG_STATE_HOME"] = was;
  }
};

/**
 * BIND A NODE TO THE CONVERSATION THE PANEL IS IN — by hand, which is the only
 * way one is bound in this phase and therefore the way a person's directory
 * reaches this code at all.
 *
 * The session id is the scripted agent's own, which it answers with on every
 * `session/new` (`agent/fake-acp-agent.ts`). Named here rather than read off
 * the panel because it is the fixture's contract with this suite, the way
 * `fake-stored-old` already is.
 *
 * IT IS WRITTEN BEFORE A RESTART, always: the record is read once, at boot
 * (`@olai/chat`'s `agents.ts`), so a binding hand-edited under a running serve
 * takes effect at the next start — which is a fact about this phase that
 * docs/chat.md says out loud, and this step is where the suite depends on it.
 */
Given(
  "the node {string} is bound to this directory's conversation",
  function (this: OlaiWorld, node: string) {
    const at = bindingsAt(this);
    mkdirSync(path.dirname(at), { recursive: true, mode: 0o700 });
    writeFileSync(
      at,
      `${
        JSON.stringify({
          cwd: canonical(this.scratch()),
          bound: [{ node, agent: "claude", session: "fake-session-1" }],
        })
      }\n`,
    );
  },
);

/** Every notice in which olai has told an agent what it is — counted over the
 *  NOTICE's own words rather than over the transcript's text, since a person
 *  could type them. */
const contracts = (world: OlaiWorld) =>
  world.page
    .locator(CHAT_ENTRY)
    .filter({ hasText: "This conversation is the node agent for" });

Then(
  "the agent was told its contract {int} time(s)",
  async function (this: OlaiWorld, times: number) {
    await this.waitUntil(
      async () => (await contracts(this).count()) === times,
      `the conversation to carry the contract ${times} time(s), and it carries ` +
        `${await contracts(this).count()} — the transcript reads ` +
        `${JSON.stringify(await this.page.locator(CHAT_TRANSCRIPT).innerText())}`,
    );
  },
);

/** ... and what it SAYS, which is the half that matters: the node it names and
 *  the law that node's subtree is the memory. */
Then(
  "the contract names {string} and its subtree",
  async function (this: OlaiWorld, title: string) {
    const said = await contracts(this).first().innerText();
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
