/**
 * @olai/surface — the typed reactive layer, declared once for both ends.
 *
 * The server implements this and the browser subscribes to it; neither writes
 * a line of wire code. That is the rule carried over from the htmx era: no raw
 * sockets, no hand-rolled routes, no message envelopes — the only protocol is
 * this spec, and both sides are type errors away from disagreeing about it.
 *
 * Two members, which is the whole of "see your outline" and, once the store
 * went live, of "watch it stay right" as well:
 *
 *   - `outlines` is a STREAM, not a cell: the files belong to the disk, not to
 *     the server, so the server reports what it read rather than owning a
 *     value it could be asked to change. Every subscription opens with a full
 *     snapshot, so a reconnect is a fresh read and nothing has to be resumed,
 *     and a probe that found a change publishes the next frame down the same
 *     subscription.
 *   - `errors` is a CELL, read-only on the wire, because "what is wrong right
 *     now" is one value the server does own. It is deliberately independent of
 *     the snapshot: a set that stops validating leaves the last good tree on
 *     screen underneath a banner, which is only expressible if the two arrive
 *     separately.
 *   - `identity.info` is a PROCEDURE, and it is about the server rather than
 *     about any outline: it answers "which process am I talking to", which is
 *     what tells a transient drop from a restart. See its own note below.
 *
 * Ops arrive as procedures and chat as events when the agent does (they are one
 * roadmap item: chat's agent is the first writer). Both slot
 * into this same spec.
 */

import { OutlineError, OutlineSet } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

/**
 * One frame of the outline stream: the loaded set, or `null` for a set that
 * has never loaded.
 *
 * `null` is a state, not an absence. Three things a reader must tell apart —
 * "the server has not answered yet" (no frame), "the server has never had a
 * valid set to show" (`null`), "here is your outline" (a snapshot) — and a
 * nullable frame says all three with no second encoding.
 *
 * Note the two ways a frame and the error cell divide the labour, which is not
 * a duplication: `set.broken` says WHICH outline is unreadable, because that is
 * a property of the set the sidebar and the pane are drawn from, and the cell
 * says what is wrong with the set AS A WHOLE right now, which no single file
 * owns. A file listed in `broken` is being rendered around; anything in the
 * cell is being held back.
 */
export const OutlineFrame = Schema.NullOr(
  Schema.Struct({
    /** The store revision this snapshot is. Phase 4's writes name it as the
     *  base they edited; today it is what proves two frames differ. */
    rev: Schema.Int,
    set: OutlineSet,
  }),
)
export type OutlineFrame = typeof OutlineFrame.Type

/** Nothing selects a subset yet — the browser takes the whole served
 *  directory, and the sidebar is a view over it rather than a query. An empty
 *  input keeps the member's shape ready for one. */
const NoInput = Schema.Struct({})

/**
 * Who is on the other end — one id per server process.
 *
 * It exists because a websocket that closes and opens again says nothing about
 * WHY: a laptop lid, a Wi-Fi roam and a server that was restarted under the tab
 * all look identical from the socket. Comparing this id across reconnects is
 * what separates them, and the difference is not cosmetic — a page that came
 * from a process that no longer exists is holding a bundle nobody is serving
 * any more, so its recovery is a reload and not a retry.
 *
 * The client also echoes the last id it saw back as the `pid` query parameter
 * on every re-dial, which is the other half of the same fact: the server that
 * receives an id it does not recognise knows the tab predates it and closes it
 * rather than serving it (`@kolu/surface-app`'s stale-tab handshake, which
 * packages/server has implemented since the scaffold — this member is what
 * finally gives the browser an id to present).
 *
 * `{ processId }` is `@kolu/surface-app`'s own `ServerProbeSchema` shape, spelled
 * here rather than imported: the framework's `createServerLifecycle` reads a
 * `{ processId: string }` off whatever probe it is handed, and serving one member
 * of our own is a smaller thing than mounting surface-app's whole surface as a
 * sibling (which is the day build-identity and PWA staleness arrive, not this
 * one). The framework's reserved `system/identity` is not a substitute: it
 * reports the server's start time, and the stale-tab gate compares the id the
 * SERVER chose, which nothing outside it can derive.
 */
const ServerIdentity = Schema.Struct({ processId: Schema.String })
export type ServerIdentity = typeof ServerIdentity.Type

export const surface = defineSurface({
  cells: {
    // Wire-read-only: the server is the only writer, and a write verb it never
    // serves would crash surface's boot walk.
    errors: {
      schema: Schema.Array(OutlineError),
      default: [],
      verbs: ["get"],
    },
  },
  streams: {
    outlines: {
      inputSchema: NoInput,
      outputSchema: OutlineFrame,
    },
  },
  procedures: {
    identity: {
      info: { input: NoInput, output: ServerIdentity },
    },
  },
})
