#!/usr/bin/env bun

import { ran, script } from "olai-plugin-opencode/testlib";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { commandLine } from "@olai/tests/agent/command.ts";
import { readMessages } from "@olai/tests/harness/ndjson.ts";
import { emitter, MARKER_FILE, released, speaking } from "@olai/tests/harness/scripted.ts";

const emit = emitter(process.stdout);
const { notify, refuse, request, respond, take } = speaking(emit, "oc");

/** opencode 2 has no `--cwd` and answers one with its usage text on stdout,
 *  which is not ACP; this fake does the same. */
if (process.argv.includes("--cwd")) {
  process.stdout.write("USAGE\n  opencode acp [flags]\n");
  process.exit(0);
}

/**
 * opencode's login is an interactive wizard: `acp --login` and `auth login`
 * both answer `Pass an integration ID or name when running without an
 * interactive terminal` and exit 1 when they find no TTY, and
 * `auth login <target> --method key` answers `API key input requires an
 * interactive terminal` (2.2.7). olai spawns a sign-in over pipes, so there
 * is no stdin here that could ever satisfy it.
 */
if (process.argv.includes("--login")) {
  try {
    writeFileSync(join(process.cwd(), ".opencode-login-ran"), process.argv.join(" "));
  } catch {
  }
  process.stdout.write("│\n");
  process.stdout.write("■  Pass an integration ID or name when running without an interactive terminal\n");
  process.stdout.write("│\n└  Failed\n");
  process.exit(1);
}
const cwd = process.cwd();

class Cancelled extends Error {}

class Refused extends Error {
  constructor(message: string, readonly reason: string) {
    super(message);
  }
}

const STORED = process.env.OLAI_FAKE_OPENCODE_STORED ?? "";

const holdingOpen = (): boolean => {
  const marker = `${cwd}/${MARKER_FILE.holdOpen}`;
  if (!existsSync(marker)) return false;
  rmSync(marker, { force: true });
  return true;
};

const STORED_SESSION = "ses_opencode_stored";

let sessionId = "";

/** Whether this client asked for child-session updates at `initialize`. The
 *  real agent sends them only to a client that advertised
 *  `opencode/child-session-updates`, and flattens a child's frames into the
 *  parent's stream otherwise. */
let childSessionUpdates = false;

let mcp: { url: string; headers: Record<string, string>; name: string } | null = null;

let nextCall = 0;

const callMcp = async (
  method: string,
  params: unknown,
): Promise<Record<string, unknown>> => {
  if (mcp === null) throw new Error("no MCP server was configured");
  const response = await fetch(mcp.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...mcp.headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextCall, method, params }),
  });
  if (response.status === 202) return {};
  const body = (await response.json()) as { result?: Record<string, unknown> };
  return body.result ?? {};
};

