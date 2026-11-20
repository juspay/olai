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

  const perGeneration = (make: () => RootedSurfaceClients): (() => RootedSurfaceClients) => {
    let generation: Bound["group"] | undefined
    let made: RootedSurfaceClients | undefined
    return () => {
      const group = reading().group
      if (made === undefined || generation !== group) {
        made = make()
        generation = group
      }
      return made
    }
  }
  const reserved = perGeneration(() =>
    composed({ _tag: "open", forbidden: new Map(options.reservations.map((one) => [one.key, one.file === undefined ? one.says : { says: one.says, file: one.file }] as const)) }, "mcp"))
  const closed = composed({ _tag: "closed" }, "mcp")

  type Credential =
    | { readonly _tag: "minted"; readonly door: RootedSurfaceClients }
    | { readonly _tag: "withdrawn" }
    | { readonly _tag: "unticketed" }

  const credentialOf = (bearer: string | null): Credential => {
    if (bearer === null || bearer === options.token) return { _tag: "unticketed" }
    const door = tickets.get(bearer)
    if (door !== undefined) return { _tag: "minted", door }
    return bearer.startsWith(prefix) ? { _tag: "withdrawn" } : { _tag: "unticketed" }
  }

  return {
    mint: (forbidden, writer, confined) => {
      const bearer = `${prefix}${randomBytes(24).toString("hex")}`
      let released = false
      const rule = {
        get _tag(): SessionRule["_tag"] {
          return released ? "closed" : "open"
        },

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
      const credential = credentialOf(options.currentTicket())
      if (credential._tag === "minted") return credential.door
      if (credential._tag === "withdrawn") return closed
      return options.reservations.length > 0 ? reserved() : held
    },
  }
}
