/** Pure newline framing and the initialize/tools-list exchange. The transport
 * owns pipes, deadlines and child lifetime; this module owns protocol evolution. */
/** The answer and all four failure modes travel one channel. Callers own
 * judgement and sentences, so transport failure never throws through a session
 * opening. Stderr is evidence, capped separately from the protocol stream. */
export type Evidence =
  | {
    /** Names and input property keys, for the caller to judge. */
    readonly _tag: "answered"
    readonly tools: ReadonlyArray<{ readonly name: string; readonly inputs: ReadonlyArray<string> }>
  }
  /** The OS would not start it — the spawn call raised. */
  | { readonly _tag: "couldNotStart"; readonly cause: string }
  /** It never reached either answer inside the deadline. */
  | { readonly _tag: "timedOut"; readonly deadlineMs: number }
  /** Its pipes went away with no answer on them. */
  | { readonly _tag: "closed" }
  /** Writing to it, or parsing what came back, failed. */
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

/** Bound the unfinished response before splitting, matching the transport's
 * existing 4 MiB limit even when a chunk contains several complete frames. */
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
  // Notifications carry no id and cannot finish either outstanding question.
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
  // A surface is judged only after its last page: a required tool can appear
  // on any page, and the cursor is the peer's opaque continuation.
  const cursor = result.nextCursor
  return typeof cursor === "string" && cursor !== ""
    ? { state: next, send: [{ jsonrpc: "2.0", id: 2, method: "tools/list", params: { cursor } }] }
    : { state: next, send: [], answer: { _tag: "answered", tools } }
}
