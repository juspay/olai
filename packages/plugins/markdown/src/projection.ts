import { isMarkdown, type Markdown, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { changeOf, frame, type Projection } from "@olai/surface/projection"
import type { DocumentEntry } from "./wire.ts"

export const documentProjection = (snapshot: Snapshot<Reading>, previous?: Projection<DocumentEntry>): Projection<DocumentEntry> => {
  const files = frame(snapshot, previous?.files)
  const change = changeOf<Markdown, DocumentEntry>(
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
