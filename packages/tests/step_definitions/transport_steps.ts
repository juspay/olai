import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";

Then("the MCP transport answers with status {int}", async function (this: OlaiWorld, status: number) {
  const response = await fetch(new URL("/mcp", this.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status);
  if (status === 200) {
    const reply = await response.json();
    assert.ok(reply.result.tools.some((tool: { name: string }) => tool.name === "read_node"));
  }
});

Then("the MCP vault refuses a write because no directory is served", async function (this: OlaiWorld) {
  const response = await fetch(new URL("/mcp", this.baseUrl), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "set_title", arguments: { id: "unreachable", title: "must not land" },
    } }), signal: AbortSignal.timeout(10000),
  });
  const result = (await response.json()).result;
  assert.equal(result.isError, true);
  assert.ok(JSON.stringify(result).includes("serving no directory"));
});

Then("the MCP vault can read an outline", async function (this: OlaiWorld) {
  const response = await fetch(new URL("/mcp", this.baseUrl), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "list_outlines", arguments: {},
    } }), signal: AbortSignal.timeout(10000),
  });
  const result = (await response.json()).result;
  assert.notEqual(result.isError, true);
  const reading = JSON.parse(result.content.find((part: { type: string }) => part.type === "text").text);
  assert.ok(reading.outlines.length > 0);
});
