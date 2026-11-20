import { ATTACHMENT_ACCEPT } from "@olai/surface";
import { onConversationPage, openFold, returnToOutline } from "./node_agent_folds_steps.ts";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";

import { selector } from "@olai/web/testlib";
import { PLUGIN_TESTID, type PluginTestId } from "@olai/tests/harness/testids.ts";
import { completingIn, NEAR } from "../../src/testlib.ts";

import { retypedAndTaken } from "@olai/tests/harness/atonce.ts";
import { MARKER } from "@olai/tests/harness/scripted.ts";
import { SESSION_STORE_MARKER } from "@olai/tests/agent/session-store.ts";
import { keysSettled } from "@olai/tests/harness/settling.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import { answered } from "@olai/tests/harness/shortlist.ts";

Given("the harness keeps distinct sessions on disk", function (this: OlaiWorld) {
  fs.mkdirSync(path.join(this.scratch(), SESSION_STORE_MARKER), { recursive: true });
});

import {
  attr,
  CHAT_ASK,
  CHAT_ASK_CHOICE,
  CHAT_ASK_DISMISS,
  CHAT_ASK_OUTCOME,
  CHAT_ASK_SUBMIT,
  CHAT_ASK_TEXT,
  CHAT_COMPLETION,
  CHAT_COMPLETION_ROW,
  CHAT_COMPLETION_SECTION,
  CHAT_DIFF,
  CHAT_DIFF_EXPAND,
  CHAT_DIFF_GUTTER,
  CHAT_DIFF_LINE,
  CHAT_DIFF_MARK,
  CHAT_DIFF_TEXT,
  CHAT_DIFF_WHOLESALE,
  CHAT_ENTRY_STREAMING,
  CHAT_INPUT,
  CHAT_MINE,
  OUTLINES_NUDGE,
  CHAT_OUTLINE_CHANGE,
  CHAT_OUTLINE_DIFF,
  CHAT_PANEL,
  CHAT_REFUSAL,
  CHAT_SAID,
  CHAT_TROUBLE,
  CHAT_USAGE,
  OUTLINES_STORY,
  expectBefore,
  HYDRATION_TIMEOUT,
  NODE_TITLE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  STEER_DEADLINE_STEP_TIMEOUT,
  STEER_DEADLINE_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  CHAT_ATTACHMENT,
  CHAT_ATTACHMENT_PREVIEW,
  CHAT_ATTACH_BUTTON,
  CHAT_ATTACHMENT_SIZE,
  CHAT_AGENT,
  CHAT_AGENT_MARK,
  CHAT_BUSY,
  CHAT_CAMERA_BUTTON,
  CHAT_CANCEL,
  CHAT_CHOOSE,
  CHAT_CHOOSE_AGENT,
  CHAT_CHOOSE_CANCEL,
  CHAT_DELIVERY,
  CHAT_DROP,
  CHAT_EARLIER,
  CHAT_ENTRY,
  CHAT_INTERRUPT,
  CHAT_LANE,
  CHAT_LANE_DOOR,
  CHAT_LANE_LABEL,
  CHAT_MISSING,
  CHAT_MISSING_SERVER,
  CHAT_MISSING_WHY,
  CHAT_MODEL,
  CHAT_MODEL_FILTER,
  CHAT_MODEL_NONE,
  CHAT_NEW,
  CHAT_QUEUED,
  CHAT_QUEUES,
  CHAT_PREVIEW,
  CHAT_PREVIEW_ASKED,
  CHAT_PREVIEW_NOTHING,
  CHAT_PREVIEW_OF,
  CHAT_REOPEN,
  CHAT_RESEND,
  CHAT_ROSTER,
  CHAT_ROSTER_OWN,
  CHAT_SEND,
  CHAT_SERVER,
  CHAT_SESSION,
  CHAT_SESSION_AGENT,
  CHAT_SESSION_UNREACHABLE,
  CHAT_SESSION_LIST,
  CHAT_SESSION_SUPERSEDED,
  CHAT_SESSIONS,
  CHAT_ARMED,
  CHAT_ARMED_ENDED,
  CHAT_ARMED_STILL,
  CHAT_WATCHING,
  CHAT_WATCHING_FOR,
  CHAT_WATCHING_TASK,
  CHAT_SPAWN,
  CHAT_SPAWN_WORKING,
  CHAT_TITLE,
  CHAT_TOOL,
  CHAT_TOOL_DETAIL,
  CHAT_TOOL_ELAPSED,
  CHAT_TOOL_FOLD,
  CHAT_TOOL_LOCATIONS,
  CHAT_TOOL_PROGRESS,
  CHAT_TOOL_REPORT,
  CHAT_TRANSCRIPT,
  CHAT_UNOPENED,
  CHAT_UNOPENED_FRESH,
  CHAT_UNOPENED_WHY,
  CHAT_WAITING,
  CHAT_WORKING,
  CHAT_TOOL_TEXT,
  CHAT_TOOL_FILE,
  CHAT_TOOL_CALLED,
  CHAT_TOOL_REPLY,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the conversation panel has answered", async function (this: OlaiWorld) {
  assert.ok(this.activeAgent, "open a named node agent first");
  if (!(await onConversationPage(this, this.activeAgent))) await openFold(this, this.activeAgent);
  await this.waitUntil(async () => {
    const panel = this.chat(CHAT_PANEL);
    return await panel.count() > 0 && await panel.getAttribute("data-status") !== "booting";
  }, "the conversation panel to answer", HYDRATION_TIMEOUT);
});
Given("the node agent's fold is ready", async function (this: OlaiWorld) {
  assert.ok(this.activeAgent, "open a named node agent first");
  if (!(await onConversationPage(this, this.activeAgent))) await openFold(this, this.activeAgent);
  await this.waitUntil(async () => {
    const status = await this.chat(CHAT_PANEL).getAttribute("data-status");
    return status === "idle" || status === "thinking";
  }, "the node agent's fold to settle", HYDRATION_TIMEOUT);
});

const chatBox = async (world: OlaiWorld) => {
  const input = world.chat(CHAT_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return input;
};

const typeInto = async (world: OlaiWorld, text: string): Promise<void> => {
  await (await chatBox(world)).fill(text);
};

When("I ask the agent {string}", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
  await this.chat(CHAT_SEND).click();
});

When("I type {string} into the chat and send it with the return key", async function (this: OlaiWorld, text: string) {
  const box = await chatBox(this);
  await box.fill(text);
  await box.press("Enter");
  await keysSettled(this);
});

Then("the chat composer's return key is labelled {string}", async function (this: OlaiWorld, hint: string) {
  const box = await chatBox(this);
  assert.strictEqual(await box.getAttribute("enterkeyhint"), hint, "the composer's enterkeyhint");
  assert.strictEqual(await box.getAttribute("autocapitalize"), null, "the composer's autocapitalize");
  assert.strictEqual(await box.getAttribute("autocorrect"), null, "the composer's autocorrect");
});

When("I interrupt the agent with {string}", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
  await this.press(this.chat(CHAT_INTERRUPT));
});

When(
  "I interrupt the agent with {string} by keyboard",
  async function (this: OlaiWorld, text: string) {
    await typeInto(this, text);
    await (await chatBox(this)).press("Alt+Enter");
    await keysSettled(this);
  },
);

Then("the composer offers no interruption", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_INTERRUPT).count()) === 0,
    "the composer to offer no interruption",
    POLL_TIMEOUT,
  );
});

Then("the composer offers an interruption", async function (this: OlaiWorld) {
  await this.chat(CHAT_INTERRUPT)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When(
  "I retype the chat as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await chatBox(this), text);
  },
);

When("I type {string} into the chat", async function (this: OlaiWorld, text: string) {
  await typeInto(this, text);
});

When(
  "I type {string} into the chat a letter at a time",
  async function (this: OlaiWorld, text: string) {
    await (await chatBox(this)).pressSequentially(text);
    await keysSettled(this);
  },
);

Then(
  "the tab has asked what the armed nodes are called {int} time(s)",
  function (this: OlaiWorld, times: number) {
    assert.strictEqual(
      this.socketAskedSince("nodes/named"),
      times,
      "how many times this tab asked for the armed nodes' titles since the mark",
    );
  },
);

Then("the tab has marked the conversation as read", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => this.socketAskedSince("conversation/seen") >= 1,
    "the tab to acknowledge the conversation it is showing",
  );
});

Then("the tab has not marked the conversation as read", function (this: OlaiWorld) {
  assert.strictEqual(
    this.socketAskedSince("conversation/seen"),
    0,
    "how many times this tab acknowledged a conversation since the mark",
  );
});

When("I send the chat message", async function (this: OlaiWorld) {
  await this.chat(CHAT_SEND).click();
});

When("the agent is released", async function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.release), "");
});

When("I arm late growth on the next stored conversation", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), ".agent-want-late"), "");
});

When("I arm a slow replay on the next stored conversation", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.slowReplay), "");
});

When("I arm a long history on the next stored conversation", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.longHistory), "");
});

Then("the earlier messages door is drawn", async function (this: OlaiWorld) {
  const door = this.chat(CHAT_EARLIER);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const older = Number(await door.getAttribute("data-earlier"));
  assert.ok(
    Number.isFinite(older) && older > 0,
    `the earlier messages door drew saying ${older} rows are older — it should name a positive count`,
  );
});

Then("there are no earlier messages to load", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const door = this.chat(CHAT_EARLIER)
    if ((await door.count()) === 0) return true
    const older = await door.first().getAttribute("data-earlier").catch(() => null)
    return older === null || Number(older) === 0
  }, "the earlier messages door to go", HYDRATION_TIMEOUT)
});

When("I load earlier messages", async function (this: OlaiWorld) {
  const door = this.chat(CHAT_EARLIER);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const before = Number(await door.getAttribute("data-earlier"));
  await door.click();
  await this.waitUntil(async () => {
    const now = await this.chat(CHAT_EARLIER).getAttribute("data-earlier").catch(() => null);
    return now === null || Number(now) < before;
  }, "the earlier page to land", POLL_TIMEOUT);
});

const transcriptRows = (world: OlaiWorld): Promise<number> => world.chat(CHAT_ENTRY).count();

Then("the transcript holds more than {int} rows", async function (this: OlaiWorld, least: number) {
  await this.waitUntil(
    async () => (await transcriptRows(this)) > least,
    `the transcript to hold more than ${least} rows`,
    HYDRATION_TIMEOUT,
  );
});

Then("the transcript holds at most {int} rows", async function (this: OlaiWorld, most: number) {
  await this.waitUntil(
    async () => (await transcriptRows(this)) <= most,
    `the transcript to hold at most ${most} rows`,
    HYDRATION_TIMEOUT,
  );
});

const SLOW_BYTES_PER_SECOND = 16 * 1024;

When("I throttle the network", async function (this: OlaiWorld) {
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", (client) => {
    const server = client.connectToServer();
    client.onMessage((message) => server.send(message));
    let freeAt = 0;
    server.onMessage((message) => {
      const body = typeof message === "string" ? message : message.toString("utf8");
      const now = Date.now();
      const start = Math.max(now, freeAt);
      freeAt = start + (Buffer.byteLength(body) / SLOW_BYTES_PER_SECOND) * 1000;
      setTimeout(() => {
        try { client.send(message) } catch { }
      }, freeAt - now);
    });
  });
});

When("I record where the transcript scrolls", async function (this: OlaiWorld) {
  await this.chat(CHAT_TRANSCRIPT).evaluate((pane, [transcript, panel]) => {
    const tape: Array<{ top: number; status: string | null }> = [];
    (window as unknown as { __transcriptScrolls: typeof tape }).__transcriptScrolls = tape;
    pane.ownerDocument.addEventListener("scroll", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(transcript)) return;
      tape.push({ top: target.scrollTop, status: target.closest(panel)?.getAttribute("data-status") ?? null });
    }, { capture: true, passive: true });
  }, [CHAT_TRANSCRIPT, CHAT_PANEL] as const);
});

const REPLAY_STOPS = 2;

Then(
  "the transcript did not scroll through the conversation while it was replayed",
  async function (this: OlaiWorld) {
    const tape = await this.chat(CHAT_TRANSCRIPT).evaluate(() =>
      (window as unknown as { __transcriptScrolls?: Array<{ top: number; status: string | null }> })
        .__transcriptScrolls ?? []
    );
    const during = [...new Set(tape.filter((at) => at.status === "booting" && at.top > 0).map((at) => at.top))];
    assert.ok(
      during.length <= REPLAY_STOPS,
      `the transcript followed the replay down the screen — it stopped at ${during.length} ` +
        `positions while the conversation was still opening: ${JSON.stringify(during)}`,
    );
  },
);

When(
  "the conversation {string} is gone from the agent",
  function (this: OlaiWorld, id: string) {
    fs.writeFileSync(path.join(this.scratch(), `.agent-forgot-${id}`), "");
  },
);

Given("the listing counter is armed", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), ".agent-list-asks"), "");
});

