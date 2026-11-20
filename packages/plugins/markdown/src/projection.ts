import { isMarkdown, type Markdown, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { collectionSlice, decodeRevision, type Projection } from "@olai/surface/projection"
import type { DocumentEntry } from "./wire.ts"

export const documentProjection = (snapshot: Snapshot<Reading>, previous?: Projection<DocumentEntry>): Projection<DocumentEntry> => {
  const files = decodeRevision(snapshot, previous?.files)
  const change = collectionSlice<Markdown, DocumentEntry>(
    snapshot.value.set,
    (document): document is Markdown => isMarkdown(document) && document.kind === "markdown",
    document => ({
      rev: snapshot.rev,
      text: document.body,
      refused: files.broken.get(document.path)?.errors.some(error => error.code === "unreadable-file") === true,
    }),
    files.decoded, snapshot, previous?.change, files.complete,
  )
  return { files: files.files, change }
}
