#!/usr/bin/env bun
/**
 * A tiny ACP agent for the node-agent send-path tests: initialize,
 * session/new, session/prompt — and ONE thing the other fixtures do not do,
 * which is why it exists.
 *
 * **It says back what it was prompted with.** The keystone's whole claim is
 * that a standing instruction rides UNDER the first message a person sends
 * (`../teaching.ts`), and there is no other way to see from outside whether it
 * did: the panel's own notice row is built from the same value, so asserting
 * that alone would be one half of the pair vouching for the other. This one
 * hands the prompt back as the agent's prose, so a test reads what the agent
 * was actually given.
 *
 * **And it mints a NEW session id per `session/new`** — `sess-1`, `sess-2`, …
 * — because "taught once per SESSION, and a fresh one is untaught" is a claim
 * about two of them, and a fixture that answered with one id could not tell
 * the rule from "taught once per node".
 */

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
      // The prompt, back as prose — one chunk, which is what a settled
      // paragraph is on this wire.
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
