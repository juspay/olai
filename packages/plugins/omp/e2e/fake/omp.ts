#!/usr/bin/env bun
/**
 * An `omp` on PATH, shaped the way the real one is on the wire.
 *
 * Oh My Pi (`https://github.com/can1357/oh-my-pi`); every frame shape below
 * was captured live against **omp 18.1.21** spawned as `omp --approval-mode
 * yolo acp` (2026-09-14), and `packages/plugins/omp/src/leg.ts` carries the
 * reading of them:
 *
 *   - no `_meta` on any frame about a call; the only one omp's ACP mapper
 *     stamps is `{ messageCount, size }` on a stored conversation's listing
 *     row, so a tool is named only at the head of the call id (`write:0`).
 *     The terminal corners pi's adapter writes are not here either: with
 *     olai's `terminal: true` a command is a client-owned process and the
 *     call carries a `{ type: "terminal", terminalId }` content block.
 *   - olai's MCP tools are called through omp's own `write`: with omp's
 *     default `tools.xdev` the call is a `write` whose `rawInput.path` is the
 *     pseudo-path the `xd` scheme mints, answering under
 *     `details.xdev.inner.rawContent`.
 *   - `session/set_mode` answers `-32603 "Unsupported ACP mode"` (the modes
 *     are `default` and `plan`) and `_session/steering` answers `-32603
 *     "Unknown ACP ext method"`.
 *   - permission options lead with an allow (`allow_once`, `allow_always`,
 *     `reject_once`, `reject_always`).
 *   - a message sent while a turn streams cancels that turn, so the first
 *     request answers `stopReason: "cancelled"` and the second runs after; a
 *     prompt during an autonomous turn is refused `-32000 session_busy` with
 *     `error.data.hint = "steer|followUp|wait"`.
 *
 * Like the other fakes it calls the real internal MCP server over the real
 * HTTP route with the token `session/new` handed it. Behaviour is keyed on
 * the first line of the prompt ({@link commandLine}); `OLAI_FAKE_OMP_STORED`
 * present means `session/list` answers and `session/load` replays, and the
 * dot-files `.agent-hold-open` and `.agent-hold-load` hold the next open and
 * the next replay until `the agent is released`.
 */

import { announced, wrapped, type CallToolResult } from "olai-plugin-omp/testlib";
import { existsSync, rmSync } from "node:fs";

import { commandLine } from "@olai/tests/agent/command.ts";
import { readMessages } from "@olai/tests/harness/ndjson.ts";
import { emitter, MARKER_FILE, released, speaking } from "@olai/tests/harness/scripted.ts";

const emit = emitter(process.stdout);
const { notify, refuse, request, respond, take } = speaking(emit, "omp");

/** The served directory: omp is spawned with it as the child's working
 *  directory, takes an absolute `cwd` in `session/new` and `session/list`,
 *  and reports one per listed row. */
const cwd = process.cwd();

class Cancelled extends Error {}

class Refused extends Error {}

const STORED = process.env.OLAI_FAKE_OMP_STORED ?? "";

const sleep = (millis: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, millis);
  return promise;
};

const STORED_SESSION = "ses_omp_stored";

const TITLE = "an Oh My Pi conversation";

const PAGE = 50;

let sessionId = "";

let mcp: { url: string; headers: Record<string, string>; name: string } | null = null;

let nextCall = 0;

let nextRequest = 0;

let openedSessions = 0;

let currentMode = "default";
let currentModel = "litellm/kimi-k3";
let currentThinking = "auto";

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
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextRequest, method, params }),
  });
  if (response.status === 202) return {};
  const body = (await response.json()) as { result?: Record<string, unknown> };
  return body.result ?? {};
};

const say = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  });
};

const think = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text } },
  });
};

const callIdFor = (tool: string): string => `${tool}:${nextCall++}`;

const announceCommand = async (
  toolCallId: string,
  command: string,
  script: string,
): Promise<{ terminalId: string }> => {
  const created = (await request("terminal/create", {
    sessionId,
    command: "node",
    args: ["-e", script],
    cwd,
    outputByteLimit: 65536,
  })) as { terminalId: string };
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: `$ ${command}`,
      kind: "execute",
      status: "in_progress",
      content: [{ type: "terminal", terminalId: created.terminalId }],
    },
  });
  return created;
};

const finishCommand = async (toolCallId: string, terminalId: string): Promise<void> => {
  const params = { sessionId, terminalId };
  await request("terminal/wait_for_exit", params);
  await request("terminal/output", params);
  await request("terminal/release", params);
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
  });
};

const DONE_CMD = 'process.stdout.write("omp ran ls\\n")';

