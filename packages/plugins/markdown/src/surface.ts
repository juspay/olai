/** markdown owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { OpFailure, DocumentAnswer, DocumentBody, DocumentRequest } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
import { FiledPageReading, DocumentPageRequest } from "@olai/format"
import { DocumentEntry } from "./wire.ts"
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
     * THE BROWSER'S ALONE ({@link faces} below), like the two readings
     * above and for their reason: what comes back is a screen — rows with their
     * fold keys, a rollup, the blockers a checkbox draws. An agent asking what
     * an outline holds asks `outlines_index` and `outlines_subtree`, and is answered
     * in nodes.
     */
    documentPage: { inputSchema: DocumentPageRequest, outputSchema: FiledPageReading, arrayKey: "key" }
},
procedures: {
edit: editProcedures,
ops: { /**
   * Every document under the served directory — what `markdown_index`
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
   * — with the near miss, in `markdown_write`'s own words — and refuses a file
   * the set could not read rather than handing back a body nobody read, which
   * is what an agent about to WRITE the file needs to be told.
   *
   * And a tool is a thing a model can call, where a resource is a thing a host
   * may or may not put in front of it. That is the plainest reason the write
   * verbs' prose now points here: an agent cannot be asked to supply what it
   * read (`markdown_write`'s `was`) through a channel it may not have.
   */
  documents: { output: DocumentAnswer, error: OpFailure },
/** One document, whole — `markdown_read`. Refuses a path the set does not
   *  hold rather than answering it, and refuses one the set could not read
   *  rather than answering empty: see `@olai/format`'s `DocumentBody`, and the
   *  paragraph above for how that differs from the collection's `get`. */
  document: { input: DocumentRequest, output: DocumentBody, error: OpFailure }, run: writeProcedure }
}
})
/**
 * WHICH `Edit.verb`s AND `WriteRequest.op`s THIS ROW OWNS, keyed by the MEMBER
 * PATH that answers them.
 *
 * THE KEYS WERE WIRE TAGS AND ARE NOT TAGS ANY MORE: `surface/edit/apply` and
 * `surface/ops/run` were the monolith-era SHORT names this row answered under
 * beside its own `surface/markdown/edit/apply`, and those short names are
 * deleted, so spelling one here would name a tag nothing serves. Nothing
 * dispatches on these strings — `./browser.tsx` uses `dispatch["edit.apply"]`
 * as a key and writes through this row's own scoped client.
 *
 * EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE, or a verb reaches `writeEdit` with
 * no writer and fails at runtime with "the capability for X is not active"
 * (`@olai/edit-history`'s `writing.ts`). `@olai/server`'s
 * `capability-dispatch.test.ts` holds it.
 *
 * `field` WENT WITH THE ENVELOPE. Each entry used to be
 * `{ field: "verb", cases: [...] }`, because the composition root routed one
 * shared bare tag to an owner by reading that field off the payload. There is
 * no shared tag and no envelope, and the discriminator is already implied by
 * the member — `edit.apply`'s cases are `Edit.verb`s, `ops.run`'s are
 * `WriteRequest.op`s — so the word was a second statement of a fact with no
 * reader left. `capability-dispatch.test.ts` is what checks the cases are the
 * right union's.
 */
export const dispatch = {
  "edit.apply": ["doc", "docNew"],
  "ops.run": ["doc", "create-doc"],
} as const
/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec.
 *
 * The general rule it is written against — a cell is exposable iff its value is
 * O(1)-ish, and anything O(corpus) must be a COLLECTION — is
 * `@olai/surface/host`'s `hostFaces`. {@link documents} is the worked example
 * of the second half: it is the bodied half of the served directory, every `.md`
 * and every `.html`, and it is on BOTH faces for exactly that reason. Its key
 * set costs the paths and a body travels only when somebody asks for that one
 * file. It is also declared `keys` + `get` with no `deltas`, so there is not
 * even a batched verb here to reach for by mistake — `olai-plugin-vault`'s
 * `heads` argues why the omission and its own `deltas` are one decision read
 * twice.
 */
/**
 * WHAT AN AGENT MAY SEE OF THIS ROW AS A `surface://` RESOURCE — a THIRD
 * projection, and not a fourth face.
 *
 * `faces` above says which of this row's tags each WIRE caller may reach.
 * This says which of its members the MCP adapter publishes as a resource at
 * all, because that adapter needs the member's KIND to build a URI and a tag
 * set has thrown that away. The two answer different questions and a member on
 * one and not the other is an ordinary state: every `ops.*` on `faces.agent` is
 * reachable and is no resource, because a procedure is not a thing with an
 * address.
 *
 * IT WAS `@olai/bundle`'s `MCP`, one flat map naming three rows' members from a
 * package none of them could edit. #546 sent each line home, and juspay/kolu#2234
 * is what made a per-sibling map the framework's own shape: the adapter takes a
 * rooted bundle, resolves each row's map against that row's spec, and mints
 * `surface://collections/<row>/<member>` from the key it was mounted under.
 *
 * THE RULE THIS IS WRITTEN AGAINST is the wire-cost one in
 * `@olai/surface`'s `host.ts`: a cell is exposable only if its value is
 * O(1)-ish, and anything O(corpus) must be a COLLECTION, whose resource reads
 * the KEY SET and hands a body one at a time.
 */
export const resources = {
  // The bodied half of the same directory, and a COLLECTION for exactly the
  // reason the rule gives: the key-set resource costs the paths and a body
  // travels only when an agent asks for that one file. Declared `keys` + `get`
  // with no `deltas`, so there is not even a batched verb here to reach for by
  // mistake.
  documents: "resource",
} as const

export const faces = {
  "browser": {
    "documents": "resource",
    // A SCREEN, not a file — see the member's own paragraph above. The
    // browser's alone, like every other page reading in the tree.
    "documentPage": "resource",
    // THE KEYBOARD'S DOOR. `ops.*` is the agent's and does not cross, which is
    // `olai-plugin-outlines`' `faces` header in full.
    "edit.apply": "tool"
  },
  "agent": {
    "documents": "resource",
    "ops.documents": "tool",
    "ops.document": "tool",
    "ops.run": "tool"
  }
} as const
