/** Per-node session credentials. The ticket registry owns the narrowed door,
 * so releasing a node scope drops its whole MCP footprint at once. */
import type { FaceExposure } from "@kolu/surface/expose"
import type { Fence, Ops } from "@olai/ops"
import { randomBytes } from "node:crypto"

import { type Bound, writerAt } from "../runtime.ts"
import { clientOver, type OlaiSurfaceClient } from "./face.ts"
import { currentTicket } from "./route.ts"

export interface Seated {
  readonly under: string
  readonly forbidden: ReadonlyArray<string>
}

export interface Ticket {
  readonly bearer: string
  readonly release: () => void
}

export interface Tickets {
  readonly mint: (fence: () => Seated, above: (node: string) => string | null) => Ticket
  readonly doorAt: (held: OlaiSurfaceClient) => OlaiSurfaceClient
}

export const ticketing = (options: {
  readonly bound: Pick<Bound, "group" | "handlers">
  readonly face: FaceExposure
  readonly ops: Ops
  readonly token: string
}): Tickets => {
  const prefix = "olai-node-"
  const tickets = new Map<string, OlaiSurfaceClient>()

  const composed = (fence: Fence): OlaiSurfaceClient => clientOver({
    group: options.bound.group,
    handlers: writerAt(options.bound, options.ops, { writer: "chat-agent", fence }),
  }, options.face)

  const closed = composed({ under: null, ask: () => null, forbidden: new Set() })

  return {
    mint: (seated, above) => {
      const bearer = `${prefix}${randomBytes(24).toString("hex")}`
      const fence: Fence = {
        get under() {
          return seated().under
        },
        ask: () => above(seated().under),
        get forbidden() {
          return new Set(seated().forbidden)
        },
      }
      tickets.set(bearer, composed(fence))
      let released = false
      return {
        bearer,
        release: () => {
          if (released) return
          released = true
          tickets.delete(bearer)
        },
      }
    },
    doorAt: (held) => {
      const bearer = currentTicket()
      if (bearer === null || bearer === options.token) return held
      const door = tickets.get(bearer)
      // Preserve the route's existing loopback affordance for arbitrary tokens.
      if (door !== undefined) return door
      // A released (or forged) node-shaped credential stays closed without a
      // tombstone per historical token. Other arbitrary loopback tokens keep
      // the route's longstanding unfenced behaviour.
      return bearer.startsWith(prefix) ? closed : held
    },
  }
}
