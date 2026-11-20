import * as assert from "node:assert";

const CALL_TIMEOUT = 30_000;

interface Reply {
  readonly id?: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

export interface TerminalAgent {
  readonly call: (method: string, params?: unknown) => Promise<Reply>;
  readonly notify: (method: string) => void;
  readonly stop: () => void;
}

export const connectTerminalAgent = async (
  mcpUrl: string,
): Promise<TerminalAgent> => {
  let next = 0;
  const waiting = new Map<number, (reply: Reply) => void>();
  const ac = new AbortController();
  const swallowAbort = (cause: unknown): void => {
    if (ac.signal.aborted) return;
    throw cause;
  };

  const post = (message: Readonly<Record<string, unknown>>): Promise<Response> =>
    fetch(mcpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(message),
      signal: ac.signal,
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
    void post({ jsonrpc: "2.0", id, method, params })
      .then(async (response) => {
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
      })
      .catch(swallowAbort);
    return answered;
  };

  const agent: TerminalAgent = {
    call,
    notify: (method) => {
      void post({ jsonrpc: "2.0", method }).then(() => undefined).catch(swallowAbort);
    },
    stop: () => {
      ac.abort();
      for (const [id, reply] of waiting) {
        waiting.delete(id);
        reply({ id, error: { code: -1, message: "stopped" } });
      }
    },
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
