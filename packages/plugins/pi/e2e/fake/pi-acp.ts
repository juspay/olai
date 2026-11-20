#!/usr/bin/env bun

import { announced, wrapped, type CallToolResult } from "olai-plugin-pi/testlib";
import { existsSync, realpathSync, rmSync } from "node:fs";

import { commandLine } from "@olai/tests/agent/command.ts";
import { readMessages } from "@olai/tests/harness/ndjson.ts";
import { emitter, released, speaking } from "@olai/tests/harness/scripted.ts";

const emit = emitter(process.stdout);
const { notify, refuse, respond, take } = speaking(emit, "pi");

const cwd = process.cwd();

const thisTree = (candidate: unknown): boolean =>
  typeof candidate === "string" &&
  (candidate === cwd || realpathSync(candidate) === cwd);

class Cancelled extends Error {}

const STORED = process.env.OLAI_FAKE_PI_STORED ?? "";

const STORED_SESSION = "pi_stored_session";

let sessionId = "";
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

const say = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  });
};

const BANNER = "pi v0.84.2\n---\n\n## Context\n- /served/AGENTS.md\n\n";

const info = (running: boolean, queueDepth: number): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "session_info_update",
      _meta: { piAcp: { queueDepth, running } },
    },
  });
};

const turn = async (text: string): Promise<string> => {
  const said = commandLine(text);

  if (said === "slow") {
    const toolCallId = "bash:0";
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "sleep 30",
        kind: "execute",
        status: "pending",
        content: [{ type: "terminal", terminalId: toolCallId }],
        _meta: { terminal_info: { terminal_id: toolCallId, cwd } },
      },
    });
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status: "in_progress" },
    });
    notify("session/update", { sessionId, update: { sessionUpdate: "tool_call_update", toolCallId,
      _meta: { terminal_output: { terminal_id: toolCallId, data: "pi command started\n" } } } });
    await released(cwd, () => {
      if (cancelled) throw new Cancelled();
    });
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "completed",
        _meta: {
          terminal_output: { terminal_id: toolCallId, data: "(no output)" },
          terminal_exit: { terminal_id: toolCallId, exit_code: 0, signal: null },
        },
      },
    });
    say("done dawdling");
    return "end_turn";
  }

  if (said === "silent") {
    return "end_turn";
  }

  if (said.startsWith("mcp read title ") || said.startsWith("mcp done ")) {
    const read = said.startsWith("mcp read title ");
    const node = said.slice(read ? "mcp read title ".length : "mcp done ".length).trim();
    const tool = read ? "outlines_read" : "outlines_done";
    const args = read ? { id: node } : { id: node };
    const toolCallId = `olai_${tool}:${++nextCall}`;
    notify("session/update", { sessionId, update: { sessionUpdate: "tool_call", toolCallId,
      ...announced("olai", tool, args), status: "in_progress" } });
    const result = await callMcp("tools/call", { name: tool, arguments: args });
    notify("session/update", { sessionId, update: { sessionUpdate: "tool_call_update", toolCallId,
      status: result["isError"] === true ? "failed" : "completed", ...wrapped(result as unknown as CallToolResult) } });
    say(JSON.stringify(result));
    return "end_turn";
  }

  if (said === "hello") {
    say("pi says: hello");
    return "end_turn";
  }

  say(`pi says: ${said}`);
  return "end_turn";
};

let currentModel = "litellm/kimi-k3";

const configOptions = () => [
  {
    type: "select",
    id: "model",
    category: "model",
    name: "Model",
    currentValue: currentModel,
    options: [
      { value: "litellm/kimi-k3", name: "litellm/kimi-k3" },
      { value: "litellm/claude-opus-4-6", name: "litellm/claude-opus-4-6" },
    ],
  },
  {
    type: "select",
    id: "thought_level",
    category: "thought_level",
    name: "Thinking",
    currentValue: "medium",
    options: [
      { value: "off", name: "Thinking: off" },
      { value: "medium", name: "Thinking: medium" },
      { value: "high", name: "Thinking: high" },
    ],
  },
];

