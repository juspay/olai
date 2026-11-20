#!/usr/bin/env bun

import { listen, respond, unknownMethod, write } from "./jsonrpc.testlib.ts"

let minted = 0
const running = new Map<unknown, ReturnType<typeof setTimeout> | null>()

process.stderr.write("doorbell-agent: started\n")

listen<{
  readonly id?: unknown
  readonly method?: string
  readonly params?: {
    readonly sessionId?: string
    readonly prompt?: ReadonlyArray<{ readonly text?: string }>
  }
}>(message => {
  switch (message.method) {
    case "initialize":
      respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
      return
    case "session/new":
      respond(message.id, { sessionId: `sess-${++minted}` })
      return
    case "session/load":
      if (process.argv.includes("--hold-load")) {
        setTimeout(() => respond(message.id, { sessionId: message.params?.sessionId }), 600_000)
        return
      }
      if (process.argv.includes("--refuse-load")) {
        write({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32603, message: "no such conversation: refused on purpose" },
        })
        return
      }
      respond(message.id, { sessionId: message.params?.sessionId })
      return
    case "session/cancel": {
      for (const [id, timer] of running) {
        if (timer !== null) clearTimeout(timer)
        respond(id, { stopReason: "cancelled" })
      }
      running.clear()
      return
    }
    case "session/prompt": {
      const text = message.params?.prompt?.[0]?.text ?? ""
      const held = /^wait:(\d+)$/.exec(text)
      if (held !== null) {
        const id = message.id
        running.set(
          id,
          setTimeout(() => {
            running.delete(id)
            respond(id, { stopReason: "end_turn" })
          }, Number(held[1])),
        )
        return
      }
      respond(message.id, { stopReason: "end_turn" })
      return
    }
    default:
      unknownMethod(message)
  }
})
