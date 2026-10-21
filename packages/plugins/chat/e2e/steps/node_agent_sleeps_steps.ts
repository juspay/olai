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
import { stampOf } from "@olai/format";
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
/** THE SUBTREE UNDER A NODE, off the served file: a row is under it when its
 *  parent chain reaches it. A few passes, because a child may be met before its
 *  parent — and the corpus is three rows deep at most. */
const under = (world: OlaiWorld, node: string): ReadonlySet<string> => {
  const id = world.nodeId(node);
  const below = new Set<string>([id]);
  for (let round = 0; round < 4; round++) {
    for (const row of world.servedNodes(FILE)) {
      const parent = row["parent"];
      if (typeof parent === "string" && below.has(parent)) below.add(String(row["id"]));
    }
  }
  return below;
};

/**
 * WHEN A MOVED ROW MOVED — THE READER'S OWN CLOCK, in the PRODUCT'S OWN SPELLING,
 * which is the one thing this fixture changed when the pressure rule arrived.
 *
 * `the memory under … has moved` used to stamp every row at `2026-10-01`, which
 * was a past date the rule did not care about while a pass needed only "something
 * moved". It cares now: the third way to be due is a moved row OLDER than
 * `sleep-latest`, and a stamp from last October is older than any sensible
 * backstop — so every scenario would be due by that clause, and the state a
 * scenario about the floor wants to read (`little`) would never be reachable at
 * all. Stamped at now, a moved row is younger than the week the fast policy
 * waits, and the backstop is what the unit table holds instead.
 *
 * `stampOf` AND NOT `toISOString()`: olai mints every stamp at SECOND precision
 * (year to seconds, plus the offset it was taken at), and a fixture that spelled
 * one with MILLISECONDS would be comparing `:44.900` with olai's own `:44` — so a
 * row stamped in the same second as the memo that followed it reads as NEWER than
 * that memo, and stays "moved" for ever. One spelling of a stamp, and it is the
 * product's.
 *
 * AND NEVER A STAMP IN THE FUTURE, which is why the step that has a memo to
 * outrank WAITS for the clock to leave that memo's own second rather than writing
 * the second after it: a row stamped ahead of the reader is not a row that moved,
 * it is a row from tomorrow, and the reading is entitled to say so.
 */
const movedAt = (): string => stampOf(new Date());

/** Stamp the rows under a node the caller picked, at one instant it names — ONE
 *  instant, because "has this row moved yet" is asked of it below and two calls
 *  to the clock would leave a row that had just moved looking unmoved. */
const stampUnder = (
  world: OlaiWorld,
  node: string,
  at: string,
  /** WHICH ROW, BY ID — and by ID because the rows a caller picked from are the
   *  records of ANOTHER read: `servedNodes` parses the file afresh every call, so
   *  two reads of one file hold two sets of objects and an identity test against
   *  one of them is false for every row of the other. The first version of this
   *  compared objects and stamped NOTHING, which is the kind of bug a scenario
   *  reports as a state that never arrives. */
  wanted: (id: string) => boolean,
): void => {
  const id = world.nodeId(node);
  const below = under(world, node);
  const rows = world.servedNodes(FILE);
  const moved = rows.map((row) =>
    below.has(String(row["id"])) && row["id"] !== id && wanted(String(row["id"])) ? { ...row, changed: at } : row,
  );
  world.writeServed(FILE, moved.map((row) => JSON.stringify(row)).join("\n"));
};

Given("the memory under {string} has moved", function (this: OlaiWorld, node: string) {
  stampUnder(this, node, movedAt(), () => true);
});

/**
 * ONE ROW, AND ONE THE JUDGEMENT DOES NOT COUNT YET — so calling this twice is
 * TWO moved rows, which is what a scenario about the floor has to say.
 *
 * "NOT COUNTED YET" IS MEASURED AGAINST THE MEMO, and that is the whole subtlety:
 * the memo is what the rule compares a row with (`@olai/format`'s `changesUnder`),
 * so a row is untouched when it carries no `changed` at all, or when that stamp's
 * instant is at or before the memo's. Comparing with the instant THIS step
 * happens to write would be comparing with a fresh value every call — the row the
 * first call stamped carries an EARLIER instant, never an equal one — so the
 * second call would pick that same row, restamp it, and the count would stay at
 * one for ever: exactly the shape of a scenario that can never reach `due`.
 *
 * In this scenario's own terms, after its `Sleep now`: `hinges` carries the
 * retitle the fake wrote, which is OLDER than the memo written at the end of that
 * pass, so it is picked first and the next row under the node second — two moved
 * rows, and the floor of two is met.
 *
 * The node's own record is never stamped: the memo lives on it, and a write there
 * would be a move the rule deliberately does not count.
 */
