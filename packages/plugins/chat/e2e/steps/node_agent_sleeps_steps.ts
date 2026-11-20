import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { stampOf } from "@olai/format";
import { findLogfmt } from "@olai/log/testlib";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { MARKER_FILE, SLEEP_STAMP } from "@olai/tests/harness/scripted.ts";
import { selector } from "@olai/web/testlib";
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { CHAT_TRANSCRIPT } from "../selectors.ts";
import { TESTID } from "../../src/testids.ts";
import { openFold } from "./node_agent_folds_steps.ts";

const FILE = "house.olai";

const fold = (world: OlaiWorld, node: string) =>
  world.frontLane().locator(
    `${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`,
  );

const record = (world: OlaiWorld, node: string): Record<string, unknown> | undefined =>
  world.servedNodes(FILE).find((row) => row["id"] === world.nodeId(node));

const memoOf = (world: OlaiWorld, node: string): unknown =>
  (record(world, node)?.["custom"] as Record<string, unknown> | undefined)?.["chat-agent-slept"];

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

const movedAt = (): string => stampOf(new Date());

const stampUnder = (
  world: OlaiWorld,
  node: string,
  at: string,
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

Given("one row under {string} has moved", async function (this: OlaiWorld, node: string) {
  const memo = memoOf(this, node);
  if (typeof memo === "string") {
    const past = Date.parse(memo) + 1_000;
    while (Date.now() < past) await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  const rows = this.servedNodes(FILE);
  const below = under(this, node);
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

Then("the sleep item mentions {string}", async function (this: OlaiWorld, words: string) {
  const said = await item(this).innerText();
  assert.ok(said.includes(words), `the sleep item should mention ${words}: ${said}`);
});

const item = (world: OlaiWorld) => world.chat(selector(TESTID.chatSleeping));

const line = (world: OlaiWorld) => world.chat(selector(TESTID.chatStanding));

const says = async (world: OlaiWorld, next: string): Promise<void> => {
  const seen = await item(world).evaluate(async (node, want) => {
    const until = Date.now() + 10_000;
    const memo = node.getAttribute("data-last");
    for (;;) {
      const now = node.getAttribute("data-next");
      if (now === want) return true;
      if (want === "due" && (now === "running" || node.getAttribute("data-last") !== memo)) return true;
      if (Date.now() > until) return now;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, next);
  assert.ok(seen === true, `the sleep item should say ${next}, and it says ${String(seen)}`);
};

Then("the sleep item says {string}", async function (this: OlaiWorld, next: string) {
  await says(this, next);
});

Then("the sleep item has a memo", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await item(this).getAttribute("data-last")) !== null,
    "the sleep item to carry the memo",
  );
});

Then("the sleep item has no memo", async function (this: OlaiWorld) {
  assert.equal(await item(this).getAttribute("data-last"), null);
});

Then("the sleep item and the wake faces share one strip", async function (this: OlaiWorld) {
  const strips = this.chat(`${selector(TESTID.chatPanel)} > section`);
  await this.waitUntil(async () => await strips.count() >= 1, "the standing line to be drawn");
  assert.ok(await strips.count() <= 2, "the head should be the tools roster and the standing line, no more");
  assert.equal(await this.chat(`${selector(TESTID.chatPanel)} > ${selector(TESTID.chatStanding)}`).count(), 1);
  assert.equal(await this.chat(`${selector(TESTID.chatStanding)} ${selector(TESTID.chatSleeping)}`).count(), 1);
  assert.equal(await this.chat(`${selector(TESTID.chatStanding)} ${selector(TESTID.chatWake)}`).count(), 1);
});

When("I narrow the window to a phone's width", async function (this: OlaiWorld) {
  await this.page.setViewportSize({ width: 420, height: 800 });
});

Then("the standing line has wrapped", async function (this: OlaiWorld) {
  const box = await line(this).evaluate((node, wakeId) => {
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

When("I press Tidy memory on the strip", async function (this: OlaiWorld) {
  const button = this.chat(selector(TESTID.chatTidyMemory));
  await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await button.click();
});

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

const tidies = new WeakMap<OlaiWorld, Map<string, number>>();

Then("the node agent {string} has been tidied", async function (this: OlaiWorld, node: string) {
  await openFold(this, node);
  const transcript = fold(this, node).locator(CHAT_TRANSCRIPT);
  await this.waitUntil(
    async () => (await transcript.innerText()).includes("Sleep. You are the node agent for"),
    "the sleep row in the transcript",
    HYDRATION_TIMEOUT,
  );
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

When("the next sleep asks a question", function (this: OlaiWorld) {
  this.writeServed(MARKER_FILE.sleepAsk, "");
});

When("the next sleep writes the memo itself", function (this: OlaiWorld) {
  this.writeServed(MARKER_FILE.sleepStamp, "");
});

When("the next sleep holds its turn open", function (this: OlaiWorld) {
  this.writeServed(MARKER_FILE.sleepHold, "");
});

When("the next sleep writes outside its subtree at {string}", function (this: OlaiWorld, node: string) {
  this.writeServed(MARKER_FILE.sleepOutside, this.nodeId(node));
});

When("the next sleep trashes {string}", function (this: OlaiWorld, node: string) {
  this.writeServed(MARKER_FILE.sleepTrash, this.nodeId(node));
});

Then("the sleep's question is waiting", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => existsSync(join(this.scratch(), MARKER_FILE.sleepAsked)),
    "the sleep's question to reach the panel",
    HYDRATION_TIMEOUT,
  );
});

Then("the sleep turn has tried to write the memo itself", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => !existsSync(join(this.scratch(), MARKER_FILE.sleepStamp)),
    "a sleep turn to reach the agent and take its marker",
    HYDRATION_TIMEOUT,
  );
});

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

Then(
  "the last commit becomes {string} by {string}",
  async function (this: OlaiWorld, subject: string, writer: string) {
    await this.waitUntil(
      async () => {
        try {
          return this.git("log", "--format=%s", "-1").trim() === subject
            && this.git("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim() === writer;
        } catch {
          return false;
        }
      },
      `the last commit to become ${JSON.stringify(subject)} by ${JSON.stringify(writer)}`,
      HYDRATION_TIMEOUT,
    );
  },
);

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

When("the sleep pass has had its chance", async function (this: OlaiWorld) {
  await this.page.waitForTimeout(2_000);
});