const heldCommand = (): string => {
  const marker = JSON.stringify(`${cwd}/${MARKER_FILE.release}`);
  return (
    `process.stdout.write("omp command started\\n");` +
    `process.stdout.write(Array.from({length: 60}, (_, i) => "output line " + i).join("\\n") + "\\n");` +
    `const t = setInterval(() => { if (require("fs").existsSync(${marker}))` +
    ` { process.stdout.write("omp command done\\n"); process.exit(0) } }, 25);`
  );
};

const runOurTool = async (
  tool: string,
  args: Record<string, unknown>,
  intent: string,
): Promise<Record<string, unknown>> => {
  const server = mcp?.name ?? "olai";
  const toolCallId = callIdFor("write");
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: intent,
      status: "in_progress",
      ...announced(server, tool, args),
    },
  });
  const result = await callMcp("tools/call", { name: tool, arguments: args });
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: result["isError"] === true ? "failed" : "completed",
      ...wrapped(result as unknown as CallToolResult),
    },
  });
  return result;
};

/** omp's own option list for a permission request, in its own order — allow
 *  first, so nothing may read "the first option". The labels are this fake's
 *  own wording; an option is answered by its id and chosen by its kind. */
const OPTIONS = [
  { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
  { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject_once", name: "Reject", kind: "reject_once" },
  { optionId: "reject_always", name: "Always reject", kind: "reject_always" },
];

const askPermission = async (
  toolCallId: string,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "tool_call", toolCallId, title, status: "pending", ...extra },
  });
  return await request("session/request_permission", {
    sessionId,
    toolCall: { toolCallId, title },
    options: OPTIONS,
  });
};

interface Turn {
  cancelled: boolean;
}

const turn = async (text: string, mine: Turn): Promise<string> => {
  const said = commandLine(text);

  const give = (): void => {
    if (mine.cancelled) throw new Cancelled();
  };

  give();

  if (said === "hello") {
    think("weighing up hello");
    think("still weighing up hello");
    say("omp says: hello");
    return "end_turn";
  }

  if (said.startsWith("context ")) {
    const node = said.slice("context ".length).trim();
    const result = await runOurTool("outlines_read", { id: node }, `read ${node} from the outline`);
    say(JSON.stringify(result));
    return "end_turn";
  }

  if (said.startsWith("done ")) {
    const node = said.slice("done ".length).trim();
    await runOurTool("outlines_done", { id: node }, `mark ${node} done`);
    say(`marked ${node} done`);
    return "end_turn";
  }

  if (said === "permit") {
    const toolCallId = callIdFor("write");
    const title = "add a node to the outline";
    const server = mcp?.name ?? "olai";
    const answered = await askPermission(
      toolCallId,
      title,
      announced(server, "outlines_add", { title: "a node worth adding" }),
    );
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "nameless") {
    const answered = await askPermission(`:${nextCall++}`, "do something unnamed");
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "bash") {
    const toolCallId = callIdFor("bash");
    const created = await announceCommand(toolCallId, "ls", DONE_CMD);
    await finishCommand(toolCallId, created.terminalId);
    say("ran it");
    return "end_turn";
  }

  if (said === "slow") {
    const toolCallId = callIdFor("bash");
    const created = await announceCommand(toolCallId, "sleep 30", heldCommand());
    const marker = `${cwd}/${MARKER_FILE.release}`;
    while (!existsSync(marker)) {
      give();
      await sleep(100);
    }
    await finishCommand(toolCallId, created.terminalId);
    rmSync(marker, { force: true });
    say("done dawdling");
    return "end_turn";
  }

  if (said === "hush") {
    await released(cwd, give);
    say("finished after all");
    return "end_turn";
  }

  if (said === "silent") {
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "usage_update", used: 0, size: 256000 },
    });
    return "end_turn";
  }

  if (said === "error-silent") {
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "usage_update", used: 0, size: 256000 },
    });
    throw new Refused("No api key passed in");
  }

  say(`omp says: ${said}`);
  return "end_turn";
};

const configOptions = () => [
  {
    type: "select",
    id: "mode",
    name: "Mode",
    category: "mode",
    currentValue: currentMode,
    options: [
      { value: "default", name: "Default" },
      { value: "plan", name: "Plan" },
    ],
  },
  {
    type: "select",
    id: "model",
    name: "Model",
    category: "model",
    currentValue: currentModel,
    options: [
      { value: "litellm/kimi-k3", name: "Kimi K3" },
      { value: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
      ...Array.from({ length: 30 }, (_, i) => {
        const id = `${i + 1}`.padStart(2, "0")
        return { value: `litellm/fake-${id}`, name: `Fake ${id}` }
      }),
    ],
  },
  {
    type: "select",
    id: "thinking",
    name: "Thinking",
    currentValue: currentThinking,
    options: [
      { value: "off", name: "Thinking: off" },
      { value: "auto", name: "Thinking: auto" },
      { value: "low", name: "Thinking: low" },
      { value: "high", name: "Thinking: high" },
    ],
  },
];

const modes = () => ({
  currentModeId: currentMode,
  availableModes: [
    { id: "default", name: "Default" },
    { id: "plan", name: "Plan" },
  ],
});

let streaming: Turn | null = null;

let answering: Promise<unknown> = Promise.resolve();

const holdingOpen = (): boolean => {
  const marker = `${cwd}/${MARKER_FILE.holdOpen}`;
  if (!existsSync(marker)) return false;
  rmSync(marker, { force: true });
  return true;
};

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

const promptText = (params: Record<string, unknown>): string =>
  ((params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>)
    .map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : ""))
    .join("");

