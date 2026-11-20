import { Schema } from "effect"
import { Writer } from "@olai/format"
import type { FaceExposure } from "@kolu/surface/expose"
import type { Confinement, SessionRule, Ops } from "@olai/ops"
import { randomBytes } from "node:crypto"

import { type Bound } from "./authority.ts"
import type { RootedSurfaceClients } from "@kolu/surface/client"
import { clientsFor, type Row } from "./bundle.ts"
import type { Reading } from "./live-client.ts"

export interface Ticket {
  readonly bearer: string
  readonly release: () => void
}

export interface Tickets {
  readonly mint: (
    forbidden: () => ReadonlyArray<{ readonly key: string; readonly says: string }>,
    writer: string,
    confined?: () => Confinement | null,
  ) => Ticket
  readonly doorAt: (held: RootedSurfaceClients) => RootedSurfaceClients
}

export const ticketing = (options: {
  readonly reservations: ReadonlyArray<{ readonly key: string; readonly says: string; readonly file?: string }>
  readonly bound: Pick<Bound, "group" | "handlers" | "writes"> | (() => Pick<Bound, "group" | "handlers" | "writes">)
  readonly face: FaceExposure | (() => FaceExposure)
  readonly ops: Ops
  readonly currentTicket: () => string | null
  readonly token: string
  /** Read afresh per mint — a ticket outlives a recompose. */
  readonly rows: () => ReadonlyArray<Row>
}): Tickets => {
  const prefix = "olai-node-"
  const tickets = new Map<string, RootedSurfaceClients>()

  const reading: Reading = () => ({
    ...(typeof options.bound === "function" ? options.bound() : options.bound),
    expose: typeof options.face === "function" ? options.face() : options.face,
  })
  const composed = (rule: SessionRule, writer: Writer): RootedSurfaceClients =>
    clientsFor(options.rows(), reading, { writer, rule })

  // Cache per composed generation, not per request or forever.
  let reservedGroup: ReturnType<Reading>["group"] | undefined
  let reservedClients: RootedSurfaceClients | undefined
  const reserved = (): RootedSurfaceClients => {
    const group = reading().group
    if (reservedClients === undefined || reservedGroup !== group) {
      reservedClients = composed({ _tag: "open", forbidden: new Map(options.reservations.map((one) => [one.key, one.file === undefined ? one.says : { says: one.says, file: one.file }] as const)) }, "mcp")
      reservedGroup = group
    }
    return reservedClients
  }
  const closed = composed({ _tag: "closed" }, "mcp")

  return {
    mint: (forbidden, writer, confined) => {
      const bearer = `${prefix}${randomBytes(24).toString("hex")}`
      let released = false
      const rule = {
        get _tag(): SessionRule["_tag"] {
          return released ? "closed" : "open"
        },
        // READ PER CALL, like the table above it: the fence is up exactly while
        // the caller's own work is, and the ticket outlives that.
        get confined(): Confinement | null {
          return released || confined === undefined ? null : confined()
        },
        get forbidden() {
          return new Map(
            [...forbidden(), ...options.reservations].map((one) => [one.key, "file" in one && one.file !== undefined ? { says: one.says, file: one.file } : one.says] as const),
          )
        },
      } as SessionRule
      tickets.set(bearer, composed(rule, Schema.decodeUnknownSync(Writer)(writer)))
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
      const bearer = options.currentTicket()
      if (bearer === null || bearer === options.token) return options.reservations.length > 0 ? reserved() : held
      const at = tickets.get(bearer)
      if (at !== undefined) return at
      return bearer.startsWith(prefix) ? closed : options.reservations.length > 0 ? reserved() : held
    },
  }
}