const listAsks = (scratch: string): number => {
  try {
    return fs
      .readFileSync(path.join(scratch, ".agent-list-asks"), "utf8")
      .trim()
      .split("\n")
      .filter((line) => line !== "").length;
  } catch (failure) {
    if ((failure as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw failure;
  }
};

When("the list-asks so far are counted", function (this: OlaiWorld) {
  this.notedListAsks = listAsks(this.scratch());
});

const loadedSessions = (scratch: string): ReadonlyArray<string> => {
  try {
    return fs
      .readFileSync(path.join(scratch, MARKER.loads), "utf8")
      .trim()
      .split("\n")
      .filter((line) => line !== "");
  } catch (failure) {
    if ((failure as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw failure;
  }
};

Given("the agent notes every conversation it loads", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.loads), "");
});

const boundSession = (world: OlaiWorld, node: string, file: string): string => {
  const id = world.nodeId(node);
  const row = world.servedNodes(file).find((one) => one.id === id);
  assert.ok(row, `no node "${node}" in ${file}`);
  const binding = (row.custom as Record<string, unknown> | undefined)?.["chat-agent-session"];
  assert.equal(typeof binding, "string", `node "${node}" names no conversation`);
  const at = String(binding).indexOf(":");
  assert.ok(at > 0, `node "${node}" binding is not engine:session — ${String(binding)}`);
  return String(binding).slice(at + 1);
};

Then(
  "the agent has loaded the conversation on node {string} in {string} without a browser",
  async function (this: OlaiWorld, node: string, file: string) {
    const session = boundSession(this, node, file);
    await this.waitUntil(
      async () => loadedSessions(this.scratch()).includes(session),
      `the agent to be asked for session ${session} before any page opened it`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the agent has not loaded the conversation on node {string} in {string}",
  function (this: OlaiWorld, node: string, file: string) {
    const session = boundSession(this, node, file);
    assert.ok(
      !loadedSessions(this.scratch()).includes(session),
      `the agent was asked for session ${session} after all`,
    );
  },
);

When(
  "I move node {string} in {string} to the trash on disk",
  function (this: OlaiWorld, node: string, file: string) {
    const id = this.nodeId(node);
    const rows = this.servedNodes(file);
    const leaving = rows.filter((row) => row.id === id);
    assert.ok(leaving.length > 0, `no node "${node}" in ${file}`);
    this.writeServed(file, rows.filter((row) => row.id !== id).map((row) => JSON.stringify(row)).join("\n"));
    this.writeServed(
      "_olai/Trash.olai",
      [...this.servedNodesSoFar("_olai/Trash.olai"), ...leaving.map(({ parent: _parent, ...row }) => row)]
        .map((row) => JSON.stringify(row)).join("\n"),
    );
  },
);

When("I set the plugin {string} {word} on disk", function (this: OlaiWorld, plugin: string, state: string) {
  const file = path.join(this.scratch(), "_olai/Settings.olai");
  const rows: Array<Record<string, unknown>> = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
    : [];
  let row = rows.find((one) => one.title === plugin);
  if (row === undefined) {
    row = { id: `settings-${plugin}`, ord: "a9999", title: plugin };
    rows.push(row);
  }
  row.custom = { ...(row.custom as Record<string, unknown> | undefined), on: state === "on" ? "yes" : "no" };
  this.writeServed("_olai/Settings.olai", rows.map((one) => JSON.stringify(one)).join("\n"));
});


Then("the list-asks have not grown", function (this: OlaiWorld) {
  if (this.notedListAsks === null) {
    throw new Error("nothing was counted — pair this with `the list-asks so far are counted`");
  }
  assert.equal(listAsks(this.scratch()), this.notedListAsks);
});

When(
  "the agent refuses to {word} a conversation",
  function (this: OlaiWorld, verb: string) {
    fs.writeFileSync(path.join(this.scratch(), `.agent-refuse-${verb}`), "");
  },
);

When("the agent advertises nothing about itself", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.saysNothing), "");
});

When("the next conversation load will hang", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.holdLoad), "");
});

When("the next agent boot will hang", function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.holdOpen), "");
});

When(
  "the agent will {word} a conversation again",
  function (this: OlaiWorld, verb: string) {
    fs.rmSync(path.join(this.scratch(), `.agent-refuse-${verb}`), { force: true });
  },
);

When(
  "the agent's pinned model becomes {string}",
  function (this: OlaiWorld, model: string) {
    fs.writeFileSync(path.join(this.scratch(), ".agent-pin"), model);
  },
);

When("I cancel the turn", async function (this: OlaiWorld) {
  const cancel = this.chat(CHAT_CANCEL);
  await cancel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await cancel.click();
});

const transcriptText = async (world: OlaiWorld): Promise<string> => {
  const pane = world.chat(CHAT_TRANSCRIPT);
  if ((await pane.count()) === 0) return "";
  return oneLine(await pane.innerText());
};

Then(
  "the chat eventually shows {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await transcriptText(this)).includes(text),
      `the chat to say "${text}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then("the chat still shows {string}", async function (this: OlaiWorld, text: string) {
  const said = await transcriptText(this);
  assert.ok(
    said.includes(text),
    `the chat no longer says "${text}" — the gesture that answered with ` +
      "nothing reached something it should never touch",
  );
});

Then(
  "the chat does not yet show {string}",
  async function (this: OlaiWorld, text: string) {
    assert.ok(
      !(await transcriptText(this)).includes(text),
      `the chat already says "${text}" — the late growth this scenario is ` +
        "about landed before the open-jump was observed, so the second " +
        "assertion would not be testing growth after open",
    );
  },
);

Then(
  "the agent's answer mentions {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await transcriptText(this)).includes(text),
      `the agent to mention "${text}"`,
    );
  },
);

const answerLink = (world: OlaiWorld, text: string): Locator =>
  world.chat(`${CHAT_SAID} a`).filter({ hasText: text }).first();

When(
  "I follow the link {string} in the agent's answer",
  async function (this: OlaiWorld, text: string) {
    await this.press(answerLink(this, text));
  },
);

When(
  "I alt-click the link {string} in the agent's answer",
  async function (this: OlaiWorld, text: string) {
    await this.press(answerLink(this, text), "click", ["Alt"]);
  },
);

const myMessage = (world: OlaiWorld, text: string): Locator =>
  world.chat(CHAT_MINE).filter({ hasText: text });

Then(
  "the chat shows my message {string}",
  async function (this: OlaiWorld, text: string) {
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the chat does not show my message {string}",
  async function (this: OlaiWorld, text: string) {
    assert.strictEqual(
      await myMessage(this, text).count(),
      0,
      `"${text}" is in a message bubble as if a person typed it`,
    );
  },
);

Then(
  "the chat shows my message {string} exactly once",
  async function (this: OlaiWorld, text: string) {
    await myMessage(this, text).first().waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
    assert.strictEqual(
      await myMessage(this, text).count(),
      1,
      `"${text}" is in the transcript more than once — it was delivered twice`,
    );
  },
);

Then(
  "the agent has answered {string} exactly once",
  async function (this: OlaiWorld, text: string) {
    const said = this.chat(CHAT_SAID).filter({ hasText: text });
    await said.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.page.waitForTimeout(700);
    assert.strictEqual(
      await said.count(),
      1,
      `the agent answered "${text}" more than once — the prompt went out twice`,
    );
  },
);

Then("my message sits to the right of the agent's", async function (this: OlaiWorld) {
  const mine = await this.box(
    this.chat(CHAT_MINE).first(),
    "my message",
  );
  const said = await this.box(
    this.chat(CHAT_SAID).first(),
    "the agent's answer",
  );
  const pane = await this.box(
    this.chat(CHAT_TRANSCRIPT),
    "the transcript",
  );
  assert.ok(
    mine.x > said.x,
    `my message starts at ${mine.x}, the agent's at ${said.x} — they should not share a left edge`,
  );
  const left = mine.x - pane.x;
  const right = pane.x + pane.width - (mine.x + mine.width);
  assert.ok(
    left > right,
    `my message has ${left}px of pane on its left and ${right}px on its right — it should sit on the right`,
  );
});

Then("the agent is working", async function (this: OlaiWorld) {
  await this.expectAttribute(this.chatSelector(CHAT_PANEL),
    "data-status",
    "thinking",
    "the conversation",
  );
});

Then(
  "the panel says it is busy, with {string}",
  async function (this: OlaiWorld, what: string) {
    const busy = this.chat(CHAT_BUSY);
    await busy.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => oneLine(await busy.innerText()).includes(what),
      `the busy line to say "${what}"`,
    );
  },
);

Then("the panel does not say it is busy", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_BUSY).count()) === 0,
    "the busy line to go away",
    HYDRATION_TIMEOUT,
  );
});

Then("the agent is idle", async function (this: OlaiWorld) {
  await this.expectAttribute(
    this.chatSelector(`${CHAT_PANEL}${attr("data-pending-sends", "0")}`),
    "data-status",
    "idle",
    "the conversation",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat input takes typing", async function (this: OlaiWorld) {
  const input = this.chat(CHAT_INPUT);
  assert.ok(
    await input.isEnabled(),
    "the composer is turned off while the agent works. A person watching a " +
      "turn has the next message ready long before it ends, and a box that " +
      "is not there is a thought they have to hold in their head.",
  );
});

Then("the chat input still has the caret", async function (this: OlaiWorld) {
  const focused = await this.page.evaluate(
    (id) => document.activeElement?.getAttribute("data-testid") === id,
    PLUGIN_TESTID.chatInput,
  );
  assert.ok(
    focused,
    "the caret left the composer, so sending a second message means reaching " +
      "for the mouse first",
  );
});

const myRow = (world: OlaiWorld, text: string): Locator =>
  world.chat(CHAT_ENTRY)
    .filter({ has: world.page.locator(CHAT_MINE, { hasText: text }) });

const deliverySaid = (world: OlaiWorld, text: string, fate: string): Locator =>
  myRow(world, text).locator(attr("data-delivery", fate));

Then(
  "the chat shows my message {string} as {string}",
  async function (this: OlaiWorld, text: string, fate: string) {
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await deliverySaid(this, text, fate).count()) > 0,
      `"${text}" to be marked ${fate}`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the chat eventually shows my message {string} as {string}",
  { timeout: STEER_DEADLINE_STEP_TIMEOUT },
  async function (this: OlaiWorld, text: string, fate: string) {
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await deliverySaid(this, text, fate).count()) > 0,
      `"${text}" to be marked ${fate}`,
      STEER_DEADLINE_TIMEOUT,
    );
  },
);

Then(
  "the strip under my message {string} reads {string}",
  async function (this: OlaiWorld, text: string, said: string) {
    const strip = myRow(this, text).locator(CHAT_DELIVERY);
    await strip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await strip.innerText()).includes(said),
      `the strip under "${text}" says "${oneLine(await strip.innerText())}", not "${said}"`,
    );
  },
);

Then(
  "the chat shows my message {string} as waiting",
  async function (this: OlaiWorld, text: string) {
    await myMessage(this, text).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await myRow(this, text).locator(CHAT_QUEUED).count()) > 0,
      `"${text}" to be marked as waiting its turn`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "my message {string} is no longer waiting",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await myRow(this, text).locator(CHAT_QUEUED).count()) === 0,
      `"${text}" to stop saying it is waiting`,
      HYDRATION_TIMEOUT,
    );
  },
);

When("I send the undelivered message again", async function (this: OlaiWorld) {
  await this.press(this.chat(CHAT_RESEND).first());
});

Then("the chat offers no way to send it again", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.chat(CHAT_RESEND).count(),
    0,
    "a `send again` button is drawn under a message nothing ever answered about",
  );
});

Then("no message is marked undelivered", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_DELIVERY).count()) === 0,
    "the undelivered mark to come off",
    HYDRATION_TIMEOUT,
  );
});

Then("the header says the agent is working", async function (this: OlaiWorld) {
  await this.chat(CHAT_WORKING)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the header has stopped saying the agent is working",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.chat(CHAT_WORKING).count()) === 0,
      "the header to stop saying the agent is working",
      HYDRATION_TIMEOUT,
    );
  },
);

When("I close the agent fold", async function (this: OlaiWorld) {
  assert.ok(this.activeAgent);
  await returnToOutline(this, this.activeAgent);
  await this.page.locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", this.nodeId(this.activeAgent))}`).click();
  await this.chat(CHAT_PANEL).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
When("I open the agent fold again", async function (this: OlaiWorld) {
  assert.ok(this.activeAgent);
  await returnToOutline(this, this.activeAgent);
  await openFold(this, this.activeAgent);
});

Then("the chat says the turn was cancelled", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await transcriptText(this)).includes("cancelled"),
    "the chat to report the cancellation",
  );
});

Then("the chat says it once", async function (this: OlaiWorld) {
  const cancelled = this.chat(CHAT_ENTRY)
    .filter({ hasText: "cancelled" })
    .filter({ hasNot: this.chat(CHAT_MINE) });
  assert.strictEqual(
    await cancelled.count(),
    1,
    "the chat reported one press of cancel more than once",
  );
});

const scrollOf = (world: OlaiWorld) =>
  world.chat(CHAT_TRANSCRIPT).evaluate((pane) => ({
    fromBottom: pane.scrollHeight - pane.scrollTop - pane.clientHeight,
    overflow: pane.scrollHeight - pane.clientHeight,
  }));

Then(
  "the transcript is scrolled to the newest line",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => {
        const at = await scrollOf(this);
        return at.overflow > 0 && at.fromBottom < NEAR;
      },
      "the transcript to be following the newest line",
      HYDRATION_TIMEOUT,
    );
  },
);

When("I scroll the transcript to the top", async function (this: OlaiWorld) {
  await this.chat(CHAT_TRANSCRIPT)
    .evaluate((pane) => {
      pane.scrollTop = 0;
    });
  await this.waitUntil(
    async () => (await scrollOf(this)).fromBottom > NEAR,
    "the transcript to be scrolled away from the bottom",
  );
});

Then(
  "the transcript has stayed where I left it",
  async function (this: OlaiWorld) {
    const at = await scrollOf(this);
    assert.ok(
      at.fromBottom > NEAR,
      "the panel scrolled a reader who had deliberately scrolled away back to " +
        "the newest token. Being yanked out of what the agent did two turns " +
        "ago is worse than a panel that never scrolled at all.",
    );
  },
);

Then("the chat shows a refusal", async function (this: OlaiWorld) {
  await this.chat(CHAT_REFUSAL)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat refusal says {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => {
      const line = this.chat(CHAT_REFUSAL).first();
      return (await line.count()) > 0 && (await line.innerText()).includes(said);
    },
    `the chat refusal to say ${JSON.stringify(said)}`,
  );
});

Then("the chat refusal does not say {string}", async function (this: OlaiWorld, unsaid: string) {
  const text = await this.chat(CHAT_REFUSAL).first().innerText();
  assert.ok(!text.includes(unsaid), `the chat refusal says ${JSON.stringify(unsaid)}: ${JSON.stringify(text)}`);
});

