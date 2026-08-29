/**
 * The pi side of the pin's MCP bridge — what pi-acp's patched spawn loads
 * into every session the ACP wire handed tool servers:
 *
 *     pi --mode rpc … -e <this file, BUNDLED>       with the child's env
 *     PI_ACP_MCP_SERVERS='[{"name":"olai","type":"http","url":…}, …]'
 *
 * each one becoming real pi tools named `${server}_${tool}` — the name
 * olai's panel already reads.
 *
 * This is the shell the pin's build BUNDLES into one self-contained file
 * (acp/nix's olai-pi-mcp-bridge): pi loads extensions through jiti from
 * inside a bun-compiled binary, whose module resolution cannot trace a
 * node_modules tree by the relative-URL discipline that plain node walks —
 * so what ships is the esbuild-bundle of THIS file, and every import here
 * is a static plain-string specifier the bundler can inline: relative to
 * this file's immortal spot in the shim's tree (`olai-acp/node_modules/
 * olai-pi-mcp-bridge/`), one directory up from the SDK and typebox.
 *
 * The wiring itself — registerTool'ing a connected SDK client's tools under
 * the panel's names — is `wire.mjs`, and the vocabulary it shares with
 * olai's surface is `naming.js`; both are dependency-free, so the pin's
 * `bun test acp/mcp-bridge` exercises them without this shell in the way.
 */

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
    // Per server: one client, its tools listed once, each registerTool'd
    // under the panel's name. Servers connect in parallel, and each one's
    // failure is ITS sentence — spoken into the transcript — rather than
    // one broken kolu taking olai's tools with it.
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
