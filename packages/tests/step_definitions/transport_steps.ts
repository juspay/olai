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
    // An HTTP 200 with tool names still fails agent startup if schemas are
    // missing (#548). Check every tool, including after plugin reactivation.
    for (const tool of reply.result.tools) {
      assert.equal(tool.inputSchema?.type, "object", `${tool.name}: missing MCP inputSchema`);
    }
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
  // THE ADAPTER'S WORDS, AND NOT OLAI'S ANY MORE. It said `The capability for
  // "outlines_title" is not active.` — olai's own filter, which hid a tool
  // whose row had left and refused the call if one came anyway. #546 deleted
  // that filter: a verb rides its row's entry in the rooted bundle, `reroster`
  // takes the whole entry away, and there is no handler left for olai to word
  // a refusal from (juspay/kolu#2234).
  //
  // WHAT REPLACED IT SAYS MORE, which is why the wording is asserted rather
  // than only the error: an agent holding a tool list from before the switch
  // made a reasonable call against a name that WAS real, so it is told the
  // sibling was dropped and to re-read the list — not that the tool is
  // unknown, which would tell it to doubt a name it did not invent.
  const said = result.content.map((part: { text?: string }) => part.text ?? "").join(" ");
  // NAMED, AND REFUSED — the two halves that are true on every path. It read
  // `The capability for "outlines_title" is not active.`, which was olai's own
  // filter talking; #546 deleted that filter, so what answers now is the
  // adapter's (juspay/kolu#2234).
  //
  // NOT THE EXACT SENTENCE, and the reason is a discrepancy worth knowing
  // rather than slack. kolu words this two ways: `tool "…" is no longer served
  // — the sibling "…" was dropped` when it remembers the verb was real, and
  // `unknown tool "…"` when it does not. Over an in-process serve the first
  // withdrawal already gets the remembering one; over the PACKAGED serve this
  // scenario drives, the FIRST withdrawal gets `unknown tool` and every later
  // one gets the remembering one — with 39 tools listed immediately before the
  // switch either way, so the verb was demonstrably served. That is kolu's
  // departed bookkeeping under an ordering only the packaged serve produces,
  // reported upstream; asserting one sentence here would pin olai's suite to
  // whichever half of it this path happens to take.
  assert.ok(said.includes("outlines_title"), said);
  assert.ok(!said.includes("landed"), said);
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
