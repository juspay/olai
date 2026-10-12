/**
 * THE SLEEP PASS'S OWN STEPS — what a scenario watches when olai tidies a node
 * agent's memory for it.
 *
 * Three kinds of assertion, and they are the three a person could make:
 *
 *   - the TRANSCRIPT holds the machine row, which is where the pass is visible
 *     at all (`[olai] Sleep. You are the node agent for …` — the sentence
 *     `olai-plugin-chat`'s `sleep.ts` authors);
 *   - the NODE holds the memo (`chat-agent-slept`), which is what keeps a quiet
 *     subtree from being slept over again;
 *   - the LOG holds the commit, asserted through git's own steps (`the last
 *     commit is … by "sleep"`), because the commit is the undo.
 *
 * The fake agent's behaviour is chosen by marker files rather than by anything a
 * scenario says to it: the pass always sends the same words, so there is no verb
 * to steer (`packages/tests/agent/scripted-acp.ts` reads the markers).
 */

import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { MARKER } from "@olai/tests/harness/scripted.ts";
import { selector } from "@olai/web/testlib";
import { attr, HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { CHAT_TRANSCRIPT } from "../selectors.ts";
import { openFold } from "./node_agent_folds_steps.ts";

/** The vault every sleep scenario runs over. */
const FILE = "house.olai";

const fold = (world: OlaiWorld, node: string) =>
  world.frontLane().locator(
    `${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`,
  );

/** The node's own record, off the served file — the half of a sleep that is not
 *  in the log. */
const record = (world: OlaiWorld, node: string): Record<string, unknown> | undefined =>
  world.servedNodes(FILE).find((row) => row["id"] === world.nodeId(node));

const memoOf = (world: OlaiWorld, node: string): unknown =>
  (record(world, node)?.["custom"] as Record<string, unknown> | undefined)?.["chat-agent-slept"];

/**
 * THE MEMORY HAS MOVED — a stamp on a row UNDER the node, which is the only
 * thing that makes a pass due.
 *
 * The corpus's own rows carry no stamps (they are hand-written fixtures), and a
 * subtree nobody has ever written to is a subtree the pass correctly leaves
 * alone. So the scenario writes one, the way a day of real work would have.
 */
Given("the memory under {string} has moved", function (this: OlaiWorld, node: string) {
  const id = this.nodeId(node);
  const under = new Set<string>([id]);
  // The subtree, resolved off the file: a row is under the node when its parent
  // chain reaches it. A few passes, because a child may be met before its
  // parent — and the corpus is three rows deep at most.
  for (let round = 0; round < 4; round++) {
    for (const row of this.servedNodes(FILE)) {
      const parent = row["parent"];
      if (typeof parent === "string" && under.has(parent)) under.add(String(row["id"]));
    }
  }
  const moved = this.servedNodes(FILE).map((row) =>
    under.has(String(row["id"])) && row["id"] !== id
      ? { ...row, changed: "2026-10-01T09:00:00+00:00" }
      : row,
  );
  this.writeServed(FILE, moved.map((row) => JSON.stringify(row)).join("\n"));
});

/** The machine row, waited for — the pass is asynchronous by construction, so
 *  every assertion about it is a wait. */
Then("the node agent {string} has been tidied", async function (this: OlaiWorld, node: string) {
  await openFold(this, node);
  const transcript = fold(this, node).locator(CHAT_TRANSCRIPT);
  await this.waitUntil(
    async () => (await transcript.innerText()).includes("Sleep. You are the node agent for"),
    "the sleep row in the transcript",
    HYDRATION_TIMEOUT,
  );
});

/** ... and its absence, which is the half that regresses: a pass that never ran
 *  looks exactly like a pass nobody waited for, so this waits a few ticks of the
 *  scenario's own short `sleep-tick` before it says so. */
Then("the node agent {string} has not been tidied", async function (this: OlaiWorld, node: string) {
  await openFold(this, node);
  const transcript = fold(this, node).locator(CHAT_TRANSCRIPT);
  await this.page.waitForTimeout(2_000);
  assert.ok(
    !(await transcript.innerText()).includes("Sleep. You are the node agent for"),
    `node agent ${node} was tidied, and this scenario says it must not be`,
  );
});

Then("node {string} carries the sleep memo", async function (this: OlaiWorld, node: string) {
  await this.waitUntil(
    async () => typeof memoOf(this, node) === "string",
    `node ${node} to carry chat-agent-slept`,
    HYDRATION_TIMEOUT,
  );
});

Then("node {string} carries no sleep memo", async function (this: OlaiWorld, node: string) {
  assert.strictEqual(
    memoOf(this, node),
    undefined,
    `node ${node} carries a memo, and this scenario says no pass finished`,
  );
});

/** THE TWO THINGS A SLEEP TURN CAN DO THAT A SCENARIO WANTS TO WATCH, both of
 *  them cases the PRODUCT decides: a question nobody is there to answer, and an
 *  attempt to write the memo itself. */
/**
 * THE PASS OFF — the chat row's own `sleep: off`, written the way an operator
 * writes it, and read by the row on the vault's change like every other setting
 * (`olai-plugin-chat`'s `settings.ts`). The scenario's own short spans are
 * already in the file, so this MERGES rather than replacing.
 */
Given("the sleep pass is off", function (this: OlaiWorld) {
  const rows = this.servedNodes("_olai/Settings.olai");
  const chat = rows.find((row) => row["title"] === "chat");
  assert.ok(chat !== undefined, "the fixture policy wrote no chat row to turn the pass off in");
  chat["custom"] = { ...(chat["custom"] as Record<string, string> | undefined), sleep: "off" };
  this.writeServed("_olai/Settings.olai", rows.map((row) => JSON.stringify(row)).join("\n"));
});

When("the next sleep asks a question", function (this: OlaiWorld) {
  this.writeServed(MARKER.sleepAsk, "");
});

When("the next sleep writes the memo itself", function (this: OlaiWorld) {
  this.writeServed(MARKER.sleepStamp, "");
});

/**
 * WHAT THE SERVER SAID ABOUT IT — the pass's own line, off the logfmt the
 * harness collects from the spawned server.
 *
 * The one assertion a browser cannot make: the pass cancels a question and says
 * so, and the node it gave up on is a thing only the log records.
 */
Then("the server log says {string}", async function (this: OlaiWorld, words: string) {
  await this.waitUntil(
    async () => this.serverLog.text.includes(words),
    `the server log to say "${words}"`,
    HYDRATION_TIMEOUT,
  );
});

/**
 * Give the pass its full chance and look afterwards — the only way to say a
 * TIMER did not fire.
 *
 * A bare wait, and it is named as one: what follows it is whatever the scenario
 * wanted to still be true, and the value of the step is that a pass has
 * demonstrably had several of the scenario's own `sleep-tick`s to happen in.
 * `git`'s own "the quiet window is given its full run" is the same step for the
 * same reason, and this is the one scenario that needs it.
 */
When("the sleep pass has had its chance", async function (this: OlaiWorld) {
  await this.page.waitForTimeout(2_000);
});