Then("the chat shows no refusal", async function (this: OlaiWorld) {
  const refusals = await this.chat(CHAT_REFUSAL).allInnerTexts();
  assert.deepStrictEqual(
    refusals,
    [],
    `expected no chat refusals; found: ${JSON.stringify(refusals)}`,
  );
});

const question = (world: OlaiWorld) => world.chat(CHAT_ASK).first();

Then("the chat shows a question", async function (this: OlaiWorld) {
  await question(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(
    async () => (await question(this).getAttribute("data-asking")) === "true",
    "the question to be waiting for an answer",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat shows no question", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.chat(CHAT_ASK).count(),
    0,
    "the panel asked a person about something it is supposed to answer itself",
  );
});

Then(
  "the question offers {string}",
  async function (this: OlaiWorld, value: string) {
    await question(this)
      .locator(`${CHAT_ASK_CHOICE}${attr("data-value", value)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When("I choose {string}", async function (this: OlaiWorld, label: string) {
  await question(this)
    .locator(CHAT_ASK_CHOICE, { hasText: label })
    .first()
    .click();
});

When(
  "I type {string} into the question's other box",
  async function (this: OlaiWorld, text: string) {
    await question(this)
      .locator(`${CHAT_ASK_TEXT}[data-field$="_custom"]`)
      .fill(text);
  },
);

When(
  "I type {string} into the question's {string} box",
  async function (this: OlaiWorld, text: string, field: string) {
    await question(this)
      .locator(`${CHAT_ASK_TEXT}${attr("data-field", field)}`)
      .fill(text);
  },
);

Then(
  "the question's {string} box still reads {string}",
  async function (this: OlaiWorld, field: string, text: string) {
    const box = question(this).locator(`${CHAT_ASK_TEXT}${attr("data-field", field)}`);
    assert.strictEqual(
      await box.inputValue(),
      text,
      "the panel threw away what was typed on a submit the server refused. The " +
        "refusal deliberately leaves the question waiting so nothing is " +
        "recorded that the agent was never sent — a blank form under it makes " +
        "typing the whole answer again the only way to act on it.",
    );
  },
);

When("I answer the question", async function (this: OlaiWorld) {
  await question(this).locator(CHAT_ASK_SUBMIT).click();
});

When("I dismiss the question", async function (this: OlaiWorld) {
  await question(this).locator(CHAT_ASK_DISMISS).click();
});

Then("the question has been answered", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await question(this).getAttribute("data-how")) === "answered",
    "the question to record that it was answered",
    HYDRATION_TIMEOUT,
  );
});

Then("the question says I dismissed it", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await question(this).getAttribute("data-how")) === "declined",
    "the question to record that it was dismissed",
    HYDRATION_TIMEOUT,
  );
  assert.match(
    oneLine(await question(this).locator(CHAT_ASK_OUTCOME).innerText()),
    /dismissed/,
    "the row does not say what became of the question, so a reader scrolling " +
      "back cannot tell a dismissal from an answer nobody remembers giving",
  );
});

Then(
  "the question shows {string} as what I chose",
  async function (this: OlaiWorld, value: string) {
    await this.expectAttribute(
      `${CHAT_ASK} ${CHAT_ASK_CHOICE}${attr("data-value", value)}`,
      "aria-pressed",
      "true",
      `the chosen option "${value}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the question can no longer be answered",
  async function (this: OlaiWorld) {
    assert.strictEqual(
      await question(this).locator(CHAT_ASK_SUBMIT).count(),
      0,
      "an answered question still offers a submit, so it can be answered again",
    );
    const live = await question(this)
      .locator(CHAT_ASK_CHOICE)
      .evaluateAll((chips) =>
        chips.filter((chip) => !(chip as HTMLButtonElement).disabled).length
      );
    assert.strictEqual(
      live,
      0,
      "an answered question still has live options, so what it records could " +
        "be changed under the answer that was already sent",
    );
  },
);

Then(
  "the question says the agent took it back",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await question(this).getAttribute("data-how")) === "withdrawn",
      "the question to record that it was withdrawn",
      HYDRATION_TIMEOUT,
    );
    assert.strictEqual(
      await question(this).locator(CHAT_ASK_SUBMIT).count(),
      0,
      "a question nobody is waiting on any more can still be answered, so the " +
        "button does nothing and pressing it is how you find out",
    );
  },
);

Then(
  "the composer says the agent is waiting on me",
  async function (this: OlaiWorld) {
    await this.chat(CHAT_WAITING)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the composer has stopped saying the agent is waiting on me",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.chat(CHAT_WAITING).count()) === 0,
      "the composer to stop saying the agent is waiting",
      HYDRATION_TIMEOUT,
    );
  },
);

