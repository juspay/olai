/**
 * WHY THE PROJECTION IS NOT IN `./wire.ts`, which is where it briefly was.
 *
 * A `./wire` door is INERT — schemas and nothing else, which is the sentence
 * every row's `surface.ts` opens with and the property that lets a browser load
 * a contract without acquiring anything. This file is not inert in the way that
 * matters: it reaches `@olai/surface/projection` for the slicing rule, which
 * reaches `@olai/format`'s set readers, and `./surface.ts` imports the entry
 * schema as a VALUE — so a projection sitting beside the schema puts the
 * server's revision machinery on the graph of every browser that loads the
 * spec. It is a few hundred lines of code no tab can call, on the one graph
 * where nothing unused is free.
 *
 * So the split is by GRAPH rather than by subject: the schema crosses to the
 * browser, the projection does not, and the two doors say which is which.
 * `@olai/bundle`'s `fence.test.ts` walks the browser entry's transitive imports
 * and is what keeps the answer honest.
 */
import { type Document, faceOf, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { changeOf, frame, type Projection } from "@olai/surface/projection"

import type { Head } from "./wire.ts"

/** The heads' membership, which is every served file — the one collection whose
 *  predicate narrows nothing. Spelled as a predicate anyway rather than given
 *  the whole list, so this row's projection is the same statement its two
 *  neighbours are and there is no second shape here for a reader to hold in
 *  mind. */
const everyFile = (_document: Document): _document is Document => true

/**
 * THIS REVISION'S `heads`, and the one before it consumed.
 *
 * Five lines because the rule is not here: `@olai/surface`'s `projection.ts`
 * holds the slicing and the minting, argued in full, and this is the part only
 * this row can supply — which files are its keys (every one of them), and what
 * one of them is worth on the wire ({@link Head}).
 *
 * IT IS THE COLLECTION THAT HOLDS EVERY FILE, which is what makes the other
 * two rows' key sets subsets of this one and what a reader relies on: a head
 * missing for a file the directory holds is a file the sidebar stops showing,
 * and a bodied file's head is always here to open its body against. The
 * containment is not asserted here — nothing in this file can see another
 * row's keys — but in `@olai/bundle`'s `published.test.ts`, which is the
 * package that has all three.
 */
export const headProjection = (snapshot: Snapshot<Reading>, previous?: Projection<Head>): Projection<Head> => {
  const one = frame(snapshot, previous?.files)
  return { files: one.files, change: changeOf(snapshot.value.set, everyFile, document => ({
    rev: snapshot.rev, face: faceOf(document), broken: one.broken.get(document.path) ?? null,
  }), one.decoded, snapshot, previous?.change, one.complete) }
}
