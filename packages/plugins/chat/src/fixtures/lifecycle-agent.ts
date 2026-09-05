#!/usr/bin/env bun
/**
 * A tiny ACP agent for the chat lifecycle log tests: initialize, session/new,
 * session/prompt. Stderr is the load-bearing half — a distinctive line at
 * start, and another when a turn is refused, which is what production
 * opencode dumps its JSON-RPC errors as.
 *
 * Prompt text:
 *   fail       — JSON-RPC error, after writing to stderr
 *   pad        — 33KB of stderr then end_turn (the cap is 32KB)
 *   crash      — exit 7 after the session is open
 *   queue-wait — end_turn after 250ms, so a second prompt can queue
 *   anything else — end_turn immediately
 */

const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

const refuse = (id: unknown, message: string): void => {
  write({ jsonrpc: "2.0", id, error: { code: -32603, message } })
}

process.stderr.write("lifecycle-agent: started\n")

let pending = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  pending += chunk
  const lines = pending.split("\n")
  pending = lines.pop() ?? ""
  for (const line of lines) {
    if (line.trim() === "") continue
    const message = JSON.parse(line) as {
      readonly id?: unknown
      readonly method?: string
      readonly params?: { readonly prompt?: ReadonlyArray<{ readonly text?: string }> }
    }
    switch (message.method) {
      case "initialize":
        respond(message.id, {
          protocolVersion: 1,
          agentCapabilities: { loadSession: true },
        })
        continue
      case "session/new":
        respond(message.id, { sessionId: "sess-1" })
        continue
      case "session/load":
        respond(message.id, {})
        continue
      case "session/prompt": {
        const text = message.params?.prompt?.[0]?.text ?? ""
        if (text === "fail") {
          process.stderr.write("lifecycle-agent: json-rpc boom\n")
          refuse(message.id, "the model said no")
          continue
        }
        if (text === "pad") {
          process.stderr.write(`${"x".repeat(33 * 1024)}\n`)
          respond(message.id, { stopReason: "end_turn" })
          continue
        }
        if (text === "crash") {
          process.exit(7)
        }
        if (text === "queue-wait") {
          setTimeout(() => respond(message.id, { stopReason: "end_turn" }), 250)
          continue
        }
        respond(message.id, { stopReason: "end_turn" })
        continue
      }
    }
  }
})
