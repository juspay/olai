/**
 * @olai/surface — the typed reactive layer, declared once for both ends.
 *
 * The server implements this and the browser subscribes to it; neither writes
 * a line of wire code. That is the rule carried over from the htmx era: no raw
 * sockets, no hand-rolled routes, no message envelopes — the only protocol is
 * this spec, and both sides are type errors away from disagreeing about it.
 *
 * Phase 2 declares exactly two members, which is the whole of "see your
 * outline":
 *
 *   - `outlines` is a STREAM, not a cell: the files belong to the disk, not to
 *     the server, so the server reports what it read rather than owning a
 *     value it could be asked to change. Every subscription opens with a full
 *     snapshot, so a reconnect is a fresh read and nothing has to be resumed.
 *   - `errors` is a CELL, read-only on the wire, because "what is wrong right
 *     now" is one value the server does own. It is deliberately independent of
 *     the snapshot: phase 3 keeps the last good tree on screen underneath it,
 *     and a consumer written against two subscriptions today needs no change
 *     to get that.
 *
 * Ops arrive as procedures in phase 4 and chat as events in phase 5. Both slot
 * into this same spec.
 */

import { OutlineError, OutlineSet } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

/**
 * One frame of the outline stream: the loaded set, or `null` for a set that
 * did not load.
 *
 * `null` is a state, not an absence. Three things a reader must tell apart —
 * "the server has not answered yet" (no frame), "the server answered and the
 * files are broken" (`null`), "here is your outline" (a snapshot) — and a
 * nullable frame says all three with no second encoding. Why it is broken
 * lives in the `errors` cell and nowhere else; carrying the list here as well
 * would be one copy too many, and the copy a consumer picked would decide
 * which of two truths it showed.
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
})