const modes = () => ({
  currentModeId: "medium",
  availableModes: [
    { id: "off", name: "Thinking: off" },
    { id: "medium", name: "Thinking: medium" },
    { id: "high", name: "Thinking: high" },
  ],
});

let queue: Promise<unknown> = Promise.resolve();

let running = false;
let waiting = 0;

let cancelled = false;

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
        agentInfo: { name: "pi-acp", title: "pi ACP adapter", version: "0.0.33" },
        authMethods: [
          {
            id: "pi_terminal_login",
            name: "Launch pi in the terminal",
            description: "Start pi in an interactive terminal to configure API keys or login",
            type: "terminal",
            args: ["--terminal-login"],
            env: {},
          },
        ],
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: { http: true, sse: true },
          promptCapabilities: { image: true, audio: false, embeddedContext: false },
          sessionCapabilities: { list: {}, delete: {} },
        },
      });
      return;

    case "session/new": {
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
      sessionId = `pi_new_${++openCalls}`;
      respond(id, {
        sessionId,
        configOptions: configOptions(),
        models: {
          availableModels: [{ modelId: currentModel, name: currentModel }],
          currentModelId: currentModel,
        },
        modes: modes(),
        _meta: { piAcp: { startupInfo: BANNER } },
      });
      setTimeout(() => say(BANNER), 0);
      return;
    }

    case "session/list":
      respond(id, {
        sessions:
          STORED === "" || !thisTree(params["cwd"])
            ? []
            : [{
              sessionId: STORED_SESSION,
              cwd: String(params["cwd"]),
              title: "a pi conversation",
              updatedAt: "2026-08-21T09:00:00Z",
            }],
        nextCursor: null,
        _meta: {},
      });
      return;

    case "session/load": {
      sessionId = String(params["sessionId"]);
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
          content: { type: "text", text: "pi remembers this conversation" },
        },
      });
      respond(id, {
        configOptions: configOptions(),
        models: {
          availableModels: [{ modelId: currentModel, name: currentModel }],
          currentModelId: currentModel,
        },
        modes: modes(),
        _meta: { piAcp: { startupInfo: null } },
      });
      return;
    }

    case "session/set_mode":
      refuse(id, -32602, `Unknown modeId: ${String(params["modeId"])}`);
      return;

    case "session/set_config_option": {
      const configId = String(params["configId"]);
      if (configId !== "model" && configId !== "thought_level") {
        refuse(id, -32602, `Unknown config option: ${configId}`);
        return;
      }
      if (configId === "model") currentModel = String(params["value"]);
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "_session/steering":
      refuse(id, -32601, '"Method not found": _session/steering');
      return;

    case "session/prompt": {
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>;
      const text = blocks
        .map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : ""))
        .join("");
      if (running || waiting > 0) {
        waiting += 1;
        say(`Queued message (position ${waiting}).`);
        info(true, waiting);
      }
      queue = queue
        .then(async () => {
          if (waiting > 0) {
            waiting -= 1;
            say(`Starting queued message. (${waiting} remaining)`);
          }
          if (cancelled) {
            info(false, waiting);
            respond(id, { stopReason: "cancelled" });
            return;
          }
          running = true;
          try {
            const stopReason = await turn(text);
            running = false;
            info(false, waiting);
            respond(id, { stopReason });
          } catch {
            running = false;
            info(false, waiting);
            respond(id, { stopReason: "cancelled" });
          }
        });
      return;
    }

    case "session/cancel":
      cancelled = true;
      void queue.then(() => {
        cancelled = false;
      });
      return;

    default:
      if (id !== undefined) refuse(id, -32601, `method not found: ${String(method)}`);
      return;
  }
};

let openCalls = 0;

readMessages<Record<string, unknown>>(process.stdin, (message) => {
  void handle(message);
});