const pageStart = (cursor: unknown): number => {
  const at = Number(cursor ?? 0);
  return Number.isFinite(at) && at > 0 ? Math.floor(at) : 0;
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
    case "initialize":
      respond(id, {
        protocolVersion: 1,
        agentInfo: { name: "oh-my-pi", version: "18.1.21" },
        // The one method the capture records, in the real one's own words.
        // The `terminal` method alongside it is offered only to a client
        // advertising `auth.terminal`, and olai is not one.
        authMethods: [{ id: "agent", name: "Use existing local credentials", description: "Authenticate via the provider keys/OAuth state already configured under ~/.omp." }],
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: { http: true, sse: true },
          promptCapabilities: { embeddedContext: true, image: true },
          sessionCapabilities: { list: {}, fork: {}, resume: {}, close: {} },
        },
      });
      return;

    case "session/new": {
      if (holdingOpen()) await released(cwd);
      openSession(`ses_new_${++openedSessions}`, params);
      respond(id, { sessionId, configOptions: configOptions(), modes: modes() });
      setTimeout(() => {
        notify("session/update", {
          sessionId,
          update: { sessionUpdate: "available_commands_update", availableCommands: [] },
        });
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "session_info_update",
            title: TITLE,
            updatedAt: new Date().toISOString(),
          },
        });
      }, 0);
      return;
    }

    case "session/list": {
      const asked = typeof params["cwd"] === "string" ? String(params["cwd"]) : cwd;
      const sessions = STORED === ""
        ? []
        : [{
          sessionId: STORED_SESSION,
          cwd: asked,
          title: TITLE,
          updatedAt: "2026-08-21T10:00:00Z",
          _meta: { messageCount: 21, size: 8192 },
        }];
      const from = pageStart(params["cursor"]);
      const page = sessions.slice(from, from + PAGE);
      respond(id, {
        sessions: page,
        ...(from + PAGE < sessions.length ? { nextCursor: String(from + PAGE) } : {}),
      });
      return;
    }

    case "session/load": {
      const heldLoad = `${cwd}/${MARKER_FILE.holdLoad}`;
      if (existsSync(heldLoad)) {
        rmSync(heldLoad, { force: true });
        await released(cwd);
      } else if (holdingOpen()) await released(cwd);
      openSession(String(params["sessionId"]), params);
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "what did we say" },
        },
      });
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "omp remembers this conversation" },
        },
      });
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "session/set_mode":
      refuse(id, -32603, "Unsupported ACP mode");
      return;

    case "session/set_config_option": {
      const configId = String(params["configId"]);
      const value = String(params["value"]);
      if (configId === "mode") currentMode = value;
      else if (configId === "model") currentModel = value;
      else if (configId === "thinking") currentThinking = value;
      else {
        refuse(id, -32602, `Unknown config option: ${configId}`);
        return;
      }
      respond(id, { configOptions: configOptions() });
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "config_option_update", configOptions: configOptions() },
      });
      return;
    }

    case "_session/steering":
      refuse(id, -32603, "Unknown ACP ext method");
      return;

    case "session/prompt": {
      const text = promptText(params);

      if (commandLine(text) === "busy") {
        // The hint is the part of this refusal a client acts on, and it rides
        // in `error.data`, which `speaking`'s `refuse` does not write.
        emit({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: "session_busy",
            data: { hint: "steer|followUp|wait" },
          },
        });
        return;
      }

      const mine: Turn = { cancelled: false };
      if (streaming !== null) streaming.cancelled = true;
      streaming = mine;

      answering = answering.then(async () => {
        try {
          respond(id, { stopReason: await turn(text, mine) });
        } catch (cause) {
          if (cause instanceof Refused) {
            refuse(id, -32603, cause.message);
            return;
          }
          respond(id, { stopReason: cause instanceof Cancelled ? "cancelled" : "refusal" });
        } finally {
          if (streaming === mine) streaming = null;
        }
      });
      return;
    }

    case "session/cancel":
      if (streaming !== null) streaming.cancelled = true;
      return;

    default:
      if (id !== undefined) refuse(id, -32601, `method not found: ${String(method)}`);
      return;
  }
};

readMessages<Record<string, unknown>>(process.stdin, (message) => {
  void handle(message);
});