Then("the chat shows a completed tool call", async function (this: OlaiWorld) {
  await this.expectAttribute(this.chatSelector(CHAT_TOOL),
    "data-tool-status",
    "completed",
    "the tool call frame",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat shows a failed tool call", async function (this: OlaiWorld) {
  await this.expectAttribute(this.chatSelector(CHAT_TOOL),
    "data-tool-status",
    "failed",
    "the tool call frame",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the tool call's detail mentions {string}",
  async function (this: OlaiWorld, said: string) {
    const detail = heldTool(this).locator(CHAT_TOOL_DETAIL);
    await detail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await detail.innerText()).includes(said),
      `the tool call's detail does not mention "${said}"`,
    );
  },
);

Then(
  "the tool call says nothing of {string}",
  async function (this: OlaiWorld, said: string) {
    const tool = heldTool(this);
    await tool.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = await tool.innerText();
    assert.ok(
      !shown.includes(said),
      `the tool call shows ${JSON.stringify(said)}; it reads: ${shown}`,
    );
  },
);

Then("the tool call does not scroll sideways", async function (this: OlaiWorld) {
  await heldTool(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.deepStrictEqual(await panned(this, [CHAT_TOOL]), [],
    "these boxes in the call have a horizontal scrollbar");
});

Then(
  "the chat shows {int} tool call(s)",
  async function (this: OlaiWorld, many: number) {
    const calls = this.chat(CHAT_TOOL);
    await this.waitUntil(
      async () => (await calls.count()) === many,
      `the chat to show ${many} tool call(s)`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the chat shows {int} failed tool call(s)",
  async function (this: OlaiWorld, many: number) {
    const failed = this.chat(`${CHAT_TOOL}${attr("data-tool-status", "failed")}`);
    await this.waitUntil(
      async () => (await failed.count()) === many,
      `the chat to show ${many} failed tool call(s)`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the chat shows a tool call named {string}",
  async function (this: OlaiWorld, named: string) {
    await saysThat(this, `${CHAT_TOOL} ${CHAT_TOOL_FOLD}`, named, "call's line");
  },
);

Then("the chat shows a running tool call", async function (this: OlaiWorld) {
  await this.expectAttribute(this.chatSelector(CHAT_TOOL),
    "data-tool-status",
    "in_progress",
    "the tool call frame",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat is streaming an answer", async function (this: OlaiWorld) {
  await this.chat(CHAT_ENTRY_STREAMING)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat is not streaming", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_ENTRY_STREAMING).count()) === 0,
    "the answer to stop growing",
    HYDRATION_TIMEOUT,
  );
});

const heldTool = (world: OlaiWorld) => world.chat(CHAT_TOOL).first();

When("I unfold the tool call", async function (this: OlaiWorld) {
  await heldTool(this).locator(CHAT_TOOL_FOLD).click();
});

Then(
  "the spawn's fold carries {string}",
  async function (this: OlaiWorld, said: string) {
    const report = heldTool(this).locator(CHAT_TOOL_REPORT);
    await report.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await report.innerText()).includes(said),
      `the spawn's fold does not carry "${said}"`,
    );
  },
);

Then(
  "the tool call is reporting {string}",
  async function (this: OlaiWorld, said: string) {
    await this.waitUntil(
      async () => {
        const progress = heldTool(this).locator(CHAT_TOOL_PROGRESS);
        return (await progress.count()) > 0 &&
          oneLine(await progress.innerText()).includes(said);
      },
      `the running tool call to report "${said}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the tool call says where it is working",
  async function (this: OlaiWorld) {
    const shown = heldTool(this).locator(CHAT_TOOL_LOCATIONS);
    await shown.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.match(
      oneLine(await shown.innerText()),
      /house\.olai:12/,
      "the follow-along location is what lets a reader see WHICH file an agent " +
        "is in without unfolding anything",
    );
  },
);

Then("the tool call's detail is shown", async function (this: OlaiWorld) {
  await heldTool(this)
    .locator(CHAT_TOOL_DETAIL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the tool call's reply says {string}",
  async function (this: OlaiWorld, said: string) {
    const detail = heldTool(this).locator(CHAT_TOOL_REPLY);
    await detail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const shown = oneLine(await detail.innerText());
    assert.ok(
      shown.includes(said),
      `the tool call's reply does not mention "${said}"; it says: ${shown}`,
    );
  },
);

const MARK = "__olaiSameElement";

const mark = (locator: Locator): Promise<void> =>
  locator.evaluate((element, key) => {
    (element as unknown as Record<string, unknown>)[key] = true;
  }, MARK);

const marked = (locator: Locator): Promise<boolean> =>
  locator.evaluate(
    (element, key) => (element as unknown as Record<string, unknown>)[key] === true,
    MARK,
  );

const streamingAnswer = (world: OlaiWorld) =>
  world.chat(CHAT_ENTRY_STREAMING).first();

When("I mark the tool call's element", async function (this: OlaiWorld) {
  await mark(heldTool(this));
});

When("I mark the streaming answer's element", async function (this: OlaiWorld) {
  await mark(streamingAnswer(this));
});

Then("the answer has grown", async function (this: OlaiWorld) {
  const before = (await streamingAnswer(this).innerText()).length;
  await this.waitUntil(
    async () => (await streamingAnswer(this).innerText()).length > before,
    "the streaming answer to take another chunk",
  );
});

Then(
  "the streaming answer is the element I marked",
  async function (this: OlaiWorld) {
    assert.ok(
      await marked(streamingAnswer(this)),
      "the answer was drawn again from scratch when the next chunk arrived. A " +
        "paragraph rebuilt per token loses the reader's selection and the " +
        "scroll position several times a second — the row is meant to be " +
        "patched in place.",
    );
  },
);

Then("the tool call is the element I marked", async function (this: OlaiWorld) {
  assert.ok(
    await marked(heldTool(this)),
    "the tool call was drawn again from scratch when its status changed. A row " +
      "rebuilt on every update throws away everything it owns — an unfolded " +
      "detail, a selection, the scroll position — while the reader is looking " +
      "at it. Rows are keyed by id and read their value lazily so that an " +
      "update patches them in place.",
  );
});

const shownDiff = (world: OlaiWorld) => world.chat(CHAT_DIFF).first();

Then(
  "the chat shows a diff of {string}",
  async function (this: OlaiWorld, file: string) {
    await this.chat(`${CHAT_DIFF}${attr("data-path", file)}`)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the chat shows {int} diffs of {string}",
  async function (this: OlaiWorld, many: number, file: string) {
    const boxes = this.chat(`${CHAT_DIFF}${attr("data-path", file)}`);
    await this.page.waitForFunction(
      ([selector, wanted]) =>
        document.querySelectorAll(selector as string).length === wanted,
      [`${CHAT_DIFF}${attr("data-path", file)}`, many] as const,
      { timeout: HYDRATION_TIMEOUT },
    );
    assert.strictEqual(
      await boxes.count(),
      many,
      `the panel drew a different number of boxes for "${file}" than the ${many} ` +
        "blocks the agent sent. An edit reported as several hunks is several " +
        "changes to one file, and each of them is a row",
    );
  },
);

Then("the chat shows no diff", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.chat(CHAT_DIFF).count(),
    0,
    "an olai write drew a text diff. A `.olai` diff is one enormous line per " +
      "node with everything on it changing at once — the panel's job for a " +
      "write is the node-level story, and this is the rule that says so",
  );
});

Then("the diff is trimmed", async function (this: OlaiWorld) {
  const rows = await shownDiff(this).locator(CHAT_DIFF_LINE).count();
  const whole = oneLine(await shownDiff(this).locator(CHAT_DIFF_EXPAND).innerText());
  assert.match(
    whole,
    /more lines/,
    `the diff drew all ${rows} of its rows; a turn that rewrote four files ` +
      "would bury the conversation it belongs to",
  );
});

When("I expand the diff", async function (this: OlaiWorld) {
  await shownDiff(this).locator(CHAT_DIFF_EXPAND).click();
});

Then("the diff is expanded", async function (this: OlaiWorld) {
  await this.expectAttribute(this.chatSelector(CHAT_DIFF),
    "data-expanded",
    "true",
    "the diff",
    POLL_TIMEOUT,
  );
});

const panned = (world: OlaiWorld, selectors: ReadonlyArray<string>) =>
  world.page.evaluate((sels: string[]) => {
    const over = (node: Element): boolean => {
      const ox = getComputedStyle(node).overflowX;
      return (ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 1;
    };
    const out: Array<string> = [];
    for (const sel of sels) {
      const root = document.querySelector(sel);
      if (root === null) {
        out.push(`${sel} missing`);
        continue;
      }
      for (const node of [root, ...root.querySelectorAll("*")]) {
        if (over(node)) {
          out.push(`${node.tagName.toLowerCase()}${node.getAttribute("data-testid") ?? ""} ${node.scrollWidth}>${node.clientWidth}`);
        }
      }
    }
    return out;
  }, [...selectors]);

Then("the diff does not scroll sideways", async function (this: OlaiWorld) {
  await shownDiff(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.deepStrictEqual(await panned(this, [CHAT_DIFF, CHAT_PANEL]), [],
    "these boxes have a horizontal scrollbar");
});

Then("a wrapped diff line keeps its gutter", async function (this: OlaiWorld) {
  const box = shownDiff(this);
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const geometry = await box.evaluate(
    (root, ids) => {
      const of = (kind: string): ReadonlyArray<Element> =>
        [...root.querySelectorAll(`${ids.line}[data-kind="${kind}"]`)];

      const check = (el: Element, kind: string): { ok: true } | { ok: false; why: string } => {
        const gutter = el.querySelector(ids.gutter);
        const mark = el.querySelector(ids.mark);
        const text = el.querySelector(ids.text);
        if (gutter === null || mark === null || text === null) {
          return { ok: false, why: `a ${kind} row is missing a gutter, a marker or its text` };
        }
        const gutterBox = gutter.getBoundingClientRect();
        const markBox = mark.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(text);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        const under = rects.filter((r) => r.left + 0.5 < markBox.right);
        if (under.length > 0) {
          return {
            ok: false,
            why:
              `a ${kind} row has ${under.length} fragment(s) starting at ` +
              `x=${Math.round(under[0]!.left)}, under the marker which ends at ${Math.round(markBox.right)}`,
          };
        }
        const starts = new Map<number, number>();
        for (const r of rects) {
          const key = Math.round(r.top);
          const prev = starts.get(key);
          starts.set(key, prev === undefined ? r.left : Math.min(prev, r.left));
        }
        const lineLefts = [...starts.values()];
        if (lineLefts.length < 2) {
          return {
            ok: false,
            why: `a ${kind} line sat on ${lineLefts.length} visual row(s); a long line that did not wrap cannot speak for the gutter`,
          };
        }
        const drift = Math.max(...lineLefts) - Math.min(...lineLefts);
        if (drift > 1) {
          return {
            ok: false,
            why: `a ${kind} row's wrapped lines drift ${Math.round(drift)}px — the continuation slid toward the gutter`,
          };
        }
        const contentLeft = Math.min(...lineLefts);
        if (contentLeft + 0.5 < gutterBox.right) {
          return {
            ok: false,
            why: `a ${kind} row's content starts at x=${Math.round(contentLeft)}, under the gutter which ends at ${Math.round(gutterBox.right)}`,
          };
        }
        return { ok: true };
      };

      for (const kind of ["add", "remove", "same"] as const) {
        const wrapping = of(kind).filter((row) => {
          const text = row.querySelector(ids.text);
          if (text === null) return false;
          const range = document.createRange();
          range.selectNodeContents(text);
          const tops = new Set(
            [...range.getClientRects()]
              .filter((r) => r.width > 0 && r.height > 0)
              .map((r) => Math.round(r.top)),
          );
          return tops.size >= 2;
        });
        if (wrapping.length === 0) {
          return {
            ok: false as const,
            why: `no wrapping ${kind} row; the fixture must pin the gutter on every kind, not only additions`,
          };
        }
        for (const row of wrapping) {
          const result = check(row, kind);
          if (!result.ok) return { ok: false as const, why: result.why };
        }
      }
      return { ok: true as const, why: "" };
    },
    { line: CHAT_DIFF_LINE, gutter: CHAT_DIFF_GUTTER, mark: CHAT_DIFF_MARK, text: CHAT_DIFF_TEXT },
  );
  assert.ok(geometry.ok, geometry.why);
});

Then(
  "the diff shows the line {string} as added",
  async function (this: OlaiWorld, text: string) {
    const added = shownDiff(this).locator(`${CHAT_DIFF_LINE}[data-kind="add"]`);
    await this.waitUntil(
      async () => {
        const rows = await added.allInnerTexts();
        return rows.some((row) => oneLine(row).includes(text));
      },
      `the diff to show "${text}" as an added line`,
      POLL_TIMEOUT,
    );
  },
);

Then(
  "the chat says the write {string}",
  async function (this: OlaiWorld, said: string) {
    const wrote = this.chat(OUTLINES_STORY).first();
    await wrote.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = oneLine(await wrote.innerText());
    assert.ok(
      shown.includes(said),
      `the write's story does not say "${said}"; it says: ${shown}`,
    );
  },
);

Then(
  "the chat shows the outline {string} changing",
  async function (this: OlaiWorld, file: string) {
    await this.chat(`${CHAT_OUTLINE_DIFF}${attr("data-path", file)}`)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the outline change says {string}",
  async function (this: OlaiWorld, said: string) {
    const row = this.chat(CHAT_OUTLINE_CHANGE).first();
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = oneLine(await row.innerText());
    assert.ok(
      shown.includes(said),
      `the outline's change does not say "${said}"; it says: ${shown}`,
    );
  },
);

Then("the diff says it was rewritten whole", async function (this: OlaiWorld) {
  await this.chat(CHAT_DIFF_WHOLESALE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the write's nudge says {string}",
  async function (this: OlaiWorld, said: string) {
    const nudge = this.chat(OUTLINES_NUDGE).first();
    await nudge.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = oneLine(await nudge.innerText());
    assert.ok(
      shown.includes(said),
      `the write's nudge does not mention "${said}"; it says: ${shown}`,
    );
  },
);

Then("the tool call's detail is folded away", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.chat(CHAT_TOOL_DETAIL).count(),
    0,
    "a tool call's arguments are drawn unfolded; a turn's worth of them would " +
      "bury the conversation they belong to",
  );
});

const entrySelector = (id: string): string => `${CHAT_ENTRY}${attr("data-entry-id", id)}`;

const insetBelow = async (
  world: OlaiWorld,
  spawner: string,
  hanging: Locator,
  what: string,
): Promise<void> => {
  const frame = world.chat(entrySelector(spawner));
  await frame.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const above = await frame.boundingBox();
  const mine = await hanging.boundingBox();
  assert.ok(
    above !== null && mine !== null,
    `neither ${what} nor the call that spawned it was drawn`,
  );
  assert.ok(
    mine.y > above.y,
    `${what} is drawn above the call that spawned it (${mine.y} is not below ` +
      `${above.y})`,
  );
  assert.ok(
    mine.x > above.x,
    `${what} starts at ${mine.x}, level with the call that spawned it at ` +
      `${above.x} — a lane is an INDENT, and a reader who cannot see one is ` +
      "being told a subagent's work was the main agent's",
  );
};

const drawnInALane = async (
  world: OlaiWorld,
  lane: Locator,
  inner: Locator,
  what: string,
  anonymous: string,
): Promise<void> => {
  await lane.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const parent = await lane.getAttribute("data-lane");
  assert.ok(parent !== null && parent !== "", anonymous);
  await insetBelow(world, parent ?? "", inner, what);
};

Then(
  "the call that spawned it is in no lane of its own",
  async function (this: OlaiWorld) {
    const parent = await this.chat(CHAT_LANE_DOOR).first().getAttribute("data-lane");
    assert.ok(parent !== null && parent !== "", "a door that names no agent opens onto nothing");
    const nested = await this.chat(`${CHAT_LANE} ${entrySelector(parent ?? "")}`)
      .count();
    assert.strictEqual(
      nested,
      0,
      `the frame "${parent}" is itself drawn in a lane; the call that spawns a ` +
        "subagent is the main agent's own work",
    );
  },
);

Then(
  "the chat says an agent is working, of the kind {string}",
  async function (this: OlaiWorld, kind: string) {
    const working = this.chat(CHAT_SPAWN_WORKING).first();
    await working.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const spawner = await working.getAttribute("data-lane");
    assert.ok(
      spawner !== null && spawner !== "",
      "a rail that names no agent is an indent, not an attribution",
    );
    const frame = this.chat(entrySelector(spawner ?? ""));
    await frame.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await frame.locator(CHAT_SPAWN).first().getAttribute("data-spawn-kind"),
      kind,
      `the call that spawned an agent does not say it started a "${kind}"`,
    );
    await insetBelow(this, spawner ?? "", working, "the agent that was sent out");
  },
);

Then(
  "the chat still shows a call that sent out an {string}",
  async function (this: OlaiWorld, kind: string) {
    await this.chat(`${CHAT_SPAWN}${attr("data-spawn-kind", kind)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the chat says a background task is watching {string}",
  async function (this: OlaiWorld, watching: string) {
    const armed = this.chat(CHAT_ARMED).first();
    await armed.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      (await armed.textContent())?.includes(watching),
      true,
      `the armed call does not say it is watching "${watching}"`,
    );
    const task = await armed.getAttribute("data-task");
    assert.ok(
      task !== null && task !== "",
      "a background task nobody can name is not one this panel can follow",
    );
  },
);

Then("the chat says that task is still running", async function (this: OlaiWorld) {
  const still = this.chat(CHAT_ARMED_STILL).first();
  await still.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const armed = await still.getAttribute("data-lane");
  assert.ok(
    armed !== null && armed !== "",
    "a rail that names no call is an indent, not an attribution",
  );
  await insetBelow(this, armed ?? "", still, "the task that was armed");
});

Then(
  "the chat says that task ended {string}",
  async function (this: OlaiWorld, ended: string) {
    await this.chat(`${CHAT_ARMED_ENDED}${attr("data-ended", ended)}`)
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the chat shows the harness saying {string}",
  async function (this: OlaiWorld, said: string) {
    await this.waitUntil(
      async () => {
        const shown = await this.chat(CHAT_TOOL_PROGRESS).allTextContents();
        return shown.some((text) => text.includes(said));
      },
      `the panel to show the harness saying "${said}"`,
      HYDRATION_TIMEOUT,
    );
  },
);


Then(
  "the strip says {string} is running",
  async function (this: OlaiWorld, name: string) {
    const task = this.chat(`${CHAT_WATCHING} ${CHAT_WATCHING_TASK}`)
      .filter({ hasText: name })
      .first();
    await task.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const row = await task.getAttribute("data-row");
    assert.ok(
      row !== null && row !== "",
      "a strip that names no row is a second copy of the task, not the same one",
    );
    const said = await task.locator(CHAT_WATCHING_FOR).first().textContent();
    assert.ok(
      secondsSaid(said ?? "") !== null,
      `the strip says it has been running "${said}", which is not a duration`,
    );
  },
);

Then("the call that armed the task is out of sight", async function (this: OlaiWorld) {
  const gone = await this.chat(CHAT_TRANSCRIPT)
    .evaluate((pane, selector) => {
      const row = pane.querySelector(selector);
      if (row === null) return "the arming row is not in the transcript at all";
      const seen = row.getBoundingClientRect();
      const within = pane.getBoundingClientRect();
      return seen.bottom > within.top && seen.top < within.bottom
        ? "the arming row is still on screen"
        : null;
    }, `${CHAT_TOOL}${attr("data-tool-status", "in_progress")}`);
  assert.strictEqual(gone, null, gone ?? "");
});

Then("the newest line says {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => {
      const rows = this.chat(CHAT_ENTRY);
      const last = await rows.count();
      if (last === 0) return false;
      const text = (await rows.nth(last - 1).textContent()) ?? "";
      return text.includes(said);
    },
    `the newest row to say "${said}"`,
    HYDRATION_TIMEOUT,
  );
});

Then("the chat says nothing is running in the background", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_WATCHING).count()) === 0,
    "the background-task strip to clear",
    HYDRATION_TIMEOUT,
  );
});
Then("the chat says no background task is still running", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_ARMED_STILL).count()) === 0,
    "the panel to stop saying a background task is still running",
    HYDRATION_TIMEOUT,
  );
});

Then("the chat says no agent is still working", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_SPAWN_WORKING).count()) === 0,
    "the panel to stop saying an agent is working",
    HYDRATION_TIMEOUT,
  );
});

const secondsSaid = (said: string): number | null => {
  const parts = /^(?=.)(?:(\d+)h )?(?:(\d+)m ?)?(?:(\d+)s)?$/.exec(said.trim());
  if (parts === null) return null;
  const [, hours, minutes, seconds] = parts;
  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
};

Then(
  "the chat says how long a running call has been going",
  async function (this: OlaiWorld) {
    const elapsed = this.chat(CHAT_TOOL_ELAPSED).first();
    await elapsed.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = (await elapsed.textContent()) ?? "";
    assert.ok(
      secondsSaid(said) !== null,
      `the elapsed readout says "${said}", which is not a duration`,
    );
    const timed = this.chat(CHAT_TOOL)
      .filter({ has: this.page.locator(CHAT_TOOL_ELAPSED) });
    assert.strictEqual(
      await timed.count(),
      1,
      "the panel is timing more than one call, or none — this scenario is " +
        "about the single call that is still out",
    );
    const status = await timed.getAttribute("data-tool-status");
    assert.ok(
      status === "pending" || status === "in_progress",
      `a call the wire calls "${status}" is being timed; only a call that has ` +
        "not come back has a duration to draw",
    );
  },
);

Then(
  "the chat still shows a call the wire calls {string}",
  async function (this: OlaiWorld, status: string) {
    await this.chat(`${CHAT_TOOL}${attr("data-tool-status", status)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("that elapsed time is ticking", async function (this: OlaiWorld) {
  const elapsed = this.chat(CHAT_TOOL_ELAPSED).first();
  const first = secondsSaid((await elapsed.textContent()) ?? "") ?? 0;
  await this.waitUntil(
    async () => (secondsSaid((await elapsed.textContent()) ?? "") ?? 0) > first,
    `the elapsed readout to count past ${first}s`,
    POLL_TIMEOUT,
  );
});

Then("the chat times no call", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_TOOL_ELAPSED).count()) === 0,
    "the panel to stop timing any call",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "exactly one lane names itself, as {string}",
  async function (this: OlaiWorld, named: string) {
    const labels = this.chat(CHAT_LANE_LABEL);
    await labels.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await labels.count(),
      1,
      "a lane names itself where it opens and nowhere else — the rail says the " +
        "rest",
    );
    const said = oneLine(await labels.first().innerText());
    assert.ok(
      said.includes(named),
      `the lane says "${said}" rather than naming "${named}"`,
    );
  },
);

const askLane = (world: OlaiWorld) =>
  world.chat(`${CHAT_LANE}:has(${CHAT_ASK})`).first();

Then(
  "the question is drawn in the lane of the agent that asked it",
  async function (this: OlaiWorld) {
    const lane = askLane(this);
    await drawnInALane(
      this,
      lane,
      lane.locator(CHAT_ASK),
      "the question",
      "the form is drawn in the main column, which says the agent you are " +
        "talking to is the one asking — and a permission form is the row " +
        "where believing that changes what somebody decides",
    );
  },
);

Then(
  "the question's lane names itself, as {string}",
  async function (this: OlaiWorld, named: string) {
    const label = askLane(this).locator(CHAT_LANE_LABEL).first();
    await label.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = oneLine(await label.innerText());
    assert.ok(
      said.includes(named),
      `the form's lane says "${said}" rather than naming "${named}"`,
    );
  },
);

Then(
  "no lane introduces itself under the question",
  async function (this: OlaiWorld) {
    const form = await askLane(this).locator(CHAT_ASK).boundingBox();
    const named = await this.chat(CHAT_LANE_LABEL).first().boundingBox();
    assert.ok(form !== null && named !== null, "the form or its lane's name is not drawn");
    assert.ok(
      named.y < form.y,
      `a lane introduces itself at ${named.y}, below the form at ${form.y} — ` +
        "the form broke the run, so the same agent's next call opens a lane " +
        "of its own and one subagent reads as two",
    );
  },
);

Then(
  "the {word} completion is open",
  async function (this: OlaiWorld, kind: string) {
    const panel = this.chat(CHAT_COMPLETION);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await panel.getAttribute("data-kind"), kind);
  },
);

Then("no completion is open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_COMPLETION).count()) === 0,
    "the completion to be gone",
  );
});

Then(
  "the completion offers {string}",
  async function (this: OlaiWorld, value: string) {
    await this.chat(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the completion does not offer {string}",
  async function (this: OlaiWorld, value: string) {
    const text = await (await chatBox(this)).inputValue();
    const armed = completingIn(text, text.length);
    if (armed !== null && armed.kind === "name") {
      await answered(this, CHAT_INPUT, armed.query);
    } else {
      await this.waitForFrame();
    }
    const rows = await this.chat(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`)
      .count();
    assert.strictEqual(
      rows,
      0,
      `the completion offers ${JSON.stringify(value)}`,
    );
  },
);

Then(
  "the completion row {string} reads {string} in {string}",
  async function (this: OlaiWorld, value: string, label: string, hint: string) {
    const row = this.chat(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await row.innerText()), `${label} ${hint}`);
  },
);

Then(
  "the completion block {string} comes before the block {string}",
  async function (this: OlaiWorld, first: string, second: string) {
    await expectBefore(
      this,
      this.chat(CHAT_COMPLETION_SECTION),
      "data-section",
      first,
      second,
    );
  },
);

When("I accept the completion", async function (this: OlaiWorld) {
  await this.chat(CHAT_INPUT).press("Enter");
  await keysSettled(this);
});

When(
  "I click the completion {string}",
  async function (this: OlaiWorld, value: string) {
    await this.chat(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}`)
      .click();
  },
);

Then(
  "the caret in the chat box is at {int}",
  async function (this: OlaiWorld, at: number) {
    await this.waitUntil(
      async () =>
        (await this.chat(CHAT_INPUT)
          .evaluate((box) => (box as HTMLTextAreaElement).selectionStart)) === at,
      `the caret to sit at ${at}`,
    );
  },
);

Then("the caret is in the chat box", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      await this.chat(CHAT_INPUT)
        .evaluate((box) => box === document.activeElement),
    "the caret to be back in the message box",
  );
});

When(
  "I put the caret after {string} in the chat",
  async function (this: OlaiWorld, prefix: string) {
    const box = this.chat(CHAT_INPUT);
    await box.focus();
    await box.evaluate(async (element, wanted) => {
      const field = element as HTMLTextAreaElement;
      const at = field.value.indexOf(wanted);
      if (at === -1) {
        throw new Error(
          `the box holds ${JSON.stringify(field.value)}, which does not contain ${
            JSON.stringify(wanted)
          }`,
        );
      }
      const caret = at + wanted.length;
      if (field.selectionStart === caret && field.selectionEnd === caret) return;
      await new Promise<void>(resolve => {
        field.addEventListener("select", () => resolve(), { once: true });
        field.setSelectionRange(caret, caret);
      });
    }, prefix);
  },
);

When(
  "I press {string} in the chat",
  async function (this: OlaiWorld, key: string) {
    await this.chat(CHAT_INPUT).press(key);
    await keysSettled(this);
  },
);

Then(
  "the chat input reads {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => (await this.chat(CHAT_INPUT).inputValue()) === text,
      `the input to read "${text}"`,
    );
  },
);

Then(
  "the opened conversation carries the title {string}",
  async function (this: OlaiWorld, title: string) {
    await this.waitUntil(
      async () =>
        await this.chat(CHAT_PANEL).getAttribute("data-session-title") === title,
      `the conversation to be titled "${title}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

When("I start a new conversation", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(CHAT_NEW).click();
});

Then("the chat is empty", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_ENTRY).count()) === 0,
    "the transcript to empty",
    HYDRATION_TIMEOUT,
  );
});

When("I open the fold history", async function (this: OlaiWorld) {
  const pill = this.chat(CHAT_SESSIONS);
  await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if (await pill.getAttribute("aria-expanded") !== "true") await pill.click();
});
Then("the panel says something went wrong", async function (this: OlaiWorld) {
  await this.chat(CHAT_TROUBLE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat says nothing went wrong", async function (this: OlaiWorld) {
  assert.strictEqual(await this.chat(CHAT_TROUBLE).count(), 0);
});

Then(
  "the list says {string} could not be asked, with {string}",
  async function (this: OlaiWorld, agent: string, reason: string) {
    const line = this.page.locator(
      `${CHAT_SESSION_UNREACHABLE}${attr("data-agent", agent)}`,
    );
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await line.innerText()).includes(reason),
      `the list to give "${agent}"'s own reason, "${reason}"`,
    );
  },
);

Then("the unassigned list is empty", async function (this: OlaiWorld) {
  assert.strictEqual(await this.chat(CHAT_SESSION).count(), 0);
});

Then("the unassigned list lists {string}", async function (this: OlaiWorld, title: string) {
  await this.chat(CHAT_SESSION, { hasText: title })
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When(
  "I pick the conversation {string}",
  async function (this: OlaiWorld, title: string) {
    await this.chat(CHAT_SESSION, { hasText: title }).first().click();
  },
);

Then(
  "the unassigned list shows {string} under the agent {string}",
  async function (this: OlaiWorld, title: string, agent: string) {
    await this.chat(`${CHAT_SESSION}${attr("data-agent", agent)}`, { hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the unassigned list is grouped under the agent {string}",
  async function (this: OlaiWorld, agent: string) {
    await this.chat(`${CHAT_SESSION_AGENT}${attr("data-agent", agent)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the unassigned list has no headings", async function (this: OlaiWorld) {
  assert.strictEqual(await this.chat(CHAT_SESSION_AGENT).count(), 0);
});

const rowOf = (world: OlaiWorld, title: string): Locator =>
  world.chat(selector(PLUGIN_TESTID.chatPastSession), { hasText: title }).first();

Then(
  "the row for {string} says it has {int} messages",
  async function (this: OlaiWorld, title: string, count: number) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = oneLine(await row.innerText());
    assert.ok(
      said.includes(`${count} messages`),
      `the row for "${title}" to say "${count} messages" — it says: "${said}"`,
    );
  },
);

Then(
  "the row for {string} says it has one message",
  async function (this: OlaiWorld, title: string) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await row.innerText()).includes("1 message"),
      `the row for "${title}" to say "1 message"`,
    );
  },
);

Then(
  "the row for {string} shows no message count",
  async function (this: OlaiWorld, title: string) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      !/\d+ messages?/.test(oneLine(await row.innerText())),
      `the row for "${title}" to show no message count`,
    );
  },
);

Then(
  "the row for {string} was superseded by {string}",
  async function (this: OlaiWorld, title: string, successor: string) {
    const line = rowOf(this, title).locator(CHAT_SESSION_SUPERSEDED).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = oneLine(await line.innerText());
    assert.ok(
      said.includes(successor),
      `the row for "${title}" to name "${successor}" — it says: "${said}"`,
    );
  },
);

Then(
  "the row for {string} was not superseded",
  async function (this: OlaiWorld, title: string) {
    const row = rowOf(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => await row.locator(CHAT_SESSION_SUPERSEDED).count() === 0, "the refreshed listing to omit the missing successor");
  },
);

Then("node {string} is not done", async function (this: OlaiWorld, id: string) {
  const status = await this.node(id).getAttribute("data-status");
  assert.notStrictEqual(
    status,
    "done",
    `node "${id}" is done — a message the agent never received marked it`,
  );
});

Then("node {string} is done", async function (this: OlaiWorld, id: string) {
  await this.expectAttribute(
    nodeSelector(id),
    "data-status",
    "done",
    `node "${id}"`,
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the tree eventually shows a node titled {string}",
  async function (this: OlaiWorld, title: string) {
    await this.waitUntil(
      async () => {
        const titles = await this.page
          .locator(NODE_TITLE)
          .evaluateAll((rows) => rows.map((row) => row.textContent ?? ""));
        return titles.some((each) => oneLine(each) === title);
      },
      `the tree to show a node titled "${title}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the panel header names the model {string}",
  async function (this: OlaiWorld, model: string) {
    await this.waitUntil(
      async () => {
        const header = this.chat(CHAT_MODEL);
        return (await header.count()) > 0 &&
          oneLine(await header.innerText()) === model;
      },
      `the header to name the model "${model}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then("the panel says the conversation could not be opened", async function (this: OlaiWorld) {
  await this.chat(CHAT_UNOPENED)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the panel shows no such refusal", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_UNOPENED).count()) === 0,
    "the refused-conversation face to go",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the refusal is in the agent's own words, {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, CHAT_UNOPENED_WHY, said, "refusal");
  },
);

Then(
  "the panel is waiting for a seat, saying {string}",
  async function (this: OlaiWorld, said: string) {
    const body = this.chat(CHAT_UNOPENED);
    await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => await body.getAttribute("data-cause") === "capacity",
      "the panel to say it is out of seats rather than refused",
      HYDRATION_TIMEOUT,
    );
    await saysThat(this, CHAT_UNOPENED_WHY, said, "refusal");
    assert.strictEqual(await this.chat(CHAT_REOPEN).count(), 0, "a seatless panel drew a retry");
  },
);

Then(
  "the panel says this chat is not on this machine",
  async function (this: OlaiWorld) {
    const body = this.chat(CHAT_UNOPENED);
    await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => await body.getAttribute("data-cause") === "missing",
      "the panel to classify the refusal as a chat this engine does not have",
      HYDRATION_TIMEOUT,
    );
    const words = oneLine(await body.innerText());
    assert.ok(
      words.includes("This chat isn't on this machine."),
      `the missing-chat headline, and the body says ${JSON.stringify(words)}`,
    );
    assert.ok(
      words.includes("no record of it") && words.includes("notes"),
      `the missing-chat body to say the engine has no record and the notes are intact, and it says ${
        JSON.stringify(words)
      }`,
    );
  },
);

Then("the engine's own words are not alarmed", async function (this: OlaiWorld) {
  const why = await this.chat(CHAT_UNOPENED_WHY).evaluate((element) => getComputedStyle(element).color);
  const body = await this.chat(CHAT_UNOPENED).evaluate((element) => getComputedStyle(element).color);
  assert.strictEqual(why, body, "the engine's sentence to be drawn as quietly as the body around it");
});

When("I start a fresh chat from the refusal", async function (this: OlaiWorld) {
  const fresh = this.chat(CHAT_UNOPENED_FRESH);
  await fresh.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await fresh.click();
});

Then("the refusal offers a fresh chat", async function (this: OlaiWorld) {
  await this.chat(CHAT_UNOPENED_FRESH).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the refusal offers no fresh chat", async function (this: OlaiWorld) {
  const body = this.chat(CHAT_UNOPENED);
  await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.chat(CHAT_UNOPENED_FRESH).count(),
    0,
    "a refusal that is not about the node's current chat drew a fresh start",
  );
});

Then("the refusal still offers a retry", async function (this: OlaiWorld) {
  await this.chat(CHAT_REOPEN).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

When("I try to open it again", async function (this: OlaiWorld) {
  const again = this.chat(CHAT_REOPEN);
  await again.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await again.click();
});

Then(
  "the chat says the click was refused, with {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, CHAT_REFUSAL, said, "refused click");
  },
);

Then(
  "the chat says the click was refused, with {string} or {string}",
  async function (this: OlaiWorld, one: string, other: string) {
    await this.waitUntil(
      async () => {
        const line = this.chat(CHAT_REFUSAL).first();
        if ((await line.count()) === 0) return false;
        const text = (await line.innerText()).trim();
        return text.includes(one) || text.includes(other);
      },
      `the refused click to say ${JSON.stringify(one)} or ${JSON.stringify(other)}`,
    );
  },
);

Then("there is nothing to type into", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.chat(CHAT_INPUT).count(),
    0,
    "the composer is drawn with no agent to send to — a box that cannot send " +
      "is worse than the explanation that replaces it",
  );
});

const standingIs = (
  world: OlaiWorld,
  name: string,
  standing: string,
): Promise<void> =>
  world.expectAttribute(
    `${CHAT_SERVER}${attr("data-server", name)}`,
    "data-standing",
    standing,
    `the roster row for "${name}"`,
    HYDRATION_TIMEOUT,
  );

Then(
  "the panel says this conversation has {string}",
  async function (this: OlaiWorld, name: string) {
    await this.expectAttribute(this.chatSelector(CHAT_SERVER),
      "data-server",
      name,
      "this conversation's server list",
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the panel says the agent attached {string}",
  async function (this: OlaiWorld, name: string) {
    await standingIs(this, name, "connected");
  },
);

Then(
  "the panel does not claim the agent attached {string}",
  async function (this: OlaiWorld, name: string) {
    await standingIs(this, name, "handed");
  },
);

Then(
  "the panel says the list is not the whole of it",
  async function (this: OlaiWorld) {
    const said = oneLine(await this.chat(CHAT_ROSTER_OWN).innerText())
      .replace(/[‘’]/g, "'");
    assert.ok(
      said.includes("the agent's own"),
      `the panel lists this conversation's servers without saying that an agent ` +
        `may have servers of its own that olai never handed it — which makes the ` +
        `list a completeness claim olai has no way to make. It reads: ${said}`,
    );
  },
);

Then("the panel says nothing about this conversation's servers", async function (
  this: OlaiWorld,
) {
  assert.strictEqual(
    await this.chat(CHAT_ROSTER).count(),
    0,
    "the panel lists servers for a conversation there is none of — the roster " +
      "is a property of a session, and a list left standing between two of them " +
      "describes a conversation nobody is in",
  );
});

Then(
  "the panel says {string} is missing from this conversation",
  async function (this: OlaiWorld, name: string) {
    await this.expectAttribute(this.chatSelector(CHAT_MISSING_SERVER),
      "data-server",
      name,
      "the strip under the chat header",
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the reason it gives for {string} is {string}",
  async function (this: OlaiWorld, name: string, reason: string) {
    const row = this.chat(`${CHAT_MISSING_SERVER}${attr("data-server", name)}`);
    const said = oneLine(await row.locator(CHAT_MISSING_WHY).innerText());
    assert.ok(
      said.includes(reason),
      `the panel names a missing server without the reason "${reason}", which is ` +
        `the half the feature exists for — a name on its own is the debug log ` +
        `line again, on screen. It reads: ${said}`,
    );
  },
);

Then(
  "the panel says the agent could not attach {string}",
  async function (this: OlaiWorld, name: string) {
    await standingIs(this, name, "unattached");
    await this.expectAttribute(this.chatSelector(CHAT_MISSING_SERVER),
      "data-server",
      name,
      "the sentence under the roster",
      HYDRATION_TIMEOUT,
    );
  },
);

Then("it names the configured executable", async function (this: OlaiWorld) {
  const said = oneLine(
    await this.chat(`${CHAT_MISSING_SERVER}${attr("data-server", "kolu")}`).innerText(),
  );
  assert.ok(
    /\/[^\s]*\/kolu\b/.test(said),
    `the panel does not say WHICH kolu it configured, which is the question the ` +
      `incident behind this feature started from. It reads: ${said}`,
  );
});

Then(
  "the panel says nothing about a missing server",
  async function (this: OlaiWorld) {
    assert.strictEqual(
      await this.chat(CHAT_MISSING).count(),
      0,
      "the panel reports a missing MCP server on a conversation that was given " +
        "every one of them — a complaint a reader cannot act on is one they " +
        "learn to skip on the conversations where it is true",
    );
  },
);

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const TINY_SVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";

const TINY_PDF =
  "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZz4+ZW5kb2JqCnRyYWlsZXI8PC9Sb290IDEgMCBSPj4KJSVFT0YK";

const TINY_TEXT = "bm90ZXM=";

const TINY_MP4 = "AAAAGGZ0eXBtcDQyAAAAAG1wNDJpc29t";

const fileSpec = (name: string): { name: string; data: string; type: string } => {
  if (name.endsWith(".svg")) return { name, data: TINY_SVG, type: "image/svg+xml" };
  if (name.endsWith(".pdf")) return { name, data: TINY_PDF, type: "application/pdf" };
  if (name.endsWith(".txt")) return { name, data: TINY_TEXT, type: "text/plain" };
  if (name.endsWith(".mp4")) return { name, data: TINY_MP4, type: "video/mp4" };
  if (name.endsWith(".mov")) return { name, data: TINY_MP4, type: "video/quicktime" };
  if (name.endsWith(".zip")) return { name, data: TINY_TEXT, type: "application/zip" };
  return { name, data: ONE_PIXEL_PNG, type: "image/png" };
};

const named = (names: string): ReadonlyArray<string> =>
  names.split(",").map((name) => name.trim()).filter((name) => name !== "");

/**
 * Dispatched rather than performed: Playwright cannot put an image on the
 * system clipboard portably and cannot make the desktop drag a real file into
 * a headless browser, so the step builds the event the browser would have
 * built — real `File`s in a real `DataTransfer`, on the real event.
 */
const deliver = async (
  world: OlaiWorld,
  at: PluginTestId,
  files: ReadonlyArray<string>,
  kinds: ReadonlyArray<string>,
  as: "clipboard" | "drag" = "drag",
): Promise<void> => {
  await world.chat(selector(at))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.page.evaluate(
    ({ specs, kinds, at, clipboard }) => {
      const transfer = new DataTransfer();
      for (const spec of specs) {
        const bytes = Uint8Array.from(atob(spec.data), (char) => char.charCodeAt(0));
        transfer.items.add(new File([bytes], spec.name, { type: spec.type }));
      }
      const target = document.querySelector(at);
      for (const kind of kinds) {
        target?.dispatchEvent(
          clipboard
            ? new ClipboardEvent(kind, {
              clipboardData: transfer,
              bubbles: true,
              cancelable: true,
            })
            : new DragEvent(kind, {
              dataTransfer: transfer,
              bubbles: true,
              cancelable: true,
            }),
        );
      }
    },
    { specs: files.map(fileSpec), kinds, at: world.chatSelector(selector(at)), clipboard: as === "clipboard" },
  );
};

When(
  "I paste a picture called {string} into the chat",
  async function (this: OlaiWorld, name: string) {
    await this.chat(CHAT_INPUT).click();
    await deliver(this, PLUGIN_TESTID.chatInput, [name], ["paste"], "clipboard");
  },
);

When(
  "I drag {string} over the chat panel",
  async function (this: OlaiWorld, names: string) {
    await deliver(this, PLUGIN_TESTID.chatTranscript, named(names), ["dragenter", "dragover"]);
  },
);

When(
  "I drop {string} on the chat panel",
  async function (this: OlaiWorld, names: string) {
    await deliver(this, PLUGIN_TESTID.chatTranscript, named(names), [
      "dragenter",
      "dragover",
      "drop",
    ]);
  },
);

When("the drag moves onto the composer", async function (this: OlaiWorld) {
  await deliver(this, PLUGIN_TESTID.chatInput, ["shot.png"], ["dragenter"]);
  await deliver(this, PLUGIN_TESTID.chatTranscript, ["shot.png"], ["dragleave"]);
});

const emptyDragAt = (world: OlaiWorld, at: PluginTestId, kind: string): Promise<void> =>
  world.page.evaluate(({ at, kind }) => {
    const target = document.querySelector(at)
    target?.dispatchEvent(
      new DragEvent(kind, {
        dataTransfer: new DataTransfer(),
        bubbles: true,
        cancelable: true,
      }),
    )
  }, { at: world.chatSelector(selector(at)), kind });

When(
  "I pick {string} with the attach button",
  async function (this: OlaiWorld, name: string) {
    const spec = fileSpec(name);
    const accept = await this
      .chat(`${CHAT_PANEL} input[type=file][multiple]`)
      .getAttribute("accept");
    assert.strictEqual(accept, ATTACHMENT_ACCEPT);
    assert.ok(accept.includes("image/*") && accept.includes("video/*"));
    const extension = name.slice(name.lastIndexOf("."));
    assert.ok(
      accept !== null && accept.includes(extension),
      `the picker offers "${accept}", which does not include "${extension}" — ` +
        `so a file the gate would take cannot be chosen`,
    );
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.chat(CHAT_ATTACH_BUTTON).click(),
    ]);
    await chooser.setFiles({
      name: spec.name,
      mimeType: spec.type,
      buffer: Buffer.from(spec.data, "base64"),
    });
  },
);

When(
  "I take a photo called {string} with the camera",
  async function (this: OlaiWorld, name: string) {
    const spec = fileSpec(name);
    const hole = this.chat(`${CHAT_PANEL} input[type=file][accept="image/*"][capture]`);
    assert.strictEqual(
      await hole.getAttribute("capture"),
      "environment",
      "the camera input must spell capture=\"environment\" — without it a " +
        "phone opens the file picker, and the button is a second roll door",
    );
    const accept = await hole.getAttribute("accept");
    assert.ok(
      accept !== null && accept.includes("image/"),
      `the camera offers "${accept}" — and one shot is only ever a picture`,
    );
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.chat(CHAT_CAMERA_BUTTON).click(),
    ]);
    await chooser.setFiles({
      name: spec.name,
      mimeType: spec.type,
      buffer: Buffer.from(spec.data, "base64"),
    });
    assert.strictEqual(
      await hole.inputValue(),
      "",
      "the shutter input must be cleared after a shot — an identical second " +
        "capture fires no `change` on an uncleared one",
    );
  },
);

When("I record a video called {string}", async function (this: OlaiWorld, name: string) {
  const hole = this.chat(`${CHAT_PANEL} input[type=file][accept="video/*"]`);
  assert.strictEqual(await hole.getAttribute("capture"), "environment");
  assert.strictEqual(await hole.getAttribute("multiple"), null);
  const button = this.chat(selector(PLUGIN_TESTID.chatVideoButton));
  assert.strictEqual(await button.getAttribute("aria-label"), "Record a video");
  const [chooser] = await Promise.all([
    this.page.waitForEvent("filechooser"),
    button.click(),
  ]);
  const spec = fileSpec(name);
  await chooser.setFiles({ name, mimeType: spec.type, buffer: Buffer.from(spec.data, "base64") });
  assert.strictEqual(await hole.inputValue(), "");
});

When("I record an unnamed QuickTime video", async function (this: OlaiWorld) {
  const [chooser] = await Promise.all([
    this.page.waitForEvent("filechooser"),
    this.chat(selector(PLUGIN_TESTID.chatVideoButton)).click(),
  ]);
  await chooser.setFiles({ name: "", mimeType: "video/quicktime", buffer: Buffer.from(TINY_MP4, "base64") });
});

When("I dismiss the camcorder", async function (this: OlaiWorld) {
  const [chooser] = await Promise.all([
    this.page.waitForEvent("filechooser"),
    this.chat(selector(PLUGIN_TESTID.chatVideoButton)).click(),
  ]);
  await chooser.setFiles([]);
});

When("I paste a video called {string} into the chat", async function (this: OlaiWorld, name: string) {
  await this.chat(CHAT_INPUT).click();
  await deliver(this, PLUGIN_TESTID.chatInput, [name], ["paste"], "clipboard");
});

When("I dismiss the camera", async function (this: OlaiWorld) {
  const [chooser] = await Promise.all([
    this.page.waitForEvent("filechooser"),
    this.chat(CHAT_CAMERA_BUTTON).click(),
  ]);
  await chooser.setFiles([]);
});

Then("the composer is not offering a camera", async function (this: OlaiWorld) {
  assert.strictEqual(await this.chat(selector(PLUGIN_TESTID.chatVideoButton)).count(), 0);
  assert.strictEqual(await this.chat(`${CHAT_PANEL} input[capture]`).count(), 0);
  assert.strictEqual(
    await this.chat(CHAT_CAMERA_BUTTON).count(),
    0,
    "a desktop draws no camera door: the attribute behind it would be " +
      "ignored there, and a camera button that opens a file dialog lies",
  );
});

When("the drag leaves the panel without dropping", async function (this: OlaiWorld) {
  await emptyDragAt(this, PLUGIN_TESTID.chatTranscript, "dragleave");
});

When("the drag is cancelled", async function (this: OlaiWorld) {
  await emptyDragAt(this, PLUGIN_TESTID.chatTranscript, "dragend");
});

When("I drag some selected text over the chat panel", async function (this: OlaiWorld) {
  await this.page.evaluate(({ at }) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "a sentence being dragged");
    const pane = document.querySelector(at);
    for (const kind of ["dragenter", "dragover"]) {
      pane?.dispatchEvent(
        new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }),
      );
    }
  }, { at: this.chatSelector(CHAT_TRANSCRIPT) });
});

Then("the panel shows where the drop will land", async function (this: OlaiWorld) {
  await this.chat(CHAT_DROP)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the panel is not offering to take a drop", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_DROP).count()) === 0,
    "the panel not to be offering to take a drop",
  );
});

Then(
  "the composer is holding the picture {string}",
  async function (this: OlaiWorld, name: string) {
    await this.waitUntil(
      async () => (await this.chat(pendingChip(name)).count()) > 0,
      `the composer to hold "${name}"`,
    );
  },
);

Then(
  "the composer is holding {string} in that order",
  async function (this: OlaiWorld, names: string) {
    const wanted = named(names);
    await this.waitUntil(
      async () => (await this.chat(PENDING_ATTACHMENTS).count()) === wanted.length,
      `the composer to hold ${wanted.length} pictures`,
    );
    assert.deepStrictEqual(
      await this.chat(PENDING_ATTACHMENTS).evaluateAll((chips) =>
        chips.map((chip) => chip.getAttribute("data-name"))
      ),
      [...wanted],
      "one drop's pictures are attached in the order they were dropped",
    );
  },
);

Then(
  "the agent read {string} in that order",
  async function (this: OlaiWorld, names: string) {
    const wanted = named(names).map((name) => `read ${Buffer.from(fileSpec(name).data, "base64").length} bytes from ${name}`);
    await this.waitUntil(
      async () => {
        const said = await transcriptText(this);
        return wanted.every((line) => said.includes(line));
      },
      `the agent to read ${wanted.length} pictures`,
    );
    const said = await transcriptText(this);
    const at = wanted.map((line) => said.indexOf(line));
    assert.deepStrictEqual(
      [...at].sort((a, b) => a - b),
      at,
      `the agent read the pictures in a different order than they were dropped: ${said}`,
    );
  },
);

Then(
  "the composer is holding {string}, showing how big it is",
  async function (this: OlaiWorld, name: string) {
    await this.waitUntil(
      async () => (await this.chat(pendingChip(name)).count()) > 0,
      `the composer to hold "${name}"`,
    );
    const chip = this.chat(pendingChip(name));
    assert.strictEqual(
      await chip.locator(CHAT_ATTACHMENT_PREVIEW).count(),
      0,
      `"${name}" is not a picture, so the chip for it must not be drawing one`,
    );
    const size = oneLine(await chip.locator(CHAT_ATTACHMENT_SIZE).innerText());
    assert.match(
      size,
      /^\d+(\.\d)? (B|KB|MB|GB)$/,
      `the chip for "${name}" says "${size}" where a size belongs`,
    );
  },
);

Then("the composer is holding nothing", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await this.chat(PENDING_ATTACHMENTS).count() === 0,
    "the composer to have no pending attachments");
});

