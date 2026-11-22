#!/usr/bin/env bun
/**
 * A tiny ACP agent that says what it was OPENED WITH — for the bring-up cases
 * in `../compacting.test.ts`.
 *
 *   argv[2]      the file it appends one JSON line to per session opened
 *   argv[3...]   the environment variables it reports seeing
 *
 * Each line is `{ method, meta, seen }`: whether this was a `session/new` or a
 * `session/load`, the `_meta` the open carried (`null` for none), and which of
 * the named variables its own environment holds. That is the whole of what a
 * leg and an adapter decide about a spawn, read from inside the spawn rather
 * than off the arguments somebody meant to pass it.
 */

import { appendFileSync } from "node:fs"

import { listen, respond, unknownMethod } from "./jsonrpc.testlib.ts"

const [report, ...watched] = process.argv.slice(2)
if (report === undefined) throw new Error("compaction-agent: name the report file")

let minted = 0

const opened = (method: string, meta: unknown): void => {
  appendFileSync(
    report,
    `${JSON.stringify({ method, meta: meta ?? null, seen: watched.filter((name) => process.env[name] !== undefined) })}\n`,
  )
}

listen<{
  readonly id?: unknown
  readonly method?: string
  readonly params?: { readonly sessionId?: string; readonly _meta?: unknown }
}>(message => {
  switch (message.method) {
    case "initialize":
      respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
      return
    case "session/new":
      opened("session/new", message.params?._meta)
      respond(message.id, { sessionId: `sess-${++minted}` })
      return
    case "session/load":
      opened("session/load", message.params?._meta)
      respond(message.id, { sessionId: message.params?.sessionId })
      return
    case "session/prompt":
      respond(message.id, { stopReason: "end_turn" })
      return
    default:
      unknownMethod(message)
  }
})
