import { isMarkdown, type Markdown, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { collectionSlice, decodeRevision, type Projection } from "@olai/surface/projection"
import type { DocumentEntry } from "./wire.ts"

export const documentProjection = (snapshot: Snapshot<Reading>, previous?: Projection<DocumentEntry>): Projection<DocumentEntry> => {
  const files = decodeRevision(snapshot, previous?.files)
  const change = collectionSlice<Markdown, DocumentEntry>(
    snapshot.value.set,
    (document): document is Markdown => isMarkdown(document) && document.kind === "markdown",
    document => files.broken.get(document.path)?.errors.some(error => error.code === "unreadable-file") === true
      ? { rev: snapshot.rev, state: "refused" }
      : { rev: snapshot.rev, state: "served", text: document.body },
    files.decoded, snapshot, previous?.change, files.complete,
  )
  return { files: files.files, change }
}

export const readOnlyCollection = <V>(entries: () => Map<string, V>) => ({
  readAll: entries,
  readOne: (key: string) => entries().get(key),
  upsert: () => {},
  remove: () => {},
})