Then(
  "the conversation shows the picture {string}",
  async function (this: OlaiWorld, name: string) {
    await this.waitUntil(
      async () =>
        (await this.chat(`${CHAT_TRANSCRIPT} ${pictureChip(name)}`).count()) > 0,
      `the transcript to show "${name}"`,
    );
    const preview = this.chat(
      `${CHAT_TRANSCRIPT} ${pictureChip(name)} ${CHAT_ATTACHMENT_PREVIEW}`,
    );
    assert.strictEqual(
      await preview.count(),
      1,
      "the tab that pasted the picture is drawing a name where it has the " +
        "bytes to draw the picture",
    );
  },
);

const pictureChip = (name: string): string => `${CHAT_ATTACHMENT}${attr("data-name", name)}`;
const PENDING_ATTACHMENTS = `${CHAT_ATTACHMENT}:has(${selector(PLUGIN_TESTID.chatAttachmentRemove)})`;
const pendingChip = (name: string): string => `${PENDING_ATTACHMENTS}${attr("data-name", name)}`;

Then(
  "the panel header says the context is {string}",
  async function (this: OlaiWorld, usage: string) {
    await this.waitUntil(
      async () => {
        const line = this.chat(CHAT_USAGE);
        return (await line.count()) > 0 && oneLine(await line.innerText()) === usage;
      },
      `the header to say the context is "${usage}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the panel header says nothing about the context",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.chat(CHAT_USAGE).count()) === 0,
      "the header to say nothing about the context",
      HYDRATION_TIMEOUT,
    );
  },
);

When("I hover the panel's context readout", async function (this: OlaiWorld) {
  const line = this.chat(CHAT_USAGE);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await line.hover();
});

Then(
  "the context readout is called {string} beside the number",
  async function (this: OlaiWorld, said: string) {
    const beside = this.chat(CHAT_USAGE).locator("xpath=..");
    assert.ok(
      oneLine(await beside.innerText()).includes(said),
      `the agent line does not say ${JSON.stringify(said)} beside the context readout: ` +
        JSON.stringify(oneLine(await beside.innerText())),
    );
  },
);

Then("the context readout carries no native tooltip", async function (this: OlaiWorld) {
  assert.equal(
    await this.chat(CHAT_USAGE).getAttribute("title"),
    null,
    "the context readout still wears a native tooltip beside this app's own",
  );
});

Then("the panel asks which agent", async function (this: OlaiWorld) {
  await this.chat(CHAT_CHOOSE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the panel does not ask which agent", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => {
      const status = await this.chat(CHAT_PANEL).getAttribute("data-status");
      return (
        (status === "idle" || status === "thinking") &&
        (await this.chat(CHAT_CHOOSE).count()) === 0
      );
    },
    "the panel to hold a conversation rather than a question about which agent",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the picker offers the agent {string}",
  async function (this: OlaiWorld, id: string) {
    const row = this.chat(`${CHAT_CHOOSE_AGENT}${attr("data-agent", id)}`);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await row.innerText()).length > 0,
      `the picker's row for "${id}" is empty — the engine's own face did not draw`,
    );
  },
);

When("I choose the agent {string}", async function (this: OlaiWorld, id: string) {
  const row = this.chat(`${CHAT_CHOOSE_AGENT}${attr("data-agent", id)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await row.click();
  await this.waitUntil(
    async () => {
      const status = await this.chat(CHAT_PANEL).getAttribute("data-status");
      return status === "idle" || status === "thinking";
    },
    `the panel to settle after choosing "${id}"`,
    HYDRATION_TIMEOUT,
  );
});

When(
  "I choose the agent {string} without waiting for it",
  async function (this: OlaiWorld, id: string) {
    const row = this.chat(`${CHAT_CHOOSE_AGENT}${attr("data-agent", id)}`);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await row.click();
  },
);

Then(
  "the header names the agent {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(this.chatSelector(CHAT_AGENT),
      "data-agent",
      id,
      "the agent named in the panel header",
    );
  },
);

