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
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { CHAT_TRANSCRIPT } from "../selectors.ts";
import { TESTID } from "../../src/testids.ts";
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

/** THE ITEM ON THE STANDING LINE, addressed by the plugin's own testid — the
 *  sleep mark and the forecast are chat's, so the line's items are too. */
const item = (world: OlaiWorld) => world.chat(selector(TESTID.chatSleeping));

/** THE STANDING LINE ITSELF, for the two layout claims a scenario makes about
 *  it: that it is ONE line under the tools roster, and that it wraps. */
const line = (world: OlaiWorld) => world.chat(selector(TESTID.chatStanding));

/**
 * WHAT THE ITEM SAYS, AS DATA — `data-next` is the forecast's own `kind`, so a
 * scenario asserts the FACT and the words are free to change.
 *
 * POLLED IN THE BROWSER, once a frame, and that is not an optimisation: the pass
 * runs on a 250 ms tick in these scenarios, so `due` is a window of a quarter of
 * a second and a round trip per try would step over it. Read from inside the
 * page, the state is caught in the frame it arrives in — and a state that never
 * arrives still fails, at the budget below.
 */
const says = async (world: OlaiWorld, next: string): Promise<void> => {
  const seen = await item(world).evaluate(async (node, want) => {
    const until = Date.now() + 10_000;
    for (;;) {
      if (node.getAttribute("data-next") === want) return true;
      if (Date.now() > until) return false;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, next);
  assert.ok(seen, `the sleep item should say ${next}`);
};

Then("the sleep item says {string}", async function (this: OlaiWorld, next: string) {
  await says(this, next);
});

/** THE MEMO AS THE ITEM SEES IT — the same instant the node carries, on the row
 *  a person is looking at. */
Then("the sleep item has a memo", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await item(this).getAttribute("data-last")) !== null,
    "the sleep item to carry the memo",
  );
});

Then("the sleep item has no memo", async function (this: OlaiWorld) {
  assert.equal(await item(this).getAttribute("data-last"), null);
});

/**
 * ONE STRIP, TWO KINDS OF ITEM — which is the claim: the sleep item and the wake
 * faces are per-conversation standing facts of the same kind and share one line,
 * rather than wearing a bordered strip each. Asserted by DESCENT, because that is
 * what "on the same line" means here, and with the head's strip count held at two
 * — the tools roster (absent in a conversation that was handed no servers) and
 * this line, never a third.
 */
Then("the sleep item and the wake faces share one strip", async function (this: OlaiWorld) {
  const strips = this.chat(`${selector(TESTID.chatPanel)} > section`);
  await this.waitUntil(async () => await strips.count() >= 1, "the standing line to be drawn");
  assert.ok(await strips.count() <= 2, "the head should be the tools roster and the standing line, no more");
  assert.equal(await this.chat(`${selector(TESTID.chatPanel)} > ${selector(TESTID.chatStanding)}`).count(), 1);
  assert.equal(await this.chat(`${selector(TESTID.chatStanding)} ${selector(TESTID.chatSleeping)}`).count(), 1);
  assert.equal(await this.chat(`${selector(TESTID.chatStanding)} ${selector(TESTID.chatWake)}`).count(), 1);
});

/**
 * ...AND THAT IT WRAPS AT A PHONE'S WIDTH, which is the whole reason the two
 * items are one line rather than two strips: the sleep item is first and the wake
 * faces drop to the line below it, rather than the line overflowing sideways or
 * the head growing another row of chrome.
 */
When("I narrow the window to a phone's width", async function (this: OlaiWorld) {
  await this.page.setViewportSize({ width: 420, height: 800 });
});

Then("the standing line has wrapped", async function (this: OlaiWorld) {
  const box = await line(this).evaluate((node, wakeId) => {
    // THE CHILD IS FOUND BY ITS ATTRIBUTE rather than by a selector built in a
    // step: `packages/tests/selectors.test.ts` holds that line, and a step is
    // where it is easiest to cross it.
    const children = [...node.children] as Array<HTMLElement>;
    const first = children[0] ?? null;
    const wake = children.find((one) => one.getAttribute("data-testid") === wakeId) ?? null;
    return {
      sleep: first === null ? null : first.getBoundingClientRect().bottom,
      wake: wake === null ? null : wake.getBoundingClientRect().top,
    };
  }, TESTID.chatWake);
  assert.ok(box.wake !== null && box.sleep !== null, "the line should carry both kinds of item");
  assert.ok(
    box.wake >= box.sleep - 1,
    `the wake faces should be on the line below the sleep item: ${box.wake} vs ${box.sleep}`,
  );
});

/**
 * THE PASS, ASKED FOR FROM THE STRIP — the item's own button, which is the same
 * verb the row menu and ⌘K carry.
 */
When("I press Sleep now on the strip", async function (this: OlaiWorld) {
  const button = this.chat(selector(TESTID.chatSleepNow));
  await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await button.click();
});

/**
 * THE OPT-IN, PRESSED IN THE STRIP — the switch under the conversation, which is
 * where a person looks for what this chat wakes on (`browser/chat/Sleeping.tsx`,
 * in the bar the wake strip sits in). The same door the row menu and the palette
 * press; `aria-checked` IS the mark, so the wait after the press is the
 * assertion, and the words beside it are the same fact for a reader.
 *
 * THE SHAPE OF THE ROW THAT ALREADY HAD A SWITCH there, word for word, including
 * the literal testid: a plugin's own switch is addressed by its own name in the
 * row that owns it, and this is chat's.
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