const returned = (result: Record<string, unknown>): unknown => {
  const content = result["content"];
  const text = Array.isArray(content) && typeof content[0]?.["text"] === "string"
    ? String(content[0]["text"])
    : "";
  if (result["isError"] === true) return text;
  if (result["structuredContent"] !== undefined) return result["structuredContent"];
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const update = (value: Record<string, unknown>, session = sessionId): void => {
  notify("session/update", { sessionId: session, update: value });
};

const say = (text: string, session = sessionId): void => {
  update({ sessionUpdate: "agent_message_chunk", messageId: `msg_${nextCall}`, content: { type: "text", text } }, session);
};

const callIdFor = (): string => `chatcmpl-tool-${(nextCall++).toString(16).padStart(16, "0")}`;

const ours = (): string => mcp?.name ?? "olai";

const runTool = async (
  name: string,
  title: string,
  args: Record<string, unknown>,
  call: () => Promise<{ rawOutput: unknown; content: unknown[]; failed?: boolean }>,
  session = sessionId,
): Promise<void> => {
  const toolCallId = callIdFor();
  update({ sessionUpdate: "tool_call", toolCallId, name, title: name, kind: "other", status: "pending", locations: [], rawInput: {} }, session);
  update({ sessionUpdate: "tool_call_update", toolCallId, status: "in_progress", kind: "other", title, locations: [], rawInput: args }, session);
  const result = await call();
  update({
    sessionUpdate: "tool_call_update",
    toolCallId,
    status: result.failed === true ? "failed" : "completed",
    locations: [],
    content: result.content,
    rawOutput: result.rawOutput,
  }, session);
};

const codeMode = async (
  tool: string,
  args: Record<string, unknown>,
  session = sessionId,
): Promise<Record<string, unknown>> => {
  const server = ours();
  const code = script(server, tool, args);
  let answered: Record<string, unknown> = {};
  await runTool("execute", "execute", { code }, async () => {
    answered = await callMcp("tools/call", { name: tool, arguments: args });
    const failed = answered["isError"] === true;
    return {
      ...ran([{ tool: `${server}.${tool}`, status: failed ? "error" : "completed", input: args }], returned(answered)),
      failed: false,
    };
  }, session);
  return answered;
};

/** opencode's own option list for a permission — allow first, with the ids
 *  the real one mints. */
const OPTIONS = [
  { optionId: "once", name: "Allow once", kind: "allow_once" },
  { optionId: "always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject", name: "Reject", kind: "reject_once" },
];

const askPermission = async (
  name: string | null,
  title: string,
  rawInput: Record<string, unknown>,
  session = sessionId,
): Promise<unknown> => {
  const toolCallId = callIdFor();
  const call = { toolCallId, ...(name === null ? {} : { name }), title, kind: "other", status: "pending", locations: [], rawInput };
  update({ sessionUpdate: "tool_call", ...call }, session);
  return await request("session/request_permission", { sessionId: session, toolCall: call, options: OPTIONS });
};

let nextChild = 0;

const subagent = async (
  description: string,
  work: (child: string) => Promise<void>,
  report: string,
  options: { ended?: "completed" | "failed" | "interrupted"; under?: string; depth?: number } = {},
): Promise<void> => {
  const ended = options.ended ?? "completed";
  const under = options.under ?? sessionId;
  const depth = options.depth ?? 1;
  const child = `ses_child_${++nextChild}`;
  const toolCallId = callIdFor();
  const rawInput = { agent: "explore", description, prompt: `${description}. Report one line.` };
  const announce = (value: Record<string, unknown>) =>
    depth === 1 ? update(value) : childFrame(under, childTitles.get(under) ?? "", value, depth - 1, sessionId);
  announce({ sessionUpdate: "tool_call", toolCallId, name: "subagent", title: "subagent", kind: "think", status: "pending", locations: [], rawInput: {} });
  announce({ sessionUpdate: "tool_call_update", toolCallId, status: "in_progress", kind: "think", title: "subagent", locations: [], rawInput });
  childTitles.set(child, description);
  childStatus(child, description, "created", under, depth);
  childStatus(child, description, "running", under, depth);
  await work(child);
  childStatus(child, description, ended, under, depth);
  // The in-progress frames carry `rawOutput: null` on the real wire, so the
  // child session id a completion names is the only thing tying this row to
  // that lane (2.2.7).
  announce({
    sessionUpdate: "tool_call_update",
    toolCallId,
    status: ended === "completed" ? "completed" : "failed",
    locations: [],
    content: [{ type: "content", content: { type: "text", text: `<subagent sessionID="${child}" state="${ended}">\n${report}\n</subagent>` } }],
    rawOutput: ended === "completed"
      ? { metadata: { sessionID: child, status: "completed", truncated: false } }
      : { metadata: { sessionID: child, status: "running" }, error: `Tool execution interrupted (sessionID: ${child})` },
  });
};

const childTitles = new Map<string, string>();

const childStatus = (child: string, title: string, status: string, under = sessionId, depth = 1): void => {
  if (!childSessionUpdates) return;
  notify("opencode/session/child_update", {
    rootSessionId: sessionId,
    childSessionId: child,
    parentSessionId: under,
    depth,
    title,
    type: "status",
    status,
  });
};

const childFrame = (child: string, title: string, value: Record<string, unknown>, depth = 1, under = sessionId): void => {
  const stamped = {
    ...value,
    ...(typeof value["toolCallId"] === "string" ? { toolCallId: `${child}:${String(value["toolCallId"])}` } : {}),
    ...(typeof value["title"] === "string" ? { title: `${title}: ${String(value["title"])}` } : {}),
    _meta: { "opencode/child-session": { id: child, parentID: under, depth, title } },
  };
  if (childSessionUpdates) {
    notify("opencode/session/child_update", {
      rootSessionId: sessionId,
      childSessionId: child,
      parentSessionId: under,
      depth,
      title,
      type: "update",
      update: stamped,
    });
    return;
  }
  update(stamped);
};

let running = false;

const steered: string[] = [];

let deaf = false;

const takeSteering = async (): Promise<void> => {
  for (const text of steered.splice(0)) {
    const [verb, ...rest] = text.trim().split(/\s+/);
    const argument = rest.join(" ");
    if (verb === "done" && argument !== "") {
      await codeMode("outlines_done", { id: argument });
      say(` — steered mid-turn: marked \`${argument}\` done.`);
      continue;
    }
    say(` — steered mid-turn: ${text}`);
  }
};

let cancelled = false;

const hold = async (): Promise<void> => {
  await released(cwd, async () => {
    if (cancelled) throw new Cancelled();
    await takeSteering();
  }, () => cancelled);
  if (cancelled) throw new Cancelled();
};

const turn = async (text: string): Promise<string> => {
  const said = commandLine(text);
  const [verb, ...rest] = said.split(/\s+/);
  const argument = rest.join(" ");
  const server = ours();

  if (verb === "context" && argument !== "") {
    const result = await codeMode("outlines_read", { id: argument });
    say(JSON.stringify(result));
    return "end_turn";
  }

  if (verb === "done" && argument !== "") {
    const result = await codeMode("outlines_done", { id: argument });
    say(result["isError"] === true ? `could not mark ${argument}` : `marked ${argument} done`);
    return "end_turn";
  }

  if (verb === "batch" && argument !== "") {
    const code = `const read = await tools.${server}.outlines_read({ id: ${JSON.stringify(argument)} });\n`
      + `const done = await tools.${server}.outlines_done({ id: ${JSON.stringify(argument)} });\nreturn [read, done];`;
    await runTool("execute", "execute", { code }, async () => {
      const read = await callMcp("tools/call", { name: "outlines_read", arguments: { id: argument } });
      const done = await callMcp("tools/call", { name: "outlines_done", arguments: { id: argument } });
      return ran(
        [
          { tool: `${server}.outlines_read`, input: { id: argument } },
          { tool: `${server}.outlines_done`, input: { id: argument } },
        ],
        [returned(read), returned(done)],
      );
    });
    say(`batched two calls on ${argument}`);
    return "end_turn";
  }

  if (said === "fail") {
    const result = await codeMode("outlines_done", { id: "no-such-node" });
    say(result["isError"] === true ? "could not mark it" : "marked it done");
    return "end_turn";
  }

  if (said === "throw") {
    await runTool("execute", "execute", { code: "throw new Error('the script gave up')" }, async () =>
      ran([], "Error: the script gave up"));
    say("the script gave up");
    return "end_turn";
  }

  if (said === "shell") {
    await runTool("shell", "echo hi", { command: "echo hi", cwd }, async () => ({
      rawOutput: { metadata: { status: "completed", truncated: false, exit: 0 } },
      content: [{ type: "content", content: { type: "text", text: "hi\n" } }],
    }));
    say("ran it");
    return "end_turn";
  }

  if (said === "slow") {
    const toolCallId = callIdFor();
    update({ sessionUpdate: "tool_call", toolCallId, name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: {} });
    update({ sessionUpdate: "tool_call_update", toolCallId, status: "in_progress", kind: "execute", title: "sleep 20", locations: [], rawInput: { command: "sleep 20", cwd } });
    await hold();
    update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed", locations: [], content: [{ type: "content", content: { type: "text", text: "(no output)" } }], rawOutput: { metadata: { status: "completed", exit: 0 } } });
    say("done dawdling");
    return "end_turn";
  }

  if (said === "hush") {
    await hold();
    say("finished after all");
    return "end_turn";
  }

  if (said === "silent") {
    update({ sessionUpdate: "usage_update", used: 0, size: 200000, cost: { amount: 0, currency: "USD" } });
    return "end_turn";
  }

  if (said === "quota") {
    update({ sessionUpdate: "usage_update", used: 0, size: 200000, cost: { amount: 0, currency: "USD" } });
    throw new Refused("Internal error: Insufficient balance. Top up at https://opencode.ai/console/billing", "provider.quota");
  }

  if (verb === "permit") {
    const code = script(server, "outlines_add", { id: argument === "" ? "kitchen" : argument });
    const answered = await askPermission("execute", "execute", { code });
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "foreign") {
    const answered = await askPermission("execute", "execute", { code: `return await tools.github.create_pr({ title: "x" });` });
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (verb === "dynamic") {
    const node = argument === "" ? "kitchen" : argument;
    const code = `const which = "${server}";\nreturn await tools[which].outlines_done({ id: ${JSON.stringify(node)} });`;
    const answered = await askPermission("execute", "execute", { code });
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "nameless") {
    const answered = await askPermission(null, "do something unnamed", {});
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "agents") {
    await subagent("Survey the kitchen", async (child) => {
      childFrame(child, "Survey the kitchen", {
        sessionUpdate: "tool_call", toolCallId: "c1", name: "read", title: "read", kind: "read", status: "pending", locations: [], rawInput: {},
      });
      childFrame(child, "Survey the kitchen", {
        sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed", kind: "read", title: "read house.olai", locations: [],
        content: [{ type: "content", content: { type: "text", text: "read it" } }],
      });
      childFrame(child, "Survey the kitchen", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_1", content: { type: "text", text: "the kitchen holds four rows" },
      });
    }, "the kitchen holds four rows");
    await subagent("Count the orders", async (child) => {
      childFrame(child, "Count the orders", {
        sessionUpdate: "tool_call", toolCallId: "c2", name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: {},
      });
      childFrame(child, "Count the orders", {
        sessionUpdate: "tool_call_update", toolCallId: "c2", status: "completed", kind: "execute", title: "ls", locations: [],
        content: [{ type: "content", content: { type: "text", text: "one order" } }],
      });
      childFrame(child, "Count the orders", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_2", content: { type: "text", text: "one order is outstanding" },
      });
    }, "one order is outstanding");
    say("both subagents reported");
    return "end_turn";
  }

  if (said === "agent-asks") {
    await subagent("Open a terminal", async (child) => {
      const toolCallId = `${child}:p1`;
      childFrame(child, "Open a terminal", {
        sessionUpdate: "tool_call", toolCallId: "p1", name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: { command: "rm -rf /tmp/x" },
      });
      const answered = await request("session/request_permission", {
        sessionId,
        toolCall: {
          toolCallId,
          name: "shell",
          title: "Open a terminal: rm -rf /tmp/x",
          kind: "execute",
          status: "pending",
          locations: [],
          rawInput: { command: "rm -rf /tmp/x" },
          _meta: { "opencode/child-session": { id: child, parentID: sessionId, depth: 1, title: "Open a terminal" } },
        },
        options: OPTIONS,
      });
      childFrame(child, "Open a terminal", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_3", content: { type: "text", text: `the subagent was told: ${JSON.stringify(answered)}` },
      });
    }, "the subagent asked and was answered");
    say("the subagent asked and was answered");
    return "end_turn";
  }

  if (said === "agent-fails") {
    await subagent("Read the missing file", async (child) => {
      childFrame(child, "Read the missing file", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_f1", content: { type: "text", text: "there is no such file" },
      });
    }, "there is no such file", { ended: "failed" });
    await subagent("Wait for the lock", async (child) => {
      childFrame(child, "Wait for the lock", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_f2", content: { type: "text", text: "still waiting" },
      });
    }, "stopped waiting", { ended: "interrupted" });
    say("both subagents ended badly");
    return "end_turn";
  }

  if (said === "agent-nests") {
    await subagent("Survey the house", async (child) => {
      childFrame(child, "Survey the house", {
        sessionUpdate: "tool_call", toolCallId: "n1", name: "read", title: "read", kind: "read", status: "pending", locations: [], rawInput: {},
      });
      childFrame(child, "Survey the house", {
        sessionUpdate: "tool_call_update", toolCallId: "n1", status: "completed", kind: "read", title: "read house.olai", locations: [],
        content: [{ type: "content", content: { type: "text", text: "read it" } }],
      });
      await subagent("Count the hinges", async (grandchild) => {
        childFrame(grandchild, "Count the hinges", {
          sessionUpdate: "tool_call", toolCallId: "n2", name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: {},
        }, 2, child);
        childFrame(grandchild, "Count the hinges", {
          sessionUpdate: "tool_call_update", toolCallId: "n2", status: "completed", kind: "execute", title: "ls hinges", locations: [],
          content: [{ type: "content", content: { type: "text", text: "four hinges" } }],
        }, 2, child);
      }, "four hinges", { under: child, depth: 2 });
    }, "the house has four hinges");
    say("the nested subagent reported");
    return "end_turn";
  }

  if (said === "agent-calls-olai") {
    const code = script(ours(), "outlines_done", { id: "order" });
    await subagent("Mark the order", async (child) => {
      const answered = await request("session/request_permission", {
        sessionId,
        toolCall: {
          toolCallId: `${child}:e1`,
          name: "execute",
          title: "Mark the order: execute",
          kind: "other",
          status: "pending",
          locations: [],
          rawInput: { code },
          _meta: { "opencode/child-session": { id: child, parentID: sessionId, depth: 1, title: "Mark the order" } },
        },
        options: OPTIONS,
      });
      childFrame(child, "Mark the order", {
        sessionUpdate: "tool_call", toolCallId: "e1", name: "execute", title: "execute", kind: "other", status: "pending", locations: [], rawInput: {},
      });
      const result = await callMcp("tools/call", { name: "outlines_done", arguments: { id: "order" } });
      childFrame(child, "Mark the order", {
        sessionUpdate: "tool_call_update", toolCallId: "e1", status: "completed", kind: "other", title: "execute", locations: [], rawInput: { code },
        ...ran([{ tool: `${ours()}.outlines_done`, input: { id: "order" } }], returned(result)),
      });
      childFrame(child, "Mark the order", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_4", content: { type: "text", text: `the subagent was answered ${JSON.stringify(answered)}` },
      });
    }, "marked the order");
    say("the subagent marked it");
    return "end_turn";
  }

  if (said === "agents-slow") {
    await subagent("Watch the kitchen", async (child) => {
      childFrame(child, "Watch the kitchen", {
        sessionUpdate: "tool_call", toolCallId: "s1", name: "shell", title: "shell", kind: "execute", status: "in_progress", locations: [], rawInput: { command: "sleep 20" },
      });
      await hold();
    }, "stopped watching", { ended: "interrupted" });
    say("the fan-out is over");
    return "end_turn";
  }

  if (said === "deaf") {
    deaf = true;
    const toolCallId = callIdFor();
    update({ sessionUpdate: "tool_call", toolCallId, name: "shell", title: "shell", kind: "execute", status: "in_progress", locations: [], rawInput: { command: "sleep 20" } });
    await hold();
    update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed", locations: [], content: [{ type: "content", content: { type: "text", text: "(no output)" } }] });
    say("the turn was already over");
    return "end_turn";
  }

  await takeSteering();
  say(`opencode says: ${said}`);
  await takeSteering();
  return "end_turn";
};

