import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionStore } from "@olai/tests/agent/session-store.ts";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib";
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

const rowFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${ROSTER} ${ROW}${attr("data-agent", world.nodeId(node))}`);

const doorFor = (world: OlaiWorld, node: string) =>
  world.page.locator(`${DOOR}${attr("data-agent", world.nodeId(node))}`);

Then(
  "the agents roster lists {string}",
  async function (this: OlaiWorld, node: string) {
    await this.showSidebar();
    await rowFor(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

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

Then(
  "the door on {string} stands {string}",
  async function (this: OlaiWorld, node: string, standing: string) {
    const door = doorFor(this, node);
    await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await door.getAttribute("data-standing"), standing);
  },
);

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

Then("the Chats row {string} wears no dot", async function (this: OlaiWorld, node: string) {
  await this.showSidebar();
  const row = rowFor(this, node);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => await row.getByRole("img").count() === 0,
    `the Chats row for ${node} to draw no standing mark`,
  );
});

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

Then("the agents roster says nothing", async function (this: OlaiWorld) {
  await this.showSidebar();
  assert.strictEqual(await this.page.locator(REFUSED).count(), 0);
});

When("I press the door on {string}", async function (this: OlaiWorld, node: string) {
  await this.press(doorFor(this, node));
});

const OPENS = ["This conversation is the node agent for"];

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

When("I start a fresh session with {string}", async function (this: OlaiWorld, engine: string) {
  const fresh = this.chat(FRESH);
  await fresh.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await fresh.first().click();
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).click();
  await confirmFresh(this);
});

When("I press the close-agent control", async function (this: OlaiWorld) {
  const close = this.chat(selector(PLUGIN_TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await close.click();
  await startFor(this, "install").waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the close control says {string}", async function (this: OlaiWorld, words: string) {
  const close = this.chat(selector(PLUGIN_TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const says = (await close.innerText()).replace(/\s+/g, " ").trim();
  assert.strictEqual(says, words);
  assert.equal(await close.getAttribute("title"), null);
});

Then("the panel offers no sessions of its own", async function (this: OlaiWorld) {
  await this.chat(CHAT_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => (await this.chat(CHAT_SESSIONS).count()) === 0,
    "the panel to offer no sessions control",
  );
});

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

Then(
  "the panel header names the node agent {string}",
  async function (this: OlaiWorld, title: string) {
    assert.ok(this.activeAgent);
    const id = this.nodeId(this.activeAgent);
    const line = this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", id)}`);
    const pageHead = this.page.locator(`${selector(PLUGIN_TESTID.agentPageHead)}${attr("data-agent", id)}`);
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

const STORED_SESSIONS: Record<string, Record<string, string>> = {
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

When("the engine has no record of the chat remembered as {string}", function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  writeFileSync(join(this.scratch(), `.agent-missing-${id}`), "");
});

When("the engine finds the chat remembered as {string} again", function (this: OlaiWorld, name: string) {
  const id = notedSessions.get(this)?.get(name);
  assert.ok(id, `no conversation remembered as ${name}`);
  rmSync(join(this.scratch(), `.agent-missing-${id}`), { force: true });
});

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
