/**
 * The round trip the pin ships: an MCP server SDK-side of an in-memory
 * pair answers a tool, and the extension's wiring makes it `server_tool`
 * callable — called through pi's OWN registered definition, not by
 * reaching for the client again.
 *
 * The imports follow the extension's own rule (relative URLs into the
 * pin's node_modules — `just install` runs the `npm ci` under acp/ that
 * puts them there), because what this file is for is failing loudly the
 * day the SDK's layout drifts under the loader discipline rather than
 * computing around it.
 */
import { describe, expect, test } from "bun:test";

import { registerServerTools } from "./wire.mjs";
import { serverToClientPlan } from "./naming.js";

const rel = (spec) => new URL(spec, import.meta.url);

const { Client } = await import(rel("../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js").href);
const { McpServer } = await import(rel("../node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js").href);
const { InMemoryTransport } = await import(
  rel("../node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js").href
);
const { Type } = await import(rel("../node_modules/typebox/build/index.mjs").href);
const { z } = await import(rel("../node_modules/zod/index.js").href);

// A pi stands the registered definitions up: registerTool remembers, and
// calling it is what an LLM's tool call arrives as.
const fakePi = () => {
  const registered = new Map();
  return {
    registered,
    registerTool(def) {
      registered.set(def.name, def);
    },
  };
};

const makeServer = () => {
  const server = new McpServer({ name: "olai-double", version: "0.0.0" });
  server.registerTool(
    "read_node",
    {
      description: "read a node",
      inputSchema: { node: z.string().describe("the node's name") },
    },
    async (args) => ({ content: [{ type: "text", text: `# the node ${args.node} answered the wire` }] }),
  );
  return server;
};

describe("the MCP round trip through pi's table", () => {
  test("an olai tool registers under the panel's name and answers a call", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const plan = serverToClientPlan("olai", { name: "olai", type: "http", url: "http://127.0.0.1:9/mcp" });

    const client = new Client({ name: "pi-acp-olai", version: "0.0.0" });
    const server = makeServer();
    await Promise.all([client.connect(clientSide), server.connect(serverSide)]);

    const pi = fakePi();
    const names = await registerServerTools(pi, Type, client, plan);

    // the panel's name, not the wire's:
    expect(names).toEqual(["olai_read_node"]);
    const def = pi.registered.get("olai_read_node");
    // the shape, not the plain object: the string stays a string, the
    // one required name stays required.
    expect(def.parameters.properties.node?.type).toBe("string");
    expect(def.parameters.required).toEqual(["node"]);

    // and the call round-trips — the model's call id passes through
    // untouched and the tool's whole content arrives as the result text:
    const result = await def.execute("tc-1", { node: "install" });
    expect(result.content).toEqual([{ type: "text", text: "# the node install answered the wire" }]);

    await client.close();
  });

  test("a tool that fails surfaces as the error text", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: "kolu-double", version: "0.0.0" });
    server.registerTool("list_terminals", { description: "x" }, async () => {
      throw new Error("no session here");
    });

    const client = new Client({ name: "pi-acp-kolu", version: "0.0.0" });
    await Promise.all([client.connect(clientSide), server.connect(serverSide)]);

    const pi = fakePi();
    await registerServerTools(pi, Type, client, serverToClientPlan("kolu", { name: "kolu", command: "x" }));
    const result = await pi.registered.get("kolu_list_terminals").execute("tc-2", {});
    expect(result.content[0].text).toContain("the tool answered an error");
    expect(result.content[0].text).toContain("no session here");

    await client.close();
  });
});
