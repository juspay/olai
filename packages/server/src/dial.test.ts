/**
 * WHERE `olai surface` GOES, given what somebody typed.
 *
 * This used to be a test of a four-rung ladder: a flag, an environment
 * variable, a socket file found by walking up from the working directory, and a
 * per-user path both ends agreed on because neither chose it. That design is
 * gone, and the reason it is gone is the reason these cases are worth having at
 * all — a resolution that can INFER a vault can infer the wrong one, and the
 * failure mode is not an error. It is a capture that lands somewhere else and
 * answers exactly like a capture that did not.
 *
 * So what is pinned now is the absence of inference, and the one derivation
 * that is left: from the address a person typed to the door this client
 * speaks to.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { dialOlai } from "./dial.ts"
import { mcpUrl } from "./mcpClient.ts"
import { MCP_PATH } from "./mcp/route.ts"

/** What `dialOlai` says it would dial, for a given `--url`. */
const resolvedTo = async (url: string): Promise<string> => {
  const endpoint = await Effect.runPromise(dialOlai({ url }))
  return endpoint.where
}

test("reports the endpoint as the user spelled it, not as it derived it", async () => {
  // `where` is what a failed dial NAMES, and the thing a person can act on is
  // the string they typed — `no surface at https://vault.example` sends them to
  // check that address, where `no surface at https://vault.example/mcp` invites
  // them to wonder what `/mcp` is and whether they were meant to type it.
  expect(await resolvedTo("https://vault.example")).toBe("https://vault.example")
  expect(await resolvedTo("http://127.0.0.1:7714/")).toBe("http://127.0.0.1:7714/")
})

test("reads NOTHING but the flag — no environment, no walk, no remembered vault", async () => {
  // The whole of the reverted design, asserted as an absence. Every variable
  // below is one the previous ladder read, and a resolution that consulted any
  // of them could send a write somewhere the caller did not name.
  const held = {
    OLAI_SOCKET: process.env["OLAI_SOCKET"],
    OLAI_URL: process.env["OLAI_URL"],
    XDG_RUNTIME_DIR: process.env["XDG_RUNTIME_DIR"],
  }
  try {
    process.env["OLAI_SOCKET"] = "/tmp/somebody-elses.sock"
    process.env["OLAI_URL"] = "http://elsewhere.invalid"
    process.env["XDG_RUNTIME_DIR"] = "/tmp/olai-dial-runtime"
    expect(await resolvedTo("http://127.0.0.1:7714")).toBe("http://127.0.0.1:7714")
  } finally {
    for (const [key, value] of Object.entries(held)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("finds `/mcp` from a bare origin, a trailing slash, or a mounted path", () => {
  // One door, spelled however a person happens to spell the address of it. The
  // last case is a server behind a reverse proxy that mounts it under a prefix,
  // which is exactly the deployment the remote story is about.
  expect(mcpUrl("http://127.0.0.1:7714")).toBe("http://127.0.0.1:7714/mcp")
  expect(mcpUrl("http://127.0.0.1:7714/")).toBe("http://127.0.0.1:7714/mcp")
  expect(mcpUrl("https://vault.example/")).toBe("https://vault.example/mcp")
  expect(mcpUrl("https://vault.example/anything")).toBe("https://vault.example/mcp")
})

test("the path it derives is the path the route is mounted at", () => {
  // The client spells `/mcp` itself rather than importing it from the route,
  // because that module pulls the MCP SDK into every `olai surface` invocation
  // including the ones that dial nothing. This is the pin that keeps the two
  // spellings one fact.
  expect(mcpUrl("http://x.invalid")).toBe(`http://x.invalid${MCP_PATH}`)
})

test("refuses an address that is not one, before anything is dialled", () => {
  // Named for the FLAG, because that is what the reader has to change. A
  // sentence about URL parsing would leave them looking at the verb.
  expect(() => mcpUrl("127.0.0.1:7714")).toThrow(/--url/)
  expect(() => mcpUrl("")).toThrow(/--url/)
})

test("refuses a scheme this client cannot speak, naming what --url is for", () => {
  // `file:` and `ws:` both parse as URLs, so the scheme is a second question and
  // not the same one. A `ws://` in particular is the shape somebody would reach
  // for by analogy with the browser's socket — which is a different face
  // entirely, and one this door is deliberately not.
  expect(() => mcpUrl("file:///home/srid/vault")).toThrow(/olai web/)
  expect(() => mcpUrl("ws://127.0.0.1:7714")).toThrow(/olai web/)
})
