import { type Document, faceOf, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { changeOf, frame, type Projection } from "@olai/surface/projection"

import type { Head } from "./wire.ts"

const everyFile = (_document: Document): _document is Document => true

export const headProjection = (snapshot: Snapshot<Reading>, previous?: Projection<Head>): Projection<Head> => {
  const one = frame(snapshot, previous?.files)
  return { files: one.files, change: changeOf(snapshot.value.set, everyFile, document => ({
    rev: snapshot.rev, face: faceOf(document), broken: one.broken.get(document.path) ?? null,
  }), one.decoded, snapshot, previous?.change, one.complete) }
}
