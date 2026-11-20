import { Client } from "../@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { StreamableHTTPClientTransport } from "../@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js";
import { SSEClientTransport } from "../@modelcontextprotocol/sdk/dist/esm/client/sse.js";
import { Type } from "../typebox/build/index.mjs";

import { parseServers, serverToClientPlan } from "./naming.js";
import { registerServerTools } from "./wire.mjs";

const transportOf = (plan) => {
  switch (plan.kind) {
    case "stdio":
      return new StdioClientTransport({ command: plan.command, args: plan.args, env: plan.env });
    case "http":
      return new StreamableHTTPClientTransport(new URL(plan.url), { requestInit: { headers: plan.headers } });
    case "sse":
      return new SSEClientTransport(new URL(plan.url));
    default:
      throw new Error(`no transport for a ${plan.kind} server`);
  }
};

export default function olaiMcpBridge(pi) {
  const servers = parseServers(process.env.PI_ACP_MCP_SERVERS);
  if (servers.length === 0) return;

  pi.on("session_start", async (_event, ctx) => {
    await Promise.all(
      servers.map(async (spec) => {
        const plan = serverToClientPlan(spec?.name, spec);
        if (plan === null) {
          ctx.ui.notify(`[mcp] ${spec?.name ?? "?"}: the bridge has no handler for this server shape`, "warning");
          return;
        }
        const client = new Client({ name: `pi-acp-${plan.server}`, version: "0.0.0" });
        try {
          await client.connect(transportOf(plan));
        } catch (error) {
          ctx.ui.notify(`[mcp] ${plan.server}: did not attach — ${textOf(error)}`, "error");
          return;
        }
        try {
          await registerServerTools(pi, Type, client, plan);
        } catch (error) {
          ctx.ui.notify(`[mcp] ${plan.server}: connected, but tools would not list — ${textOf(error)}`, "error");
        }
      }),
    );
  });
}

const textOf = (error) => (error instanceof Error ? error.message : String(error));
