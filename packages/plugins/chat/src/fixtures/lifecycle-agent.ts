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

import { listen, respond, unknownMethod, update, write } from "./jsonrpc.testlib.ts"

const refuse = (id: unknown, message: string): void => {
  write({ jsonrpc: "2.0", id, error: { code: -32603, message } })
}

process.stderr.write("lifecycle-agent: started\n")

listen<{
  readonly id?: unknown
  readonly method?: string
  readonly params?: { readonly prompt?: ReadonlyArray<{ readonly text?: string }> }
}>(message => {
  switch (message.method) {
    case "initialize":
      respond(message.id, {
        protocolVersion: 1,
        agentCapabilities: { loadSession: true },
      })
      return
    case "session/new":
      respond(message.id, { sessionId: "sess-1" })
      return
    case "session/load":
      respond(message.id, {})
      return
    case "session/prompt": {
      const text = message.params?.prompt?.[0]?.text ?? ""
      if (text === "mcp-report") {
        const frame = { sessionUpdate: "tool_call", toolCallId: "mcp_startup.optional",
          title: "mcp__optional__startup", kind: "other", status: "failed",
          content: [{ type: "content", content: { type: "text", text: "connection refused" } }] }
        for (const sessionId of ["other-session", "sess-1", "sess-1"]) update(sessionId, frame)
        respond(message.id, { stopReason: "end_turn" })
        return
      }
      if (text === "display-tool") {
        update("sess-1", { sessionUpdate: "tool_call", toolCallId: "display-1", title: "engine_tool", rawInput: { id: "one" }, status: "in_progress" })
        update("sess-1", { sessionUpdate: "tool_call_update", toolCallId: "display-1", rawOutput: { file: "one.olai", title: "one" }, status: "completed" })
        respond(message.id, { stopReason: "end_turn" })
        return
      }
      if (text === "fail") {
        process.stderr.write("lifecycle-agent: json-rpc boom\n")
        refuse(message.id, "the model said no")
        return
      }
      if (text === "pad") {
        process.stderr.write(`${"x".repeat(33 * 1024)}\n`)
        respond(message.id, { stopReason: "end_turn" })
        return
      }
      if (text === "crash") {
        process.exit(7)
      }
      if (text === "queue-wait") {
        setTimeout(() => respond(message.id, { stopReason: "end_turn" }), 250)
        return
      }
      respond(message.id, { stopReason: "end_turn" })
      return
    }
    default:
      unknownMethod(message)
  }
})
