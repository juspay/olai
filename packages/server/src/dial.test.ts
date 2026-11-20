import { expect, test } from "bun:test"
import { Effect } from "effect"

import { dialOlai, itemAddress } from "./dial.ts"
import { mcpUrl } from "./mcpClient.ts"
import { MCP_PATH } from "olai-plugin-mcp/testlib"

const resolvedTo = async (url: string): Promise<string> => {
  const endpoint = await Effect.runPromise(dialOlai({ url }))
  return endpoint.where
}

test("reports the endpoint as the user spelled it, not as it derived it", async () => {
  expect(await resolvedTo("https://vault.example")).toBe("https://vault.example")
  expect(await resolvedTo("http://127.0.0.1:7714/")).toBe("http://127.0.0.1:7714/")
})

test("reads NOTHING but the flag — no environment, no walk, no remembered vault", async () => {
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
  expect(mcpUrl("http://127.0.0.1:7714")).toBe("http://127.0.0.1:7714/mcp")
  expect(mcpUrl("http://127.0.0.1:7714/")).toBe("http://127.0.0.1:7714/mcp")
  expect(mcpUrl("https://vault.example/")).toBe("https://vault.example/mcp")
  expect(mcpUrl("https://vault.example/anything")).toBe("https://vault.example/mcp")
})

test("the path it derives is the path the route is mounted at", () => {
  expect(mcpUrl("http://x.invalid")).toBe(`http://x.invalid${MCP_PATH}`)
})

test("refuses an address that is not one, before anything is dialled", () => {
  expect(() => mcpUrl("127.0.0.1:7714")).toThrow(/--url/)
  expect(() => mcpUrl("")).toThrow(/--url/)
})

test("refuses a scheme this client cannot speak, naming what --url is for", () => {
  expect(() => mcpUrl("file:///home/srid/vault")).toThrow(/olai web/)
  expect(() => mcpUrl("ws://127.0.0.1:7714")).toThrow(/olai web/)
})

test("fills the item template the server publishes, and refuses any other spelling", () => {
  const template = (placeholder: string) =>
    `surface://collections/outlines/outlines/${placeholder}`
  expect(itemAddress(template("{+id}"), "_olai/Inbox.olai")).toBe(
    "surface://collections/outlines/outlines/_olai/Inbox.olai",
  )
  expect(itemAddress(template("{+id}"), "a b:c%d")).toBe(
    "surface://collections/outlines/outlines/a%20b%3Ac%25d",
  )
  expect(() => itemAddress(template("{id}"), "x")).toThrow(/does not carry \{\+id\}/)
  expect(() => itemAddress("surface://collections/outlines/outlines", "x")).toThrow(
    /does not carry \{\+id\}/,
  )
})
