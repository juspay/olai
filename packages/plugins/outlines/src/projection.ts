import { faceOf, isOutline, nodesOf, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { collectionSlice, decodeRevision, type Projection } from "@olai/surface/projection"

import type { OutlineEntry } from "./wire.ts"

export const outlineProjection = (snapshot: Snapshot<Reading>, previous?: Projection<OutlineEntry>): Projection<OutlineEntry> => {
  const one = decodeRevision(snapshot, previous?.files)
  return { files: one.files, change: collectionSlice(snapshot.value.set, isOutline, outline => ({
    rev: snapshot.rev, nodes: nodesOf(snapshot.value.derived, outline.path),
    broken: one.broken.get(outline.path) ?? null, face: faceOf(outline),
  }), one.decoded, snapshot, previous?.change, one.complete) }
}
