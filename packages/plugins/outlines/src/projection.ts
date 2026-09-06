/**
 * WHY THE PROJECTION IS NOT IN `./wire.ts`, which is where it briefly was.
 *
 * A `./wire` door is INERT — schemas and nothing else, which is the sentence
 * every row`s `surface.ts` opens with and the property that lets a browser load
 * a contract without acquiring anything. This file is not inert in the way that
 * matters: it reaches `@olai/surface/projection` for the slicing rule, which
 * reaches `@olai/format``s set readers, and `./surface.ts` imports the entry
 * schema as a VALUE — so a projection sitting beside the schema puts the
 * server`s revision machinery on the graph of every browser that loads the
 * spec. It is a few hundred lines of code no tab can call, on the one graph
 * where nothing unused is free.
 *
 * So the split is by GRAPH rather than by subject: the schema crosses to the
 * browser, the projection does not, and the two doors say which is which.
 * `@olai/bundle`s `fence.test.ts` walks the browser entry`s transitive imports
 * and is what keeps the answer honest.
 */
import { faceOf, isOutline, nodesOf, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { changeOf, frame, type Projection } from "@olai/surface/projection"

import type { OutlineEntry } from "./wire.ts"

/**
 * THIS REVISION'S `outlines`, and the one before it consumed.
 *
 * Five lines because the rule is not here: `@olai/surface`'s `projection.ts`
 * holds the slicing and the minting, argued in full, and this is the part only
 * this row can supply — which files are its keys (`isOutline`), and what one of
 * them is worth on the wire ({@link OutlineEntry}). The previous projection is
 * CONSUMED, not merely read: its maps are written into and handed back inside
 * the value this returns, which is why `./server.ts` replaces `held` on the
 * same synchronous stack that writes the deltas.
 */
export const outlineProjection = (snapshot: Snapshot<Reading>, previous?: Projection<OutlineEntry>): Projection<OutlineEntry> => {
  const one = frame(snapshot, previous?.files)
  return { files: one.files, change: changeOf(snapshot.value.set, isOutline, outline => ({
    rev: snapshot.rev, nodes: nodesOf(snapshot.value.derived, outline.path),
    broken: one.broken.get(outline.path) ?? null, face: faceOf(outline),
  }), one.decoded, snapshot, previous?.change, one.complete) }
}
