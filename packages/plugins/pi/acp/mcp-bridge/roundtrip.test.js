import { describe, expect, test } from "bun:test";

import { registerServerTools } from "./wire.mjs";
import { serverToClientPlan } from "./naming.js";

const pinned = (spec) => new URL(`../shim/node_modules/${spec}`, import.meta.url);

const { Client } = await import(pinned("@modelcontextprotocol/sdk/dist/esm/client/index.js").href);
const { McpServer } = await import(pinned("@modelcontextprotocol/sdk/dist/esm/server/mcp.js").href);
const { InMemoryTransport } = await import(
  pinned("@modelcontextprotocol/sdk/dist/esm/inMemory.js").href
);
const { Type } = await import(pinned("typebox/build/index.mjs").href);
const { z } = await import(pinned("zod/index.js").href);

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
    "outlines_read",
    {
      description: "read a node",
      inputSchema: { node: z.string().describe("the node's name") },
    },
    async (args) => ({ content: [{ type: "text", text: `# the node ${args.node} answered the wire` }], structuredContent: { title: args.node, file: "house.olai" } }),
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

    expect(names).toEqual(["olai_outlines_read"]);
    const def = pi.registered.get("olai_outlines_read");
    expect(def.parameters.properties.node?.type).toBe("string");
    expect(def.parameters.required).toEqual(["node"]);

    const result = await def.execute("tc-1", { node: "install" });
    expect(result.structuredContent).toBeUndefined();
    expect(result.details).toEqual({ title: "install", file: "house.olai" });
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
    expect(result.details).toBeUndefined();
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain("the tool answered an error");
    expect(result.content[0].text).toContain("no session here");

    await client.close();
  });
});