Given("one row under {string} has moved", async function (this: OlaiWorld, node: string) {
  const memo = memoOf(this, node);
  // WAIT OUT THE MEMO'S OWN SECOND. olai stamps to the second, so a move a moment
  // after a pass spells the SAME stamp that pass left — and the rule counts only
  // what is NEWER than the memo, so the row would not count as moved at all and
  // this scenario would read `unchanged` where it wants `little`. The alternative,
  // writing the memo's second plus one, is a stamp from the FUTURE, which is not a
  // move either. Waiting is the price of the product's own resolution, and these
  // scenarios run on a millisecond quiet window, so it is the only cost.
  if (typeof memo === "string") {
    const past = Date.parse(memo) + 1_000;
    while (Date.now() < past) await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  const rows = this.servedNodes(FILE);
  const below = under(this, node);
  // ...AND THE UNTOUCHED CLAUSE READS THAT SAME MEMO, so nothing that has moved
  // since the last sleep is picked twice: the row a pass retitled carries that
  // pass's own second, and is the first thing here to be moved.
  const at = movedAt();
  const untouched = (row: Record<string, unknown>): boolean => {
    const changed = row["changed"];
    if (changed === undefined) return true;
    return typeof memo === "string" && Date.parse(String(changed)) <= Date.parse(memo);
  };
  const next = rows.find((row) =>
    below.has(String(row["id"])) && row["id"] !== this.nodeId(node) && untouched(row));
  assert.ok(next !== undefined, `every row under ${node} has moved since the last sleep`);
  const one = String(next["id"]);
  assert.ok(
    this.servedNodes(FILE).filter((row) => below.has(String(row["id"])) && String(row["id"]) === one).length === 1,
    `the row ${one} should be the one this node's file holds`,
  );
  stampUnder(this, node, at, (id) => id === one);
});

/** ...AND WHAT THE ITEM SAYS, for the states whose point is the sentence rather
 *  than the state: a floor is only visible as "1 of 2 rows". */
Then("the sleep item mentions {string}", async function (this: OlaiWorld, words: string) {
  const said = await item(this).innerText();
  assert.ok(said.includes(words), `the sleep item should mention ${words}: ${said}`);
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
    // `due` IS A WINDOW OF ONE TICK, and on a loaded box the loop's look can
    // land in the same instant as the revision that made the node due — the
    // frame the page gets already says `running`, and the one after it a
    // fresh memo. Both are the window having been there and closed; what the
    // scenario holds is that the second row made the node due, and a pass
    // that took it says so as surely as the word. The memo as of the ask is
    // what a NEWER memo is measured against.
    const memo = node.getAttribute("data-last");
    for (;;) {
      const now = node.getAttribute("data-next");
      if (now === want) return true;
      if (want === "due" && (now === "running" || node.getAttribute("data-last") !== memo)) return true;
      if (Date.now() > until) return now;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, next);
  // WHAT IT DID SAY, when it never said what the scenario wanted: the state is the
  // whole of the diagnosis, and "expected little, got false" would send the next
  // reader back to the browser to find out.
  assert.ok(seen === true, `the sleep item should say ${next}, and it says ${String(seen)}`);
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
    // THE ITEMS ARE THE LINE'S OWN CHILDREN, which is the `<p>` inside the
    // section: the sleep item first, then the wake group. Each is found BY ITS
    // ATTRIBUTE rather than by a selector built in a step —
    // `packages/tests/selectors.test.ts` holds that line, and a step is where it
    // is easiest to cross it.
    const items = node.querySelector("p");
    if (items === null) return { sleep: null, wake: null };
    const children = [...items.children] as Array<HTMLElement>;
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

/** HOW MANY PASSES A SCENARIO HAS SEEN on a node, so the next "has been
 *  tidied" waits for a NEW machine row rather than finding the last one —
 *  a scenario that sleeps twice has two rows under the fold, and the second
 *  claim is about the second. */
const tidies = new WeakMap<OlaiWorld, Map<string, number>>();

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
  // reader is owed before they press anything. THE NEWEST such row, waited
  // for: the one this claim is about is the pass after the last one seen.
  const rungBy = fold(this, node)
    .locator(`${selector(PLUGIN_TESTID.chatRang)}${attr("data-rang-by", "sleep")}`);
  let seen = tidies.get(this);
  if (seen === undefined) { seen = new Map(); tidies.set(this, seen); }
  const before = seen.get(node) ?? 0;
  await this.waitUntil(async () => (await rungBy.count()) > before, `a ${before + 1}${before === 0 ? "st" : before === 1 ? "nd" : "th"} machine row under ${node}`, HYDRATION_TIMEOUT);
  seen.set(node, before + 1);
  const rang = rungBy.nth(before);
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
