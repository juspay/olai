import * as http from "node:http";
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
    assert.ok(reply.result.tools.some((tool: { name: string }) => tool.name === "outlines_read"));
  }
});

Then("the MCP vault refuses a write because no directory is served", async function (this: OlaiWorld) {
  const response = await fetch(new URL("/mcp", this.baseUrl), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "outlines_title", arguments: { id: "unreachable", title: "must not land" },
    } }), signal: AbortSignal.timeout(10000),
  });
  const result = (await response.json()).result;
  assert.equal(result.isError, true);
  assert.ok(result.content.some((part: { type: string; text?: string }) =>
    part.type === "text" && part.text?.includes('The capability for "outlines_title" is not active.')));
});

Then("the MCP vault can read an outline", async function (this: OlaiWorld) {
  const response = await fetch(new URL("/mcp", this.baseUrl), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "outlines_map", arguments: {},
    } }), signal: AbortSignal.timeout(10000),
  });
  const result = (await response.json()).result;
  assert.notEqual(result.isError, true);
  const reading = JSON.parse(result.content.find((part: { type: string }) => part.type === "text").text);
  assert.ok(reading.outlines.length > 0);
});


const waitForStatus = async (url: URL, status: number) => {
  const deadline = Date.now() + 10000;
  let actual: number | undefined;
  do {
    try {
      actual = (await fetch(url, { signal: AbortSignal.timeout(1000) })).status;
      if (actual === status) return;
    } catch { /* The shared listener may still be rebinding. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.equal(actual, status, `${url.pathname} after transport reconciliation`);
};

Then("the browser build answers with status {int}", async function (this: OlaiWorld, status: number) {
  await waitForStatus(new URL("/", this.baseUrl), status);
});

Then("the browser socket route answers with status {int}", async function (this: OlaiWorld, status: number) {
  const target = new URL("/rpc/ws", this.baseUrl);
  const deadline = Date.now() + 10000;
  let actual = 0;
  do {
    actual = await new Promise<number>((resolve) => {
      const request = http.request(target, { headers: {
        Connection: "Upgrade", Upgrade: "websocket",
        "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      } });
      request.on("response", (response) => { response.resume(); resolve(response.statusCode ?? 0); });
      request.on("upgrade", (_response, socket) => { socket.destroy(); resolve(101); });
      request.on("error", () => resolve(0));
      request.setTimeout(1000, () => request.destroy());
      request.end();
    });
    if (actual === status) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.equal(actual, status, "websocket upgrade after transport withdrawal");
});
