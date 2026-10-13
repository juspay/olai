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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findLogfmt } from "@olai/log/testlib";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { MARKER, SLEEP_STAMP } from "@olai/tests/harness/scripted.ts";
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

/**
 * THE OPT-IN, PRESSED IN THE STRIP — the switch under the conversation, which is
 * where a person looks for what this chat wakes on (`browser/chat/Wake.tsx`,
 * beside the mail plugin's *Alert on new mail*). The same door the row menu and
 * the palette press; `aria-checked` IS the mark, so the wait after the press is
 * the assertion, and the words beside it are the same fact for a reader.
 *
 * THE MAIL ROW'S OWN STEP, word for word (`mail/e2e/steps/mail_inbox_steps.ts`),
 * including the literal testid: a plugin's own switch is addressed by its own
 * name there, and this is chat's.
 */
const switchSleep = async (world: OlaiWorld, on: boolean) => {
  const button = world.chat('[data-testid="chat-sleep-switch"]');
  await world.waitUntil(async () => await button.count() === 1, "the sleep switch in the strip");
  if ((await button.getAttribute("aria-checked") === "true") !== on) await button.click();
  await world.waitUntil(
    async () => (await button.getAttribute("aria-checked") === "true") === on,
    `sleep when idle ${on ? "on" : "off"}`,
  );
};

When("I switch sleep when idle on for this conversation", async function (this: OlaiWorld) {
  await switchSleep(this, true);
});

When("I switch sleep when idle off for this conversation", async function (this: OlaiWorld) {
  await switchSleep(this, false);
});

Then("sleep when idle is on for this conversation", async function (this: OlaiWorld) {
  assert.equal(await this.chat('[data-testid="chat-sleep-switch"]').getAttribute("aria-checked"), "true");
});

Then("sleep when idle is off for this conversation", async function (this: OlaiWorld) {
  assert.equal(await this.chat('[data-testid="chat-sleep-switch"]').getAttribute("aria-checked"), "false");
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
  // ...AND IT IS DRAWN AS A MACHINE'S ROW, RUNG BY THE PASS: the attribution is
  // the word the delivery was made under (`olai · sleep`), and the row FOLDS —
  // one essence line with a chevron, the instruction behind it, which is what a
  // reader is owed before they press anything.
  const rang = fold(this, node)
    .locator(`${selector(PLUGIN_TESTID.chatRang)}${attr("data-rang-by", "sleep")}`);
  await rang.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const chevron = rang.locator(selector(PLUGIN_TESTID.chatRangFold));
  await chevron.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.notStrictEqual(
    await chevron.getAttribute("aria-expanded"),
    "true",
    "the instruction was already open, so this row is not the folded one a reader meets",
  );
  assert.strictEqual(
    await rang.locator(selector(PLUGIN_TESTID.chatRangBody)).count(),
    0,
    "the row drew its whole account before anybody pressed the chevron",
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
When("the next sleep asks a question", function (this: OlaiWorld) {
  this.writeServed(MARKER.sleepAsk, "");
});

When("the next sleep writes the memo itself", function (this: OlaiWorld) {
  this.writeServed(MARKER.sleepStamp, "");
});

/** ...and one that WRITES and then holds its turn open, so a scenario can give
 *  the quiet window its full run in the middle of a pass. */
When("the next sleep holds its turn open", function (this: OlaiWorld) {
  this.writeServed(MARKER.sleepHold, "");
});

/** THE FENCE'S TWO CASES, and the marker's content is the node to aim at: a
 *  scenario names nodes, and the fake knows only the row it was handed. */
When("the next sleep writes outside its subtree at {string}", function (this: OlaiWorld, node: string) {
  this.writeServed(MARKER.sleepOutside, this.nodeId(node));
});

When("the next sleep trashes {string}", function (this: OlaiWorld, node: string) {
  this.writeServed(MARKER.sleepTrash, this.nodeId(node));
});

/**
 * THE QUESTION IS ON THE WIRE — the absence assertions below are about a
 * question that EXISTS, and with the fold shut there is nothing else to read.
 * The agent leaves the marker as it asks (`MARKER.sleepAsked`).
 */
Then("the sleep's question is waiting", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => existsSync(join(this.scratch(), MARKER.sleepAsked)),
    "the sleep's question to reach the panel",
    HYDRATION_TIMEOUT,
  );
});

/**
 * THE PASS'S OWN MEMO, AND NOT THE AGENT'S — the half of the reserved key that
 * only the value can show: the scripted agent tries to write
 * {@link SLEEP_STAMP} and is refused, and what is on the node afterwards is the
 * instant the pass wrote.
 */
Then("the memo on node {string} is the pass's own", async function (this: OlaiWorld, node: string) {
  await this.waitUntil(
    async () => typeof memoOf(this, node) === "string",
    `node ${node} to carry the pass's memo`,
    HYDRATION_TIMEOUT,
  );
  const memo = memoOf(this, node);
  assert.notStrictEqual(memo, SLEEP_STAMP, "the agent's own value landed on the node");
  assert.match(
    String(memo),
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    `the memo is ${String(memo)}, which is not an instant`,
  );
});

/**
 * THE COMMIT, WAITED FOR — the machine row appears when the TURN starts, so an
 * assertion about the commit read straight after it would be a race with the
 * commit itself. `git`'s own "the last commit is …" step is the immediate read,
 * and it is right for a commit a person just made.
 */
Then(
  "the last commit becomes {string} by {string}",
  async function (this: OlaiWorld, subject: string, writer: string) {
    await this.waitUntil(
      async () => {
        try {
          return this.git("log", "--format=%s", "-1").trim() === subject
            && this.git("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim() === writer;
        } catch {
          // A repository with no commits yet is "not yet", not a failure.
          return false;
        }
      },
      `the last commit to become ${JSON.stringify(subject)} by ${JSON.stringify(writer)}`,
      HYDRATION_TIMEOUT,
    );
  },
);

/**
 * WHAT THE SERVER SAID ABOUT IT — the pass's own line, at the level an operator
 * reads, off the logfmt the harness collects from the spawned server.
 *
 * The one assertion a browser cannot make: the pass cancels a question and says
 * so, and the node it gave up on is a thing only the log records. It is the
 * WARNING and not a substring of the log: `findLogfmt` matches the message
 * exactly and answers the fields, so a line that moved to INFO — or a message
 * that changed wording — fails here rather than passing on a fragment.
 */
Then(
  "the server log warns that {string} did not finish: {string}",
  async function (this: OlaiWorld, node: string, why: string) {
    const message = `sleep: ${this.nodeId(node)} did not finish: ${why}`;
    await this.waitUntil(
      async () => findLogfmt(this.serverLog.text, message)?.level === "WARN",
      `the server log to warn: ${message}`,
      HYDRATION_TIMEOUT,
    );
  },
);

/**
 * Give the pass its full chance and look afterwards — the only way to say a
 * TIMER did not fire.
 *
 * A bare wait, and it is named as one: what follows it is whatever the scenario
 * wanted to still be true, and the value of the step is that a pass has
 * demonstrably had several of the scenario's own `sleep-tick`s to happen in.
 * `git`'s own "the quiet window is given its full run" is the same step for the
 * same reason.
 */
When("the sleep pass has had its chance", async function (this: OlaiWorld) {
  await this.page.waitForTimeout(2_000);
});
