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
import { isMarkdown, type Markdown, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { changeOf, frame, type Projection } from "@olai/surface/projection"
import type { DocumentEntry } from "./wire.ts"

/** Only this row's kept documents ride this collection. Unkept text is read
 * on demand through the vault's body procedure, independently of markdown. */
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
