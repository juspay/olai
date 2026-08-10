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
 *
 * Who is on the other end is NOT a member here, and it was for one commit. The
 * question is real — a page bound to a replaced server must know — but the
 * framework reserves `system/identity` for it and answers it out of every
 * surface, process id included, so an app that declares its own is declaring a
 * second answer to a question already answered (juspay/kolu#2133).
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

/** The one HTTP address both ends spell — see {@link ./media.ts}. */
export { MEDIA_PREFIX, mediaHref, mediaTarget } from "./media.ts"