Then("the header draws that agent's own mark", async function (this: OlaiWorld) {
  const id = await this.chat(CHAT_AGENT).getAttribute("data-agent");
  assert.ok(id !== null, "the header names no agent, so there is no mark to check");
  await this.expectAttribute(
    `${CHAT_AGENT} ${CHAT_AGENT_MARK}`,
    "data-mark",
    id,
    "the mark drawn beside the agent's name",
  );
});

Then("the composer says a message would queue", async function (this: OlaiWorld) {
  await this.chat(CHAT_QUEUES)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the composer says nothing about queueing", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_QUEUES).count()) === 0,
    "the composer to say nothing about queueing",
    POLL_TIMEOUT,
  );
});

When("I keep the conversation I am in", async function (this: OlaiWorld) {
  await this.chat(CHAT_CHOOSE_CANCEL).click();
});

Then(
  "the chat has not answered {string}",
  async function (this: OlaiWorld, text: string) {
    const answered = async (): Promise<boolean> =>
      oneLine(await this.chat(CHAT_TRANSCRIPT).innerText()).includes(text);
    assert.ok(!(await answered()), `the chat has already answered "${text}"`);
    await this.page.waitForTimeout(700);
    assert.ok(!(await answered()), `the chat answered "${text}" while it was held`);
  },
);

