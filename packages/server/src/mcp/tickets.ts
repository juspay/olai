/** Per-node session credentials. Releasing one tombstones it, so reaping can
 * only close authority and can never turn a stale token into an unfenced one. */
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
  const tickets = new Map<string, (() => Fence) | null>()
  const doors = new Map<string, OlaiSurfaceClient>()

  const composed = (fence: Fence): OlaiSurfaceClient => clientOver({
    group: options.bound.group,
    handlers: writerAt(options.bound, options.ops, { writer: "chat-agent", fence }),
  }, options.face)

  const doorFor = (fence: Fence): OlaiSurfaceClient => {
    if (fence.under === null) return composed(fence)
    const held = doors.get(fence.under)
    if (held !== undefined) return held
    const made = composed(fence)
    doors.set(fence.under, made)
    return made
  }

  return {
    mint: (seated, above) => {
      const bearer = randomBytes(24).toString("hex")
      tickets.set(bearer, () => {
        const seat = seated()
        return {
          under: seat.under,
          ask: () => above(seat.under),
          forbidden: new Set(seat.forbidden),
        }
      })
      return {
        bearer,
        release: () => {
          if (tickets.has(bearer)) tickets.set(bearer, null)
        },
      }
    },
    doorAt: (held) => {
      const bearer = currentTicket()
      if (bearer === null || bearer === options.token) return held
      const fence = tickets.get(bearer)
      // Preserve the route's existing loopback affordance for arbitrary tokens.
      if (fence === undefined) return held
      if (fence === null) {
        return doorFor({ under: null, ask: () => null, forbidden: new Set() })
      }
      return doorFor(fence())
    },
  }
}
