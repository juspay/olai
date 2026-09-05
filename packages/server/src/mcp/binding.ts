/** Core's writer-bound agent client and ticket policy. The protocol plugin
 * supplies its request-local credential reader and owns the carrier and tools.
 * Each activation gets a fresh ticket table; existing sessions read the current
 * table through ticketFor, so unloading withdraws their ability to mint. */
import type { FaceExposure } from "@kolu/surface/expose"
import type { Writer } from "@olai/format"
import { type Ops } from "@olai/ops"
import type { ToolServer } from "@olai/plugin-api/services"
import type { Vintage } from "@olai/store"
import { Effect } from "effect"

import { MCP } from "../faces.ts"
import { type Bound, writerAt } from "../runtime.ts"
import { clientOver } from "@olai/surface/client"
import type { AgentBinding } from "@olai/plugin-api/transport"
import type { OlaiSurfaceClient } from "@olai/surface/client"
import { type Tickets, ticketing } from "./tickets.ts"


export const mcpBinding = (token: string) => {
  let tickets: Tickets | undefined
  return {
    /** A missing row cannot mint a credential onto a face that does not exist.
     * Read per call, so sessions holding this door observe unload and reload. */
    ticketFor: (...args: Parameters<Tickets["mint"]>) => tickets?.mint(...args) ?? null,
    /** The name is part of engine auto-allow prefixes. The root supplies the
     * bound URL; no protocol code guesses which port the OS assigned. */
    address: (url: string): ToolServer => ({ name: "olai", url: `${url}/mcp`, token }),
    prepare: (options: {
      readonly ticket: () => string | null
      readonly bound: Pick<Bound, "group" | "handlers">
      readonly face: FaceExposure
      readonly ops: Ops
      readonly root: string
      readonly writer: Writer
      /** The root chooses the store's observation class; MCP only projects it. */
      readonly vintage: Effect.Effect<Vintage | undefined>
    }): Effect.Effect<AgentBinding, never, import("effect").Scope.Scope> => Effect.gen(function*() {
      const { bound, face, ops, root, writer, vintage } = options
      // This client has no connection to close. Make it once per activation,
      // over the composed face that exists then, rather than redial per tool.
      const panel = clientOver({
        group: bound.group,
        handlers: writerAt(bound, ops, { writer, fence: null }),
      }, face)
      const seated = ticketing({ bound, face, ops, token, currentTicket: options.ticket })
      tickets = seated
      yield* Effect.addFinalizer(() => Effect.sync(() => { tickets = undefined }))
      return {
        expose: MCP,
        client: () => panel,
        root,
        vintage,
        fenced: (held) => seated.doorAt(held as OlaiSurfaceClient),
        record: (request) => ops.commit(request, writer),
        push: ops.push,
      }
    }),
  }
}
