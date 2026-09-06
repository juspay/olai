/** Per-node session credentials. The ticket registry owns the narrowed door,
 * so releasing a node scope drops its whole MCP footprint at once. */
import { Schema } from "effect"
import { Writer } from "@olai/format"
import type { FaceExposure } from "@kolu/surface/expose"
import type { Door, Ops } from "@olai/ops"
import { randomBytes } from "node:crypto"

import { type Bound } from "./authority.ts"
import { type McpClient } from "./client.ts"
import { liveClient } from "./live-client.ts"

/**
 * THE WORDS NO SESSION MAY WRITE, whatever it is seated on.
 *
 * ## The hole this closes
 *
 * Phase 12 draws its boundary on a surface member: `plugins.approve` is on the
 * BROWSER face and no other, and `faces.test.ts` pins that as an exact set. But
 * the STATE that member guards is an ordinary custom property on an ordinary
 * node — `approved`, recorded in the vault so it travels with it and is in the
 * ledger like the source (the ruling, 2026-09-05) — and `set_prop` writes any
 * custom key that is not spelled like a field. A node agent's door writes the
 * vault, and the plugin an agent defines is a node the agent can otherwise
 * edit. So:
 *
 *     set_prop {"id": "<its own plugin node>", "key": "approved", "value": "always"}
 *
 * is a legal write through a door the agent already holds, the revision
 * publishes, `isApproved` reads true, and the plugin mounts with the process's
 * authority having been read by nobody. The verb was closed and the fact was
 * not: the boundary was drawn on one member of a face and reached around
 * through another.
 *
 * ## Why it is closed HERE
 *
 * Because this is the one place that holds both halves. `@olai/ops` may not
 * know what a plugin is; `olai-plugin-chat` supplies the keys a SESSION is
 * seated on, with its own sentence for them, and has no business knowing phase
 * 12's words; and the door itself is minted right here, per session, by the
 * MCP activation. So the ticket's forbidden table is the union of what the
 * seat contributed and what this build's own vocabulary reserves — each half
 * carrying the clause its own author wrote.
 *
 * IT IS EVERY NODE AND NOT ONLY A PLUGIN'S, deliberately. An agent that could
 * write `approved` onto a node that is not yet a plugin could write the two
 * halves afterwards and be approved from the first revision it was one — so a
 * rule that asked "is this node a plugin right now" would be a rule about the
 * order of two writes. The word is core's under phase 12 ([docs/dynamic-plugins.md]),
 * and a word core claims is one a session's door does not write.
 *
 * A PERSON'S face is untouched: `plugins.approve` runs under this runtime's own
 * writer with no door rule at all, which is the same shape a keystroke has.
 */

export interface Seated {
  /** Each key this session may not write, with the clause that says why — see
   *  `@olai/plugin-api`'s `Seated` on why the sentence travels from whoever
   *  forbade the key rather than being composed where it is spent. */
  readonly forbidden: ReadonlyArray<{ readonly key: string; readonly says: string }>
}

export interface Ticket {
  readonly bearer: string
  readonly release: () => void
}

export interface Tickets {
  readonly mint: (seated: () => Seated, writer: string) => Ticket
  readonly doorAt: (held: McpClient) => McpClient
}

export const ticketing = (options: {
  readonly reservations: ReadonlyArray<{ readonly key: string; readonly says: string }>
  readonly bound: Pick<Bound, "group" | "handlers" | "writes"> | (() => Pick<Bound, "group" | "handlers" | "writes">)
  readonly face: FaceExposure | (() => FaceExposure)
  readonly ops: Ops
  readonly currentTicket: () => string | null
  readonly token: string
}): Tickets => {
  const prefix = "olai-node-"
  const tickets = new Map<string, McpClient>()

  const composed = (door: Door, writer: Writer): McpClient => liveClient(() => ({
    ...(typeof options.bound === "function" ? options.bound() : options.bound),
    expose: typeof options.face === "function" ? options.face() : options.face,
  }), { writer, door })

  const closed = composed({ closed: true, forbidden: new Map() }, "mcp")

  return {
    mint: (seated, writer) => {
      const bearer = `${prefix}${randomBytes(24).toString("hex")}`
      let released = false
      const door: Door = {
        get closed() {
          return released
        },
        get forbidden() {
          return new Map<string, string>(
            [...(released ? [] : seated().forbidden), ...options.reservations].map((one) => [one.key, one.says]),
          )
        },
      }
      tickets.set(bearer, composed(door, Schema.decodeUnknownSync(Writer)(writer)))
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