let currentModel = "opencode/kimi-k3";
let currentMode = "build";

const configOptions = () => [
  {
    id: "model",
    name: "Model",
    category: "model",
    type: "select",
    currentValue: currentModel,
    options: [
      { value: "opencode/kimi-k3", name: "opencode/Kimi K3" },
      { value: "opencode/claude-sonnet-5", name: "opencode/Claude Sonnet 5" },
    ],
  },
  {
    id: "mode",
    name: "Session Mode",
    category: "mode",
    type: "select",
    currentValue: currentMode,
    options: [
      { value: "build", name: "Build", description: "The default agent." },
      { value: "plan", name: "Plan", description: "Read-only agent." },
    ],
  },
];

let openedSessions = 0;

const openSession = (id: string, params: Record<string, unknown>): void => {
  sessionId = id;
  const servers = (params["mcpServers"] ?? []) as ReadonlyArray<Record<string, unknown>>;
  const http = servers.find((server) => server["type"] === "http");
  if (http !== undefined) {
    const headers = (http["headers"] ?? []) as ReadonlyArray<{ name: string; value: string }>;
    mcp = {
      url: String(http["url"]),
      name: String(http["name"]),
      headers: Object.fromEntries(headers.map((header) => [header.name, header.value])),
    };
  }
};

