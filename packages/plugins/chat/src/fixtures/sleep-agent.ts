#!/usr/bin/env bun

import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { listen, respond, unknownMethod, update, write } from "./jsonrpc.testlib.ts"

let cwd = process.cwd()
const here = (name: string): string => join(cwd, name)
const has = (name: string): boolean => existsSync(here(name))
const touch = (name: string): void => {
  try {
    writeFileSync(here(name), "")
  } catch {
  }
}

let minted = 0
let asked = 0
const running = new Set<unknown>()

process.stderr.write("sleep-agent: started\n")

listen<{
  readonly id?: unknown
  readonly method?: string
  readonly result?: unknown
  readonly params?: {
    readonly cwd?: string
    readonly sessionId?: string
    readonly prompt?: ReadonlyArray<{ readonly text?: string }>
  }
}>(message => {
  switch (message.method) {
    case "initialize":
      respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
      return
    case "session/new":
    case "session/load":
      if (typeof message.params?.cwd === "string") cwd = message.params.cwd
      respond(message.id, { sessionId: message.params?.sessionId ?? `sess-${++minted}` })
      return
    case "session/cancel": {
      for (const id of running) {
        running.delete(id)
        respond(id, { stopReason: "cancelled" })
      }
      touch(".sleep-cancelled")
      return
    }
    case "session/prompt": {
      touch(".sleep-asked")
      const id = message.id
      running.add(id)
      if (has(".sleep-vanish")) {
        process.exit(0)
      }
      if (has(".sleep-ask")) {
        write({
          jsonrpc: "2.0",
          id: `ask-${++asked}`,
          method: "elicitation/create",
          params: {
            mode: "form",
            sessionId: message.params?.sessionId,
            toolCallId: `call-${asked}`,
            message: "Which rows should I archive?",
            requestedSchema: {
              type: "object",
              properties: {
                question_0: {
                  type: "string",
                  title: "Archive",
                  oneOf: [
                    { const: "all", title: "all" },
                    { const: "none", title: "none" },
                  ],
                },
              },
            },
          },
        })
        return
      }
      if (has(".sleep-hold")) return
      const call = `call-${++asked}`
      update(message.params?.sessionId, {
        sessionUpdate: "tool_call",
        toolCallId: call,
        title: "Archive the September rows",
        kind: "edit",
        status: "in_progress",
        locations: [{ path: join(cwd, "Work.olai"), line: 2 }],
        rawInput: {},
      })
      update(message.params?.sessionId, {
        sessionUpdate: "tool_call_update",
        toolCallId: call,
        status: "completed",
        rawOutput: { moved: 3 },
      })
      running.delete(id)
      respond(id, { stopReason: "end_turn" })
      return
    }
    default:
      unknownMethod(message)
  }
})
