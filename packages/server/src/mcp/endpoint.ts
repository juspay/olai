/**
 * The MCP endpoint's two lifetimes: an address for the serve, and a protocol
 * server for each activation of the mcp row.
 *
 * The listener and the sessions must agree on a credential and transport even
 * though the listener binds after the rows mount. This factory opens no server:
 * it makes the stable rendezvous the root can hand both sides. `serve` is the
 * acquisition, run on the row's scope, and every activation makes fresh tickets
 * and a fresh MCP server. Turning the row off closes pending protocol requests
 * and removes the ticket mint; the shared HTTP listener remains somebody else's
 * resource. Keeping this here lets the protocol/tool projection change without
 * changing profile selection or the root's acquisition order.
 */
import type { FaceExposure } from "@kolu/surface/expose"
import type { Writer } from "@olai/format"
import { type Ops, TOOLS } from "@olai/ops"
import type { ToolServer } from "@olai/plugin-api/services"
import type { Vintage } from "@olai/store"
import { Effect } from "effect"

import type { Reading } from "../who.ts"
import { type Bound, writerAt } from "../runtime.ts"
import { clientOver, serveFace } from "./face.ts"
import { currentLogin, MCP_PATH, mcpTransport } from "./route.ts"
import { type Tickets, ticketing } from "./tickets.ts"
import { bespokeFrom, pluginTools } from "./tools.ts"

export const mcpEndpoint = (token: string) => {
  const transport = mcpTransport()
  let tickets: Tickets | undefined
  return {
    /** A missing row cannot mint a credential onto a face that does not exist.
     * Read per call, so sessions holding this door observe unload and reload. */
    ticketFor: (...args: Parameters<Tickets["mint"]>) => tickets?.mint(...args) ?? null,
    route: (who: Reading) => ({ transport, token, who }),
    /** The name is part of engine auto-allow prefixes. The root supplies the
     * bound URL; no protocol code guesses which port the OS assigned. */
    address: (url: string): ToolServer => ({ name: "olai", url: `${url}${MCP_PATH}`, token }),
    serve: (options: {
      readonly bound: Pick<Bound, "group" | "handlers">
      readonly face: FaceExposure
      readonly ops: Ops
      readonly root: string
      readonly writer: Writer
      /** The root chooses the store's observation class; MCP only projects it. */
      readonly vintage: Effect.Effect<Vintage>
    }) => Effect.gen(function*() {
      const { bound, face, ops, root, writer, vintage } = options
      // This client has no connection to close. Make it once per activation,
      // over the composed face that exists then, rather than redial per tool.
      const panel = clientOver({
        group: bound.group,
        handlers: writerAt(bound, ops, { writer, fence: null }),
      }, face)
      const seated = ticketing({ bound, face, ops, token })
      tickets = seated
      yield* Effect.addFinalizer(() => Effect.sync(() => { tickets = undefined }))
      yield* serveFace({
        client: () => panel,
        tools: {
          ...bespokeFrom(TOOLS, {
            login: currentLogin,
            root,
            vintage,
            fenced: seated.doorAt,
            record: (request) => ops.commit(request, writer),
            push: ops.push,
          }),
          // These are core plugin-management verbs, not operations on files;
          // keeping the two tables joined here keeps them on every MCP start.
          ...pluginTools(),
        },
        transport,
      })
    }),
  }
}
