#!/usr/bin/env bun
import { appendFileSync, existsSync } from "node:fs"
import { createInterface } from "node:readline"
let next = 0
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n")
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line)
  appendFileSync("requests.log", line + "\n")
  const reply = (result: unknown) => send({ jsonrpc: "2.0", id: request.id, result })
  const refuse = () => send({ jsonrpc: "2.0", id: request.id, error: { code: -32602, message: "fixture refused " + request.method } })
  const update = (text: string) => send({ jsonrpc: "2.0", method: "session/update", params: {
    sessionId: request.params.sessionId,
    update: { sessionUpdate: "agent_message_chunk", messageId: "answer-1", content: { type: "text", text } },
  } })
  switch (request.method) {
    case "initialize": reply({ protocolVersion: 1, agentCapabilities: { loadSession: true,
      sessionCapabilities: { list: {}, ...(process.argv.includes("--no-fork") ? {} : { fork: {} }) } } }); break
    case "session/list": reply({ sessions: [] }); break
    case "session/new":
    case "session/fork":
      if (existsSync("refuse-open")) refuse()
      else reply({ sessionId: `session-${++next}` })
      break
    case "session/load":
      for (const [sessionId, entry] of [
        [request.params.sessionId, { sessionUpdate: "subagent_spawned", subagentSessionId: "child-session", name: "Explorer", task: "inspect history" }],
        ["child-session", { sessionUpdate: "tool_call", toolCallId: "child-tool", title: "read history", status: "completed" }],
        [request.params.sessionId, { sessionUpdate: "subagent_state_update", subagentSessionId: "child-session", state: "completed" }],
      ]) send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: entry } })
      update("preceding answer")
      if (existsSync("refuse-load")) refuse()
      else reply({})
      break
    case "session/set_mode":
      if (existsSync("refuse-mode")) refuse()
      else reply({})
      break
    case "session/prompt": update("answer"); reply({ stopReason: "end_turn" }); break
  }
}
