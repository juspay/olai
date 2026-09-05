/** Per-node session credentials. The ticket registry owns the narrowed door,
 * so releasing a node scope drops its whole MCP footprint at once. */
import { Schema } from "effect"
import { Writer } from "@olai/format"
import type { FaceExposure } from "@kolu/surface/expose"
import type { Fence, Ops } from "@olai/ops"
import { randomBytes } from "node:crypto"

import { APPROVED_KEY } from "../dynamic/source.ts"
import { type Bound, writerAt } from "../runtime.ts"
import { clientOver, type OlaiSurfaceClient } from "./face.ts"
import { currentTicket } from "./route.ts"

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
 * custom key that is not spelled like a field. A session's fence is a SUBTREE
 * fence, and the plugin an agent defines is inside that agent's subtree by
 * construction. So:
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
 * 12's words; and the fence itself is minted right here, per session, by the
 * composition root. So the ticket's forbidden table is the union of what the
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
 * writer with no fence at all, which is the same shape a keystroke has.
 */
const ALWAYS_FORBIDDEN: ReadonlyArray<Seated["forbidden"][number]> = [{
  key: APPROVED_KEY,
  says: "it is a person's approval of code that runs with this server's authority, "
    + "and the plugins panel — with the source in front of them — is where that is decided",
}]

export interface Seated {
  readonly under: string
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
  readonly mint: (fence: () => Seated, above: (node: string) => string | null, writer: string) => Ticket
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

  const composed = (fence: Fence, writer: Writer): OlaiSurfaceClient => clientOver({
    group: options.bound.group,
    handlers: writerAt(options.bound, options.ops, { writer, fence }),
  }, options.face)

  const closed = composed({ under: null, ask: () => null, forbidden: new Map() }, "mcp")

  return {
    mint: (seated, above, writer) => {
      const bearer = `${prefix}${randomBytes(24).toString("hex")}`
      const fence: Fence = {
        get under() {
          return seated().under
        },
        ask: () => above(seated().under),
        get forbidden() {
          return new Map<string, string>(
            [...seated().forbidden, ...ALWAYS_FORBIDDEN].map((one) => [one.key, one.says]),
          )
        },
      }
      tickets.set(bearer, composed(fence, Schema.decodeUnknownSync(Writer)(writer)))
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
