export type Evidence =
  | {
    readonly _tag: "answered"
    readonly tools: ReadonlyArray<{ readonly name: string; readonly inputs: ReadonlyArray<string> }>
  }
  | { readonly _tag: "couldNotStart"; readonly cause: string }
  | { readonly _tag: "timedOut"; readonly deadlineMs: number }
  | { readonly _tag: "closed" }
  | { readonly _tag: "failed"; readonly cause: string }


export interface Exchange {
  readonly initialized: boolean
  readonly tools: Extract<Evidence, { _tag: "answered" }>["tools"]
}
export interface Step {
  readonly state: Exchange
  readonly send: ReadonlyArray<Record<string, unknown>>
  readonly answer?: Evidence
}

export const frame = (buffer: string, chunk: string): { lines: string[]; rest: string } | { error: string } => {
  const text = buffer + chunk
  if (text.length > 4 * 1024 * 1024) return { error: "MCP response exceeds 4 MiB" }
  const lines = text.split("\n")
  const rest = lines.pop()!
  return { lines: lines.map(line => line.trim()).filter(line => line !== ""), rest }
}

export const parse = (line: string): { message: Record<string, unknown> } | { error: string } => {
  let message: unknown
  try { message = JSON.parse(line) } catch (thrown) {
    return { error: `a line that is not JSON-RPC: ${String(thrown)}` }
  }
  if (message === null || typeof message !== "object" || Array.isArray(message)
    || (message as Record<string, unknown>)["jsonrpc"] !== "2.0") {
    return { error: "a line that is not JSON-RPC" }
  }
  return { message: message as Record<string, unknown> }
}

export const step = (state: Exchange, message: Record<string, unknown>): Step => {
  const unchanged: Step = { state, send: [] }
  const failed = (cause: string): Step => ({ ...unchanged, answer: { _tag: "failed", cause } })
  // A JSON-RPC notification carries no id, so it answers neither question.
  if (message["id"] === undefined) return unchanged
  if (message["error"] !== undefined) return failed(JSON.stringify(message["error"]))
  if (message["id"] === 1) {
    const result = message["result"] as { protocolVersion?: unknown } | null | undefined
    if (state.initialized || typeof result?.protocolVersion !== "string") return failed("invalid initialize response")
    return {
      state: { ...state, initialized: true },
      send: [
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ],
    }
  }
  if (message["id"] !== 2) return unchanged
  const result = message["result"] as { tools?: Array<Record<string, unknown>>; nextCursor?: string } | undefined
  if (!state.initialized || !Array.isArray(result?.tools) || result.tools.some(tool => tool === null || typeof tool !== "object" || typeof tool["name"] !== "string"
    || tool["inputSchema"] === null || typeof tool["inputSchema"] !== "object" || Array.isArray(tool["inputSchema"]))) {
    return failed("invalid tools/list response")
  }
  const tools = [...state.tools, ...result.tools.map(tool => {
    const schema = tool["inputSchema"] as { properties?: Record<string, unknown> }
    return { name: String(tool["name"]), inputs: Object.keys(schema.properties ?? {}) }
  })]
  const next = { ...state, tools }
  // MCP paginates `tools/list`: a tool can appear on any page, and
  // `nextCursor` is the peer's opaque continuation.
  const cursor = result.nextCursor
  return typeof cursor === "string" && cursor !== ""
    ? { state: next, send: [{ jsonrpc: "2.0", id: 2, method: "tools/list", params: { cursor } }] }
    : { state: next, send: [], answer: { _tag: "answered", tools } }
}
