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

const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

const notify = (method: string, params: unknown): void => {
  write({ jsonrpc: "2.0", method, params })
}

let sessions = 0
let session = ""

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
        respond(message.id, { protocolVersion: 1, agentCapabilities: {} })
        continue
      case "session/new":
        sessions += 1
        session = `sess-${sessions}`
        respond(message.id, { sessionId: session })
        continue
      case "session/prompt": {
        const text = message.params?.prompt?.[0]?.text ?? ""
        // The prompt, back as prose — one chunk, which is what a settled
        // paragraph is on this wire.
        notify("session/update", {
          sessionId: session,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: `heard: ${text}` },
          },
        })
        respond(message.id, { stopReason: "end_turn" })
        continue
      }
    }
  }
})

/** A MODULE rather than a script, which is what keeps its names its own: two
 *  fixtures in one folder both spelling `write` are two globals colliding
 *  otherwise (`./stale-session-agent.ts` and `./doorbell-agent.ts` say the same
 *  line). */
export {}
