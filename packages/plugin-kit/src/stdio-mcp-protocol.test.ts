import { expect, test } from "bun:test"
import { frame, parse, step, type Exchange } from "./stdio-mcp-protocol.ts"

const empty: Exchange = { initialized: false, tools: [] }
const initialize = { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }
const page = (name: string, nextCursor?: string) => ({
  jsonrpc: "2.0", id: 2,
  result: { tools: [{ name, inputSchema: { properties: { aim: {} } } }], nextCursor },
})

test("framing preserves partial lines, skips whitespace and bounds input", () => {
  expect(frame('{"json', 'rpc":"2.0"}\n  \nnext')).toEqual({ lines: ['{"jsonrpc":"2.0"}'], rest: "next" })
  expect(frame("", "x".repeat(4 * 1024 * 1024 + 1))).toEqual({ error: "MCP response exceeds 4 MiB" })
})

test("parsing rejects non-messages independently of the exchange", () => {
  for (const line of ["not JSON", "null", "[]", "{}", '{"jsonrpc":"1.0"}']) {
    expect("error" in parse(line)).toBe(true)
  }
  expect(parse(JSON.stringify(initialize))).toEqual({ message: initialize })
})

test("initialize, notifications and pagination are immutable protocol steps", () => {
  const initialized = step(empty, initialize)
  expect(empty.initialized).toBe(false)
  expect(initialized.send.map(message => message["method"])).toEqual(["notifications/initialized", "tools/list"])
  const first = step(initialized.state, page("one", "next"))
  expect(first.answer).toBeUndefined()
  expect(first.send[0]?.["params"]).toEqual({ cursor: "next" })
  expect(step(first.state, { jsonrpc: "2.0", method: "notifications/message" })).toEqual({ state: first.state, send: [] })
  const last = step(first.state, page("two"))
  expect(last.answer).toEqual({ _tag: "answered", tools: [{ name: "one", inputs: ["aim"] }, { name: "two", inputs: ["aim"] }] })
  expect(first.state.tools).toHaveLength(1)
})

test("duplicate initialization and premature or malformed tool replies are refused", () => {
  const initialized = step(empty, initialize).state
  expect(step(initialized, initialize).answer).toEqual({ _tag: "failed", cause: "invalid initialize response" })
  for (const [state, message] of [[empty, page("one")], [initialized, { jsonrpc: "2.0", id: 2, result: { tools: 42 } }]] as const) {
    expect(step(state, message).answer).toEqual({ _tag: "failed", cause: "invalid tools/list response" })
  }
})
