#!/usr/bin/env bun
/**
 * An ACP agent whose `session/load` REPLAYS before it answers, the way a real
 * one does: what the person said, a finished tool call, and the agent's answer
 * in chunks — each on its own timer, so the history reaches the panel over
 * several ticks rather than in one read of stdin.
 *
 * `session/new` opens `fresh`; any prompt ends its turn at once, so a test can
 * put a row in the conversation it is about to leave.
 */

const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

const update = (sessionId: string, frame: unknown): void => {
  write({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: frame } })
}

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
      readonly params?: { readonly sessionId?: string }
    }
    switch (message.method) {
      case "initialize":
        respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
        continue
      case "session/new":
        respond(message.id, { sessionId: "fresh" })
        continue
      case "session/load":
        void replay(message.id, message.params?.sessionId ?? "stored")
        continue
      case "session/prompt":
        respond(message.id, { stopReason: "end_turn" })
        continue
    }
  }
})