const handle = async (message: Record<string, unknown>): Promise<void> => {
  const id = message["id"];
  const method = message["method"];
  const params = (message["params"] ?? {}) as Record<string, unknown>;

  if (method === undefined) {
    take(id)?.(message["result"] ?? null);
    return;
  }

  switch (method) {
    case "initialize": {
      const capabilities = (params["clientCapabilities"] ?? {}) as Record<string, unknown>;
      const corner = (capabilities["_meta"] ?? {}) as Record<string, unknown>;
      childSessionUpdates = corner["opencode/child-session-updates"] === true;
      respond(id, {
        protocolVersion: 1,
        agentInfo: { name: "OpenCode", version: "2.2.7" },
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: { http: true, sse: false },
          sessionCapabilities: { list: {}, resume: {}, close: {}, delete: {}, fork: {} },
          _meta: { "opencode/child-session-updates": true },
        },
        // Both spellings the real one offers: `type: "terminal"` with
        // `args: ["--login"]` for the agent binary, and a `_meta` corner
        // naming the bare word `opencode`. Each half is conditional on the
        // client having advertised for it, as 2.2.7 is.
        authMethods: [{
          id: "opencode-login",
          name: "Login with opencode",
          description: "Run `opencode auth login` in the terminal",
          ...(((capabilities["auth"] ?? {}) as Record<string, unknown>)["terminal"] === true
            ? { type: "terminal", args: ["--login"] }
            : {}),
          ...(corner["terminal-auth"] === true
            ? { _meta: { "terminal-auth": { command: "opencode", args: ["auth", "login"], label: "OpenCode Login" } } }
            : {}),
        }],
        _meta: { steering: { supported: true } },
      });
      return;
    }

    case "session/new": {
      if (holdingOpen()) await released(cwd);
      openSession(`ses_new_${++openedSessions}`, params);
      respond(id, { sessionId, configOptions: configOptions() });
      return;
    }

    case "session/list":
      // The whole directory in one page, with a cursor beside it anyway: the
      // real one filters by the request's own `cwd`, ignores a `limit`, and
      // hands a `nextCursor` that answers zero rows when it is followed
      // (2.2.7, over three stored conversations).
      respond(id, {
        sessions: STORED === "" || params["cwd"] !== cwd
          ? []
          : [{ sessionId: STORED_SESSION, cwd, title: "an opencode conversation", updatedAt: "2026-11-11T10:00:00Z" }],
        nextCursor: "eyJvcmRlciI6ImRlc2MifQ==",
      });
      return;

    case "session/load": {
      const heldLoad = `${cwd}/${MARKER_FILE.holdLoad}`;
      if (existsSync(heldLoad)) {
        rmSync(heldLoad, { force: true });
        await released(cwd);
      } else if (holdingOpen()) await released(cwd);
      openSession(String(params["sessionId"]), params);
      // A replay: collapsed final frames, and the person's own words as
      // chunks, and no child-session frames — a reopened conversation that
      // had a subagent replays the `subagent` call and its report and
      // nothing on the channel (2.2.7).
      update({ sessionUpdate: "user_message_chunk", messageId: "msg_replay_1", content: { type: "text", text: "what did we say" } });
      update({ sessionUpdate: "tool_call", toolCallId: "chatcmpl-replay", name: "subagent", title: "subagent", kind: "think", status: "pending", locations: [], rawInput: {} });
      update({
        sessionUpdate: "tool_call_update",
        toolCallId: "chatcmpl-replay",
        status: "completed",
        kind: "think",
        title: "subagent",
        locations: [],
        rawInput: { agent: "explore", description: "Survey the kitchen", prompt: "Survey the kitchen." },
        content: [{ type: "content", content: { type: "text", text: `<subagent sessionID="ses_child_replay" state="completed">\nthe kitchen holds four rows\n</subagent>` } }],
        rawOutput: { metadata: { sessionID: "ses_child_replay", status: "completed", truncated: false } },
      });
      update({ sessionUpdate: "agent_message_chunk", messageId: "msg_replay_2", content: { type: "text", text: "opencode remembers this conversation" } });
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "session/set_mode":
      // The modes are `build` and `plan`, and nothing else.
      refuse(id, -32602, `mode not found: ${String(params["modeId"])}`);
      return;

    case "session/set_config_option": {
      const value = String(params["value"]);
      if (params["configId"] === "mode") currentMode = value;
      else currentModel = value;
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "_session/steering": {
      if (!running || deaf) {
        if (deaf) {
          deaf = false;
          running = false;
          void Bun.write(`${cwd}/${MARKER_FILE.release}`, "");
        }
        respond(id, { outcome: "promptRequired", reason: "noRunningTurn" });
        return;
      }
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>;
      steered.push(blocks.map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : "")).join(""));
      respond(id, { outcome: "injected" });
      return;
    }

    case "session/prompt": {
      // A second prompt while a turn runs is refused outright (2.2.7).
      if (running) {
        refuse(id, -32603, `Session already has an active ACP prompt: ${sessionId}`, { service: "session" });
        return;
      }
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>;
      const text = blocks
        .map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : ""))
        .join("");
      running = true;
      cancelled = false;
      try {
        const stopReason = await turn(text);
        respond(id, { stopReason, usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 }, _meta: {} });
      } catch (cause) {
        if (cause instanceof Refused) {
          refuse(id, -32603, cause.message, { service: "session", errorName: cause.reason });
        } else {
          respond(id, { stopReason: cause instanceof Cancelled ? "cancelled" : "refusal" });
        }
      } finally {
        running = false;
        deaf = false;
        steered.length = 0;
      }
      return;
    }

    case "session/cancel":
      cancelled = true;
      return;

    default:
      if (id !== undefined) refuse(id, -32601, `method not found: ${String(method)}`);
      return;
  }
};

readMessages<Record<string, unknown>>(process.stdin, (message) => {
  void handle(message);
});
