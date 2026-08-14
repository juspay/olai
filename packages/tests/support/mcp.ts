/**
 * An MCP client, for the scenarios about the agent that is NOT ours.
 *
 * Everything else in this suite drives olai through a browser, because the
 * browser is what a person uses. The external tool surface has no browser: its
 * client is a coding agent in a terminal, so the only honest way to exercise it
 * is to be one — launch the command an agent would be configured with, speak
 * JSON-RPC down its pipes, and then look at the page to see what it did.
 *
 * It is deliberately hand-rolled and tiny. Pulling in an MCP SDK here would
 * test that SDK's framing against ours; forty lines of `write a line, read a
 * line` tests OURS, which is the thing that could be wrong. Reading the lines
 * is `./ndjson.ts`, which is this package's own and shared with the two fake
 * servers — the same argument, one directory over.
 */

import { type ChildProcess, spawn } from "node:child_process";
import * as path from "node:path";

import { readMessages } from "./ndjson.ts";
import { isolateEnv } from "./workers.ts";

/** How long one call may take before it is a hang, and how long the process
 *  gets to come up. Generous by the same argument as the rest of the harness:
 *  a loaded CI runner is slow, and what is being told apart is "slow" from
 *  "never". */
const CALL_TIMEOUT = 30_000;

interface Reply {
  readonly id?: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

export interface TerminalAgent {
  /** One JSON-RPC request, answered. */
  readonly call: (method: string, params?: unknown) => Promise<Reply>;
  readonly notify: (method: string) => void;
  readonly stop: () => void;
}

/**
 * Launch `olai mcp <dir>` and complete the MCP handshake, as a client does.
 *
 * The binary is the same nix-built one every server in this suite is spawned
 * from, which is the point: the subcommand has to EXIST in the packaged
 * artefact, and nothing else in the suite would notice if it stopped shipping.
 */
export const connectTerminalAgent = async (
  bin: string,
  directory: string,
): Promise<TerminalAgent> => {
  const child: ChildProcess = spawn(bin, ["mcp", directory, "--commit=off"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: isolateEnv(`${directory}.xdg`, {
      // stderr diagnostics stay logfmt; do not inherit OLAI_LOG=pretty.
      OLAI_LOG: "logfmt",
    }),
  });

  // stderr is where it may say anything that is not a frame, so it is where a
  // failure will explain itself — kept for the diagnostics below and nowhere
  // else, because a scenario has nothing to assert about it.
  let said = "";
  let next = 0;
  const waiting = new Map<number, (reply: Reply) => void>();

  child.stderr?.setEncoding("utf8");
  // One message per line is the transport's contract, and reading it that way
  // is `support/ndjson.ts` — a line that will not parse is left to throw here,
  // because this client is reading a protocol WE serve and a frame that is not
  // one is the bug this suite exists to catch.
  if (child.stdout !== null) {
    readMessages<Reply>(child.stdout, (message) => {
      if (message.id === undefined) return;
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    });
  }
  child.stderr?.on("data", (chunk: string) => {
    said += chunk;
  });

  const call = (method: string, params?: unknown): Promise<Reply> => {
    const id = ++next;
    const answered = new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `the terminal agent's \`${method}\` was never answered.\n  stderr: ${
              said.trim() || "(empty)"
            }`,
          ),
        );
      }, CALL_TIMEOUT);
      waiting.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
    child.stdin?.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
    );
    return answered;
  };

  const agent: TerminalAgent = {
    call,
    notify: (method) => {
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
    },
    stop: () => {
      if (child.exitCode === null) child.kill("SIGKILL");
    },
  };

  const ready = await call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "olai's own e2e suite", version: "0" },
  });
  if (ready.error !== undefined) {
    agent.stop();
    throw new Error(
      `the terminal agent refused to initialize: ${ready.error.message}`,
    );
  }
  agent.notify("notifications/initialized");
  return agent;
};

/** Call one tool, and fail with what it said rather than with a bare
 *  `undefined` two assertions later. */
export const callTool = async (
  agent: TerminalAgent,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> => {
  const answered = await agent.call("tools/call", { name, arguments: args });
  if (answered.error !== undefined) {
    throw new Error(
      `\`${name}\` failed at the protocol level: ${answered.error.message}`,
    );
  }
  const result = answered.result ?? {};
  if (result["isError"] === true) {
    throw new Error(
      `\`${name}\` was refused: ${JSON.stringify(result["content"])}`,
    );
  }
  return result;
};
