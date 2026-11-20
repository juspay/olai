#!/usr/bin/env bun

import { listen, respond, unknownMethod, update } from "./jsonrpc.testlib.ts"

let sessions = 0
let session = ""

listen<{
  readonly id?: unknown
  readonly method?: string
  readonly params?: { readonly sessionId?: string; readonly prompt?: ReadonlyArray<{ readonly text?: string }> }
}>(message => {
  switch (message.method) {
    case "initialize":
      respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
      return
    case "session/new":
      sessions += 1
      session = `sess-${sessions}`
      respond(message.id, { sessionId: session })
      return
    case "session/load":
      session = message.params?.sessionId ?? session
      respond(message.id, { sessionId: session })
      return
    case "session/prompt": {
      const text = message.params?.prompt?.[0]?.text ?? ""
      update(session, {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: `heard: ${text}` },
      })
      respond(message.id, { stopReason: "end_turn" })
      return
    }
    default:
      unknownMethod(message)
  }
})