When("opencode is no longer installed", function (this: OlaiWorld) {
  this.fakes = this.fakes.filter((word) => word !== "opencode");
});

const laneCalls = (world: OlaiWorld) =>
  world.chat(`${CHAT_LANE}:has(${CHAT_TOOL})`);

Then(
  "the conversation carries none of the subagent's calls",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await laneCalls(this).count()) === 0,
      "the transcript to carry no subagent tool calls",
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the call that spawned it offers a door to {int} calls, as {string}",
  async function (this: OlaiWorld, many: number, named: string) {
    const door = this.chat(CHAT_LANE_DOOR).first();
    await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = oneLine(await door.innerText());
    assert.ok(
      said.includes(String(many)),
      `the door says "${said}" rather than naming ${many} calls behind it`,
    );
    assert.ok(
      said.includes(named),
      `the door says "${said}" rather than naming "${named}" — the row above it ` +
        "is titled with the tool's name, so this is the only thing on it that " +
        "says which agent is behind the door",
    );
    const opens = await door.getAttribute("data-lane");
    assert.ok(opens !== null && opens !== "", "a door that names no agent opens onto nothing");
    await insetBelow(this, opens ?? "", door, "the door onto a subagent's work");
  },
);

Then("the call that spawned it offers no door yet", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.chat(CHAT_LANE_DOOR).count(),
    0,
    "a door is offered onto an agent that has not called anything",
  );
});

When("I open the agent's work from the transcript", async function (this: OlaiWorld) {
  await this.chat(CHAT_LANE_DOOR).first().click();
});

When("I open {string} from the strip", async function (this: OlaiWorld, named: string) {
  const entry = this.chat(`${CHAT_WATCHING_TASK}[data-kind="agent"]`, { hasText: named })
    .first();
  await entry.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await entry.click();
});

Then("I can close the agent's work", async function (this: OlaiWorld) {
  await this.chat(CHAT_LANE_DOOR).first().click();
  await this.waitUntil(
    async () => (await this.chat(CHAT_PREVIEW).count()) === 0,
    "the shelf to close",
    HYDRATION_TIMEOUT,
  );
});

Then(
  "the agent's work is open, and it is {string}",
  async function (this: OlaiWorld, named: string) {
    const head = this.chat(CHAT_PREVIEW_OF);
    await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const said = oneLine(await head.innerText());
    assert.ok(
      said.includes(named),
      `the shelf is about "${said}" rather than about "${named}"`,
    );
  },
);

Then(
  "the agent's work shows {int} calls",
  async function (this: OlaiWorld, many: number) {
    const rows = this.chat(`${CHAT_PREVIEW} ${CHAT_TOOL}`);
    await this.waitUntil(
      async () => (await rows.count()) === many,
      `${many} of the agent's own calls to be drawn in the shelf`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the agent's work says a question is waiting",
  async function (this: OlaiWorld) {
    await this.chat(CHAT_PREVIEW_ASKED)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

When(
  "I go to the question from the agent's work",
  async function (this: OlaiWorld) {
    await this.chat(CHAT_PREVIEW_ASKED).click();
  },
);

Then("no agent's work is open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_PREVIEW).count()) === 0,
    "the shelf to be put away",
    HYDRATION_TIMEOUT,
  );
});

Then("the agent's work shows nothing yet", async function (this: OlaiWorld) {
  await this.chat(CHAT_PREVIEW_NOTHING)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the agent's work is above the conversation and clear of the box",
  async function (this: OlaiWorld) {
    const shelf = await this.chat(CHAT_PREVIEW).boundingBox();
    const pane = await this.chat(CHAT_TRANSCRIPT).boundingBox();
    const box = await this.chat(CHAT_INPUT).boundingBox();
    assert.ok(
      shelf !== null && pane !== null && box !== null,
      "the shelf, the conversation or the box is not drawn",
    );
    assert.ok(
      shelf.y + shelf.height <= pane.y + 1,
      `the shelf ends at ${shelf.y + shelf.height} and the conversation starts at ` +
        `${pane.y} — a shelf drawn over the transcript hides the one row a ` +
        "subagent's question is allowed to be",
    );
    assert.ok(
      shelf.y + shelf.height <= box.y,
      "the shelf reaches the composer; the reply is never what a preview costs",
    );
    assert.ok(
      pane.height > 0,
      "the conversation has been squeezed to nothing by the shelf above it",
    );
  },
);

Then(
  "the strip lists {int} agents still out",
  async function (this: OlaiWorld, many: number) {
    const agents = this.chat(`${CHAT_WATCHING_TASK}[data-kind="agent"]`);
    await this.waitUntil(
      async () => (await agents.count()) === many,
      `${many} agents to be listed on the strip`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then("the strip lists no agent still out", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      (await this.chat(`${CHAT_WATCHING_TASK}[data-kind="agent"]`).count()) === 0,
    "the strip to stop listing any agent",
    HYDRATION_TIMEOUT,
  );
});

Then("there is somewhere to type into", async function (this: OlaiWorld) {
  await this.chat(CHAT_INPUT)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

const holdAttachmentRead = async (world: OlaiWorld, remaining: number): Promise<void> => {
  await world.page.evaluate((remaining) => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      if (--remaining > 0) return read.call(this);
      Blob.prototype.arrayBuffer = read;
      document.documentElement.setAttribute("data-test-file-reading", "held");
      await new Promise<void>((resolve) => document.addEventListener("test-release-file-read", () => resolve(), { once: true }));
      document.documentElement.removeAttribute("data-test-file-reading");
      return read.call(this);
    };
  }, remaining);
};

When("reading the next attachment file is held", async function (this: OlaiWorld) {
  await holdAttachmentRead(this, 1);
});

When("reading the second attachment slice is held", async function (this: OlaiWorld) {
  await holdAttachmentRead(this, 2);
});

Then("the attachment upload shows {int} percent", async function (this: OlaiWorld, percent: number) {
  await this.waitUntil(async () =>
    (await this.chat(selector(PLUGIN_TESTID.chatUploadProgress)).innerText()).endsWith(` ${percent}%`),
    `the acknowledged upload progress to reach ${percent}%`);
});

Then("no attachment upload progress is shown", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await this.chat(selector(PLUGIN_TESTID.chatUploadProgress)).count()) === 0,
    "the upload progress to clear");
});

Then("the attachment file is still being read", async function (this: OlaiWorld) {
  await this.page.locator('html[data-test-file-reading="held"]').waitFor({ timeout: POLL_TIMEOUT });
});

When("the attachment file read finishes", async function (this: OlaiWorld) {
  await this.page.evaluate(() => document.dispatchEvent(new Event("test-release-file-read")));
});

When("I remove the pending attachment {string}", async function (this: OlaiWorld, name: string) {
  await this.chat(pendingChip(name)).getByRole("button", { name: `Remove ${name}`, exact: true }).click();
});

When("I attach a text file named {string} containing {string}", async function (this: OlaiWorld, name: string, text: string) {
  const choosing = this.page.waitForEvent("filechooser");
  await this.chat(CHAT_ATTACH_BUTTON).click();
  await (await choosing).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  await this.chat(pendingChip(name)).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the pending attachment {string} shows size {string}", async function (this: OlaiWorld, name: string, size: string) {
  await this.waitUntil(async () =>
    await this.chat(pendingChip(name)).locator(CHAT_ATTACHMENT_SIZE).innerText() === size,
    `the pending ${name} to show ${size}`);
});

When("I reopen the agent fold during a turn", async function (this: OlaiWorld) {
  assert.ok(this.activeAgent);
  await returnToOutline(this, this.activeAgent);
  await openFold(this, this.activeAgent);
  await this.chat(CHAT_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => await this.chat(CHAT_PANEL).getAttribute("data-status") === "thinking",
    "the reopened panel to show the running turn");
});

When("I choose the chat model {string}", async function (this: OlaiWorld, name: string) {
  await this.chatLine().getByRole("button", { name: "Change model", exact: true }).click();
  await this.chatLine().getByRole("list", { name: "Models", exact: true })
    .getByRole("button", { name, exact: true }).click();
});

When("I filter the chat models by {string}", async function (this: OlaiWorld, query: string) {
  await this.chat(CHAT_MODEL_FILTER).pressSequentially(query);
});

When("I press {string} in the model filter", async function (this: OlaiWorld, key: string) {
  await this.chat(CHAT_MODEL_FILTER).press(key);
});

Then("the model picker offers only {string}", async function (this: OlaiWorld, names: string) {
  const list = this.chatLine().getByRole("list", { name: "Models", exact: true });
  await this.waitUntil(
    async () => {
      const offered = await list.getByRole("button").allTextContents();
      return offered.map(oneLine).join(", ") === names;
    },
    `the model picker to offer only: ${names}`,
    HYDRATION_TIMEOUT,
  );
});

Then("the model picker offers nothing for {string}", async function (this: OlaiWorld, query: string) {
  await this.chat(CHAT_MODEL_NONE).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(await this.chat(CHAT_MODEL_NONE).innerText(), `No model matches "${query}"`);
  assert.strictEqual(
    await this.chatLine().getByRole("list", { name: "Models", exact: true }).getByRole("button").count(),
    0,
  );
});

When("I press {string} {int} times in the model filter", async function (this: OlaiWorld, key: string, count: number) {
  const filter = this.chat(CHAT_MODEL_FILTER);
  for (let i = 0; i < count; i++) await filter.press(key);
});

When("I pick the model under the cursor", async function (this: OlaiWorld) {
  await this.chat(CHAT_MODEL_FILTER).press("Enter");
});

Then("the model picker is shut", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_MODEL_FILTER).count()) === 0,
    "the model picker to be shut",
    HYDRATION_TIMEOUT,
  );
});

