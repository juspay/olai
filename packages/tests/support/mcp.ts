/**
 * An MCP client, for the scenarios about the agent that is NOT ours.
 *
 * Everything else in this suite drives olai through a browser, because the
 * browser is what a person uses. The external tool surface has no browser: its
 * client is a coding agent in a terminal, so the only honest way to exercise
 * it is to be one — POST JSON-RPC at the running server's `/mcp`, the same
 * URL a `.mcp.json` names, and then look at the page to see what it did.
 *
 * Loopback, no bearer: that is the contract the route pins. The chat keeps
 * sending a token; this client does not, on purpose, so a regression that
 * re-required one on 127.0.0.1 fails here the way a real agent would.
 *
 * It is deliberately hand-rolled and tiny. Pulling in an MCP SDK here would
 * test that SDK's framing against ours; a POST and a JSON body tests OURS,
 * which is the thing that could be wrong.
 */

import * as assert from "node:assert";

/** How long one call may take before it is a hang. Generous by the same
 *  argument as the rest of the harness: a loaded CI runner is slow, and what
 *  is being told apart is "slow" from "never". */
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
 * Complete the MCP handshake against a running server's `/mcp`.
 *
 * The URL is the one the page is already talking to. That is the whole of
 * the one-brain claim: this client holds no store and starts no process.
 */
export const connectTerminalAgent = async (
  mcpUrl: string,
): Promise<TerminalAgent> => {
  let next = 0;
  const waiting = new Map<number, (reply: Reply) => void>();
  const pending: Promise<void>[] = [];

  const post = (message: Readonly<Record<string, unknown>>): Promise<Response> =>
    fetch(mcpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(message),
    });

  const call = (method: string, params?: unknown): Promise<Reply> => {
    const id = ++next;
    const answered = new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`the terminal agent's \`${method}\` was never answered`));
      }, CALL_TIMEOUT);
      waiting.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
    pending.push(
      post({ jsonrpc: "2.0", id, method, params }).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `the terminal agent's \`${method}\` was refused at HTTP ${response.status}: ${
              (await response.text()).trim() || "(empty)"
            }`,
          );
        }
        const reply = (await response.json()) as Reply;
        waiting.get(id)?.(reply);
        waiting.delete(id);
      }),
    );
    return answered;
  };

  const agent: TerminalAgent = {
    call,
    notify: (method) => {
      pending.push(post({ jsonrpc: "2.0", method }).then(() => undefined));
    },
    stop: () => {},
  };

  const ready = await call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "olai's own e2e suite", version: "0" },
  });
  if (ready.error !== undefined) {
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

/**
 * Call one tool the suite EXPECTS to be refused, and hand back the answer
 * rather than throwing it.
 *
 * The twin of {@link callTool}, and it exists because "a refusal is an answer"
 * is a promise this suite asserts from two directions: a write the ops layer
 * says no to comes back as a tool RESULT carrying its kind, never as a
 * JSON-RPC error — which would be the server saying it could not process the
 * call, and is not what happened. That assertion is the invariant rather than
 * a detail of either step, so it is spelled once here instead of copied into
 * every step whose subject is a refusal.
 */
export const tryTool = async (
  agent: TerminalAgent,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> => {
  const answered = await agent.call("tools/call", { name, arguments: args });
  assert.strictEqual(
    answered.error,
    undefined,
    "a refused write came back as a JSON-RPC error, which says the server " +
      "could not process the call — but it processed it and said no, and " +
      "that answer has to reach the model",
  );
  return answered.result ?? {};
};
