#!/usr/bin/env bun

import { listen, respond, unknownMethod, update } from "./jsonrpc.testlib.ts"

const tick = () => new Promise((done) => setTimeout(done, 5))

const replay = async (id: unknown, sessionId: string): Promise<void> => {
  update(sessionId, { sessionUpdate: "user_message_chunk", content: { type: "text", text: "what did we decide?" } })
  await tick()
  update(sessionId, {
    sessionUpdate: "tool_call_update",
    toolCallId: "replayed-1",
    title: "read the notes",
    status: "completed",
  })
  for (const text of ["we decided ", "to order ", "the cabinets."]) {
    await tick()
    update(sessionId, { sessionUpdate: "agent_message_chunk", content: { type: "text", text } })
  }
  await tick()
  respond(id, {})
}

listen<{
  readonly id?: unknown
  readonly method?: string
  readonly params?: { readonly sessionId?: string }
}>(message => {
  switch (message.method) {
    case "initialize":
      respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
      return
    case "session/new":
      respond(message.id, { sessionId: "fresh" })
      return
    case "session/load":
      void replay(message.id, message.params?.sessionId ?? "stored")
      return
    case "session/prompt":
      respond(message.id, { stopReason: "end_turn" })
      return
    default:
      unknownMethod(message)
  }
})
