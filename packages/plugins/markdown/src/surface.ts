/** markdown owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { OpFailure, DocumentAnswer, DocumentBody, DocumentRequest } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
import { CorePageReading, DocumentPageRequest, DocumentEntry } from "@olai/surface"
export const surface = defineSurface({
collections: {
/**
     * Every BODIED file the directory holds, one entry each — see
     * {@link DocumentEntry}.
     *
     * That is every `.md` and every `.html`: the files whose content olai
     * carries verbatim rather than parsing into records (`@olai/format`'s
     * registry says which those are). ONE collection rather than one per kind,
     * because what is encapsulated here is not markdown — it is "a body,
     * fetched per key, by whoever is showing it", and a second collection would
     * be that same arrangement built again for a file that differs only in how
     * a page draws it. The name is kept because it is the wire's: an MCP client
     * already addresses `surface://collections/documents`.
     *
     * `keys` and `get`, and NO `deltas`, and the omission is the whole point.
     * `deltas` opens with a snapshot of every entry, which for this collection
     * is every body: the batched verb that makes `outlines` cheap is the exact
     * shape that made documents expensive. So a reader takes the KEY SET —
     * which is what the sidebar's file tree draws (paths, no titles, no text)
     * — and opens a per-key `get` for the one document it is showing. A
     * directory of a thousand `.md` files costs a thousand PATHS on first
     * paint, and one body per document actually read.
     *
     * Read-only on the wire, like the outlines and for the same reason: a
     * document is a file on the disk, and the ops layer is the only writer.
     */
    documents: {
      /** Root-relative, `/`-spelled — the same spelling `outlines` uses, and
       *  the same spelling `doc` resolves to (`docOf`) and every `file:line`
       *  names. */
      keySchema: Schema.String,
      schema: DocumentEntry,
      verbs: ["keys", "get"],
    }
},
streams: {
/**
     * WHAT ONE PAGE SHOWS — the member this whole design was for. See
     * {@link ./page.ts}, which argues the shape, the stream, and what
     * deliberately does not ride here.
     *
     * One subscription per open pane, keyed by the address that pane is
     * drawing: the server computes the reading over the set it already holds
     * and re-sends it whenever a revision changes it by value. What the browser
     * used to do instead was hold every record of every file and answer the
     * same question locally.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), like the two readings
     * above and for their reason: what comes back is a screen — rows with their
     * fold keys, a rollup, the blockers a checkbox draws. An agent asking what
     * an outline holds asks `list_outlines` and `read_subtree`, and is answered
     * in nodes.
     */
    documentPage: { inputSchema: DocumentPageRequest, outputSchema: CorePageReading, arrayKey: "key" }
},
procedures: {
edit: editProcedures,
ops: { /**
   * Every document under the served directory — what `list_documents`
   * answers. No input, for {@link outlines}' reason: a directory is not a
   * question with parameters.
   *
   * ## Why these two exist beside the `documents` COLLECTION
   *
   * The collection serves the same files and an agent can reach it — it is in
   * `@olai/server`'s `MCP` map, as `surface://collections/documents/<path>`.
   * So this pair is a SECOND route to a body, and that is deliberate rather
   * than overlooked: the two are shaped for the two kinds of consumer olai
   * has, and a reader who assumes they are twins will be surprised by every
   * difference below.
   *
   * A COLLECTION is render-shaped. Its key set is every BODIED file's path —
   * the `.html` included, whose body the set does not keep — a `get` is one
   * key at a time, and the point of it is that a tab holding one file open is
   * pushed the news when it moves. It answers a KEY: a path it does not hold
   * is simply not there, and a file in `broken` reads as the empty text the
   * set is carrying for it, because a page's job is to draw what there is.
   *
   * THESE are request-shaped. The listing is the `.md` the document verbs
   * actually take, with the line each opens with and what it weighs, which is
   * what an agent chooses a file WITH; the read refuses a path that is not one
   * — with the near miss, in `write_document`'s own words — and refuses a file
   * the set could not read rather than handing back a body nobody read, which
   * is what an agent about to WRITE the file needs to be told.
   *
   * And a tool is a thing a model can call, where a resource is a thing a host
   * may or may not put in front of it. That is the plainest reason the write
   * verbs' prose now points here: an agent cannot be asked to supply what it
   * read (`write_document`'s `was`) through a channel it may not have.
   */
  documents: { output: DocumentAnswer, error: OpFailure },
/** One document, whole — `read_document`. Refuses a path the set does not
   *  hold rather than answering it, and refuses one the set could not read
   *  rather than answering empty: see `@olai/format`'s `DocumentBody`, and the
   *  paragraph above for how that differs from the collection's `get`. */
  document: { input: DocumentRequest, output: DocumentBody, error: OpFailure }, run: writeProcedure }
}
})
export const dispatch = {
  "surface/edit/apply": { field: "verb", cases: ["doc", "docNew"] },
  "surface/ops/run": { field: "op", cases: ["doc", "create-doc"] },
} as const
export const faces = {
  "browser": {
    "documents": "resource",
    "documentPage": "resource",
    "edit.apply": "tool"
  },
  "agent": {
    "documents": "resource",
    "ops.documents": "tool",
    "ops.document": "tool",
    "ops.run": "tool"
  }
} as const