Then("the caret is back on the model picker", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => {
      const label = await this.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
      return label === "Change model";
    },
    "the caret to be back on the model picker",
    HYDRATION_TIMEOUT,
  );
});

Then("the model list has scrolled to the row under the cursor", async function (this: OlaiWorld) {
  const list = this.chatLine().getByRole("list", { name: "Models", exact: true });
  await this.waitUntil(
    async () => {
      const read = await list.evaluate((ul) => {
        const active = ul.querySelector('[aria-selected="true"]');
        if (active === null) return null;
        const box = ul.getBoundingClientRect();
        const row = active.getBoundingClientRect();
        return { scrolled: ul.scrollTop, inside: row.top >= box.top && row.bottom <= box.bottom + 1 };
      });
      return read !== null && read.scrolled > 0 && read.inside;
    },
    "the list to scroll the row under the cursor into view",
    HYDRATION_TIMEOUT,
  );
});

Then("the model list is back at the top", async function (this: OlaiWorld) {
  const list = this.chatLine().getByRole("list", { name: "Models", exact: true });
  await this.waitUntil(
    async () => {
      // The filter is a sticky child an arrow-walked row must end up below, and
      // Chromium's nearest-scroll makes exactly that land scrollTop at zero.
      const read = await list.evaluate((ul) => {
        const active = ul.querySelector('[aria-selected="true"]')?.closest("li");
        const filter = ul.children[0];
        if (active === undefined || active === null || filter === undefined) return null;
        const row = active.getBoundingClientRect();
        const box = ul.getBoundingClientRect();
        return {
          scrolled: ul.scrollTop,
          first: Math.abs(row.top - filter.getBoundingClientRect().bottom) <= 2,
          inside: row.top >= box.top && row.bottom <= box.bottom + 1,
        };
      });
      return read !== null && read.first && read.inside && read.scrolled <= 1;
    },
    "the model list to be back on its first row, in view below the filter",
    HYDRATION_TIMEOUT,
  );
});

Given("the agent refuses model changes", async function (this: OlaiWorld) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.refuseModel), "");
});

Given("the signed-in account may not use the model {string}", async function (this: OlaiWorld, value: string) {
  fs.writeFileSync(path.join(this.scratch(), MARKER.refuseModelByAccount), value);
});

Then("the model picker is disabled", async function (this: OlaiWorld) {
  assert.strictEqual(await this.chatLine().getByRole("button", { name: "Change model", exact: true }).isDisabled(), true);
});

When("I open the session settings", async function (this: OlaiWorld) {
  await this.chatLine().getByRole("button", { name: "Change model", exact: true }).click();
});
When("I set session setting {string} to {string}", async function (this: OlaiWorld, name: string, value: string) {
  await this.chatLine().getByRole("combobox", { name, exact: true }).selectOption(value);
  await this.waitUntil(async () => await this.chatLine().getByRole("combobox", { name, exact: true }).inputValue() === value, "setting accepted", HYDRATION_TIMEOUT);
});
When("I enable fast mode", async function (this: OlaiWorld) {
  await this.chatLine().getByRole("checkbox", { name: "Fast mode", exact: true }).click();
  await this.waitUntil(async () => this.chatLine().getByRole("checkbox", { name: "Fast mode", exact: true }).isChecked(), "fast mode accepted", HYDRATION_TIMEOUT);
});
Then("session setting {string} is {string}", async function (this: OlaiWorld, name: string, value: string) {
  await this.waitUntil(async () => await this.chatLine().getByRole("combobox", { name, exact: true }).inputValue() === value, "confirmed setting", HYDRATION_TIMEOUT);
});
When("I attempt session setting {string} to {string}", async function (this: OlaiWorld, name: string, value: string) {
  await this.chatLine().getByRole("combobox", { name, exact: true }).selectOption(value);
});
Then("the execution plan contains {string} as {string}", async function (this: OlaiWorld, text: string, status: string) {
  await this.chatLine().getByLabel("Execution plan", { exact: true }).locator(`li${attr("data-status", status)}`).filter({ hasText: text }).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the execution plan omits {string}", async function (this: OlaiWorld, text: string) {
  await this.chatLine().getByLabel("Execution plan", { exact: true }).getByText(text, { exact: true }).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
});
Then("there is no execution plan", async function (this: OlaiWorld) {
  await this.chatLine().getByLabel("Execution plan", { exact: true }).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
});
Then("terminal output contains {string}", async function (this: OlaiWorld, text: string) {
  await this.waitUntil(async () => (await this.chatRoot().getByRole("region", { name: "Terminal output", exact: true }).allTextContents()).some(output => output.includes(text)), "terminal output: " + text, HYDRATION_TIMEOUT);
});

Then("there is no terminal output", async function (this: OlaiWorld) {
  await this.chatRoot().getByRole("region", { name: "Terminal output", exact: true }).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
});
Then("terminal output omits {string}", async function (this: OlaiWorld, text: string) {
  await this.waitUntil(async () => (await this.chatRoot().getByRole("region", { name: "Terminal output", exact: true }).allTextContents()).every(output => !output.includes(text)), "terminal output to omit: " + text, HYDRATION_TIMEOUT);
});

Then("my transcript speaker is {string}", async function (this: OlaiWorld, name: string) {
  const speaker = this.page.locator(`${selector(PLUGIN_TESTID.chatSpeaker)}[data-speaker="human"]`).first();
  await this.waitUntil(async () => await speaker.getAttribute("data-speaker-name") === name,
    `the human speaker to be ${name}`);
});

Then("my transcript speaker wears an anonymous silhouette", async function (this: OlaiWorld) {
  const speaker = this.page.locator(`${selector(PLUGIN_TESTID.chatSpeaker)}[data-speaker="human"]`).first();
  await speaker.locator("svg").waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await speaker.locator("img").count(), 0);
});

When(
  "I pick the conversation {string} under the agent {string}",
  async function (this: OlaiWorld, title: string, agent: string) {
    await this.chat(`${CHAT_SESSION}${attr("data-agent", agent)}`, { hasText: title }).first().click();
  },
);

Then("the open agent's work contains {string} but not {string}", async function (this: OlaiWorld, own: string, other: string) {
  const work = this.chat(CHAT_PREVIEW);
  await this.waitUntil(async () => (await work.innerText()).includes(own), `the child work to contain ${own}`, HYDRATION_TIMEOUT);
  assert.ok(!(await work.innerText()).includes(other), `the child work contains another session's output: ${other}`);
});

When("I open {string} from the open agent's work", async function (this: OlaiWorld, named: string) {
  await this.chat(`${CHAT_PREVIEW} ${CHAT_LANE_DOOR}`, { hasText: named }).click();
});

When("I open the nested agent's work", async function (this: OlaiWorld) {
  const doors = this.chat(`${CHAT_PREVIEW} ${CHAT_LANE_DOOR}`);
  await doors.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await doors.count(),
    1,
    "the open agent's work holds more than one door, so pressing by place names nothing",
  );
  await doors.first().click();
});

When("I return to the parent agent {string}", async function (this: OlaiWorld, name: string) {
  await this.page.getByRole("button", { name: `Back to ${name}`, exact: true }).click();
});

const agentStarts = (world: OlaiWorld): number => world.serverLog.text.split("chat agent ready").length - 1;
When("the agent starts so far are counted", function (this: OlaiWorld) {
  this.notedAgentStarts = agentStarts(this);
});
Then("no further agent process has started", function (this: OlaiWorld) {
  assert.notEqual(this.notedAgentStarts, null);
  assert.equal(agentStarts(this), this.notedAgentStarts);
});
Then("exactly one further agent process has started", function (this: OlaiWorld) {
  assert.notEqual(this.notedAgentStarts, null);
  assert.equal(agentStarts(this), this.notedAgentStarts! + 1);
});
Then("the list-asks have grown", async function (this: OlaiWorld) {
  assert.notEqual(this.notedListAsks, null);
  await this.waitUntil(async () => listAsks(this.scratch()) > this.notedListAsks!, "the running engine to answer a new listing request");
});

When("I send the recovered draft again", async function (this: OlaiWorld) {
  const button = this.chat(CHAT_SEND);
  await button.filter({ hasText: "Send again" }).click();
});

Then("the active chat completion is {string}", async function(this: OlaiWorld, value: string) {
  await this.waitUntil(async () => await this.chat(`${CHAT_COMPLETION_ROW}[data-active="true"]`).getAttribute("data-value") === value, `the completion cursor to name ${value}`);
});

Then("the tool call says which outline it touched", async function (this: OlaiWorld) {
  const file = heldTool(this).locator(CHAT_TOOL_FILE);
  await file.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await file.innerText(), "house.olai");
});
Then("the tool call is called {string} underneath", async function (this: OlaiWorld, called: string) {
  const tool = heldTool(this);
  assert.equal(await tool.locator(CHAT_TOOL_CALLED).innerText(), called);
  assert.ok(
    oneLine(await tool.locator(CHAT_TOOL_FOLD).innerText()).includes(called),
    `the tool call's line does not say ${JSON.stringify(called)}`,
  );
  assert.equal(await tool.locator(CHAT_TOOL_TEXT).getAttribute("title"), null);
});
Then("the tool call's reply is shown once", async function (this: OlaiWorld) {
  const tool = heldTool(this);
  assert.equal(await tool.locator(CHAT_TOOL_REPLY).count(), 1);
  assert.equal(await tool.locator(CHAT_TOOL_PROGRESS).count(), 0);
  const reply = JSON.parse(await tool.locator(CHAT_TOOL_REPLY).innerText());
  assert.equal(reply.file, "house.olai");
  const input = await tool.locator(CHAT_TOOL_DETAIL).innerText();
  assert.ok(!input.includes(reply.summary ?? reply.file), "reply leaked into the input detail");
});
Then("the chat shows no story under the call", async function (this: OlaiWorld) {
  assert.equal(await heldTool(this).locator(OUTLINES_STORY).count(), 0);
});
Then("the tool call shows no outline", async function (this: OlaiWorld) {
  assert.equal(await heldTool(this).locator(CHAT_TOOL_FILE).count(), 0);
});

Then("the foreign tool reply remains ordinary detail", async function (this: OlaiWorld) {
  const tool = heldTool(this);
  assert.equal(await tool.locator(CHAT_TOOL_REPLY).count(), 0);
  assert.match(await tool.locator(CHAT_TOOL_DETAIL).innerText(), /foreign write-shaped reply/);
});


Then("no chat completion is selected", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => await this.chat(`${CHAT_COMPLETION_ROW}[data-active="true"]`).count() === 0,
    "the chat completion to have no selected row",
  );
});

Then("the selected chat completion is {string}", async function (this: OlaiWorld, value: string) {
  await this.chat(`${CHAT_COMPLETION_ROW}${attr("data-value", value)}[data-active="true"]`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("the chat box reports its unchanged caret", async function(this: OlaiWorld) {
  await this.chat(CHAT_INPUT).evaluate(field => field.dispatchEvent(new Event("select", { bubbles: true })))
})


When("I mark the terminal output element", async function (this: OlaiWorld) {
  await this.chatRoot().getByRole("region", { name: "Terminal output", exact: true }).first().locator("pre").evaluate(element => {
    if (element.scrollHeight <= element.clientHeight) throw new Error("terminal output is not scrollable")
    element.scrollTop = 80
    if (element.scrollTop !== 80) throw new Error("terminal output did not accept its reading position")
    ;(element as HTMLElement & { retainedOutput?: boolean }).retainedOutput = true
  })
})
Then("the terminal output keeps its element", async function (this: OlaiWorld) {
  assert.equal(await this.chatRoot().getByRole("region", { name: "Terminal output", exact: true }).first().locator("pre").evaluate(element =>
    (element as HTMLElement & { retainedOutput?: boolean }).retainedOutput === true && element.scrollTop === 80), true)
})


const rememberedComposers = new WeakMap<OlaiWorld, NonNullable<Awaited<ReturnType<Locator["elementHandle"]>>>>();
When("I remember the chat composer before leaving", async function (this: OlaiWorld) {
  const composer = await this.chat(CHAT_INPUT).elementHandle();
  assert.ok(composer);
  rememberedComposers.set(this, composer);
});
Then("the remembered chat composer is detached", async function (this: OlaiWorld) {
  const composer = rememberedComposers.get(this);
  assert.ok(composer);
  await this.waitUntil(async () => !(await composer.evaluate(node => node.isConnected)), "the old composer to be detached");
});
