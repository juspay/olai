/** outlines owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { HomesAnswer, HomesRequest, NamedAnswer, NamedRequest, OpFailure, TagsAnswer, TagsRequest, NodeAnswer, NodeRequest, OutlineAnswer, SubtreeAnswer, SubtreeRequest } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
import { FiledPageRequest, FiledPageReading } from "@olai/format"
import { OutlineEntry } from "./wire.ts"
import { MovingAnswer, MovingRequest, NarrowingAnswer, NarrowingRequest } from "@olai/format"
import { MARKS } from "@olai/format"
export const surface = defineSurface({
collections: {
/**
     * The served directory, one entry per outline file.
     *
     * `deltas` is what makes it worth being a collection: a (re)subscribe gets
     * the whole keyed set, and a probe tick that touched three files sends ONE
     * coalesced `{upserts, removes}` frame naming those three — so the wire
     * cost is the files that moved rather than the corpus, and a `git pull`
     * that rewrites forty of them is still one frame.
     *
     * Read-only on the wire. There is no `upsert` a browser could call: a
     * change to an outline is a change to a FILE, and the only way to make one
     * is the ops layer, whose writes come back through the probe like every
     * other change on the disk.
     */
    outlines: {
      /** Root-relative, `/`-spelled — `"roadmap.olai"`, `"notes/todo.olai"`.
       *  The same spelling the store's paths and every `file:line` use. */
      keySchema: Schema.String,
      schema: OutlineEntry,
      verbs: ["keys", "get", "deltas"],
    }
},
streams: {
page: {
      inputSchema: FiledPageRequest,
      outputSchema: FiledPageReading,
      /**
       * A ROW IS ITS `key`, and this is the declaration that says so — the one
       * thing `solid-js/store`'s `reconcile` cannot be told anywhere else, and
       * the member where it pays most in this whole spec.
       *
       * Without it a frame REPLACES every element of every array it merges, so
       * a frame that merely repeats what a tab already holds still notifies
       * every reader of every row: `Tree.tsx`'s `<Key each={rows} by="key">`
       * keeps its DOM, but `keyArray` hands every `Branch` a new object, and
       * some twenty-five bindings per row re-run for a one-character change in
       * one row (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md`'s 2.11 — the
       * one finding of that audit with no client-side fix). With it, an
       * identical frame notifies nothing at all, a changed row notifies that
       * row, and a REORDER moves the row objects the keyed view is following
       * rather than rewriting them.
       *
       * `key` and not `id`, and the choice is forced: one field per member,
       * reaching every array at every depth. `@olai/format`'s `Row.key` is a
       * required, non-nullable string and the identity a place is drawn under
       * (the chain of ids from the page's roots — the same key the fold, the
       * editor's `refound` and every `<Key>` in the tree already follow), where
       * `id` names the NODE and a mirror draws one node in two places. The
       * arrays whose elements carry no `key` — `names`, the crumb trail,
       * `backlinks`, `referrers`, a day's groups — merge BY POSITION, which is
       * the declared reach of this key rather than a fallback around it, and
       * which is silent on a repeated frame just the same. Their consumers all
       * key by VALUE (`<Key by="id">`, `by={placeOf}`, `by="file"`), so
       * position is exactly the right amount of identity to give them.
       */
      arrayKey: "key",
    },
/**
     * WHICH OF THAT PAGE'S NODES THE QUERY SELECTS — the filter box's answer,
     * beside the page it narrows. See {@link ./narrowing.ts}, which argues the
     * shape, why it is a stream, and why it is a stream of its own.
     *
     * One subscription per narrowed pane, keyed by the address AND the words:
     * the server matches over the records that page draws and re-sends only
     * when a revision moved which of them match. What this replaced was
     * `search.matching`, a whole-vault walk asked once per page frame.
     *
     * NO `arrayKey`: what travels is `{id, matched?}` rows with no identity of
     * their own beyond the id, and they merge BY POSITION, which is what the
     * declaration's absence means rather than a fallback around it. The whole
     * answer is rebuilt into a `Map` by its one reader, and an identical frame
     * is silent either way ({@link page}'s own paragraph on the arrays that
     * carry no key).
     */
    narrowing: {
      inputSchema: NarrowingRequest,
      outputSchema: NarrowingAnswer,
    },
/** An open tag completion follows changes to the vault's vocabulary. */
    tagCompletions: {
      inputSchema: TagsRequest,
      outputSchema: TagsAnswer,
    },
/**
     * WHETHER A ROW CAN GO WHERE SOMEBODY IS POINTING — the move-to picker's
     * preview of the planner's verdict, for the destinations its search just
     * offered ({@link ./page.ts}'s closing paragraph).
     *
     * A STREAM beside {@link page} rather than a procedure, for the reason that
     * one is: the panel stands open while anybody writes, and what it judges
     * has to be where the row has actually got to.
     *
     * THE BROWSER'S ALONE, like {@link narrowing} next door and for the same
     * reason: what comes back is a dim and a sentence for a list of rows on a
     * screen. An agent moving a node asks `outlines_move` and is refused by the
     * planner, in the planner's own words.
     */
    moving: {
      inputSchema: MovingRequest,
      outputSchema: MovingAnswer,
    }
},
procedures: {
edit: editProcedures,
/**
     * THE SET'S OWN WORDS, as opposed to a question about them.
     *
     * A sibling of {@link search} rather than a third member of it, because
     * nothing in here reads the query grammar: this answers which tags have
     * been WRITTEN DOWN and how much each is used, where every member of that
     * group is a caller of the one matcher. Two doors with two subjects, said
     * in the shape rather than in a comment on a shared one — and the same
     * division {@link nodes} above makes for a lookup that is not a search
     * either.
     *
     * THE BROWSER'S ALONE ({@link faces} below), like the filter's
     * door: what it answers is a popup's worth of rows, capped by the popup.
     */
    vocabulary: {
      /** The row editor's `#`/`@` completion — the vocabulary of one sigil,
       *  narrowed by what has been typed after it, most-used first. Declared in
       *  `@olai/format`'s `vocabulary.ts` beside the reading that produces it,
       *  for {@link ./search.ts}'s reason: one spelling, so the shape cannot
       *  drift from the answer. */
      tags: {
        input: TagsRequest,
        output: TagsAnswer,
        error: OpFailure,
      },
    },
/**
     * THE IDS AN AGENT WROTE IN BACKTICKS, looked up — which of them the set
     * declares, and what each one names.
     *
     * ITS OWN NAMESPACE rather than a third member of {@link search}, because
     * it is not a search: nothing here reads the filter grammar, ranks anything
     * or decides what a word means. It asks about ids EXACTLY, which is the
     * lookup an edge target and a `see` link already are (`@olai/format`'s
     * `nodeNamed`) — spelled for a dozen at once, because the caller is one
     * message of a transcript and a message holds every backtick the agent put
     * in it.
     *
     * A BATCH is the whole shape: a `outlines_read` per span would be a dozen round
     * trips carrying a dozen nodes in full to decide which two words in a
     * paragraph are pressable.
     *
     * THE BROWSER'S ALONE ({@link faces} below), for the reason the
     * member above is: an agent asking whether an id is real asks `outlines_read`
     * and is told everything about it. What comes back here is a node id per
     * span, which is useful only to a caller already looking at the words those
     * ids are written in.
     */
    nodes: {
      named: {
        input: NamedRequest,
        output: NamedAnswer,
        error: OpFailure,
      },
      /**
       * WHERE THE IDS A READER REMEMBERS NOW LIVE — and whether the set has
       * anything at all from the files they were last seen in.
       *
       * A SECOND MEMBER of this namespace rather than a field on the first,
       * because the two ask different questions of different tables. {@link
       * named} FOLLOWS a mirror chain: a backtick in an agent's prose means the
       * node a reader would be shown. This one is the plain record lookup, no
       * chain walked, because its caller remembers RECORDS — a mirror whose
       * chain has died shows nothing and is folded by its own id, and asked
       * through `named` it would read as a node that is gone while its record
       * sits in the file.
       *
       * THE CALLER is the browser's fold memory (`@olai/web`'s
       * `fold/memory.ts`): collapsed node ids, grouped by the file each node
       * is defined in, kept across reloads. Keeping that honest as the
       * directory moves is three rules — a node that was ARCHIVED is the same
       * node in another file and keeps its fold, a node somebody DELETED should
       * stop being remembered, and a file that stopped parsing says NOTHING
       * about its nodes — and answering all three used to mean walking the whole
       * id→file map of the tab's own copy of the set, per fold. The rules did
       * not move; the map did.
       *
       * TWO LISTS IN, TWO OUT, and no pairing between them
       * (`@olai/format`'s `HomesRequest` argues it): which id was filed under
       * which file is the caller's own bookkeeping, and this end holds no
       * opinion about a browser's storage. They travel together because they
       * are READ together — an id's absence means "deleted" only beside the
       * fact that its file was read at all — and not because the second half is
       * a secret: which files are served, and which would not parse, are on the
       * wire already. What one answer buys is that the halves cannot be about
       * two different revisions.
       *
       * THE BROWSER'S ALONE ({@link faces} below), for the reason
       * every member around it is: an agent that wants to know where a node
       * lives reads it and is told, beside everything else about it. What comes
       * back here is a path per id, useful only to somebody reconciling a
       * memory of their own.
       */
      homes: {
        input: HomesRequest,
        output: HomesAnswer,
        error: OpFailure,
      },
    },
ops: { /** Every outline under the served directory — what `outlines_index` answers.
   *  No input: the question has no parameters, and a `Schema.Struct({})` would
   *  be an empty object a caller has to spell. */
  outlines: { output: OutlineAnswer, error: OpFailure },
/** One node in full, or the id nothing here declares — `outlines_read`. */
  node: { input: NodeRequest, output: NodeAnswer, error: OpFailure },
/** A node and what hangs under it, nested — or a whole OUTLINE, every
   *  top-level node in it, which is what makes reading a file one call rather
   *  than one per root. `outlines_subtree`, and the request names one or the other:
   *  the schemas are `@olai/format`'s, so the rule and the two refusals that
   *  keep it are spelled where the answer is. */
  subtree: { input: SubtreeRequest, output: SubtreeAnswer, error: OpFailure }, run: writeProcedure }
}
})
/**
 * WHICH `Edit.verb`s AND WHICH `WriteRequest.op`s THIS ROW OWNS, keyed by the
 * MEMBER PATH that answers them — `edit.apply` and `ops.run`, the same two
 * words `faces` below spells.
 *
 * THE KEYS WERE WIRE TAGS AND ARE NOT TAGS ANY MORE. They read
 * `surface/edit/apply` and `surface/ops/run`, which were the monolith-era
 * SHORT names: this row registered `root: true` (`./server.ts`), so each member
 * answered under both its own `surface/outlines/edit/apply` and a bare
 * `surface/edit/apply` that six rows shared. The short names are gone, so a
 * key still spelled like one would name a tag nothing serves — a lie in the
 * one place a reader comes to learn what this row writes.
 *
 * NOTHING DISPATCHES ON THESE STRINGS. `./browser.tsx` reads
 * `dispatch["edit.apply"]` to tell `@olai/edit-history`'s
 * `registerWriter` which verbs to route here, and the writer it registers
 * calls this row's OWN client — `ownWire.client()`, resolved per-plugin by
 * `@olai/plugin-api`'s `Wired` — which carries the row's scoped tag with no
 * string of ours anywhere in it. The key is a key.
 *
 * IT MUST STAY EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE. A verb no row claims
 * reaches `writeEdit` with no writer and fails at runtime with "the capability
 * for X is not active" (`@olai/edit-history`'s `writing.ts`); two rows claiming
 * one verb makes the second `registerWriter` throw at mount. `@olai/server`'s
 * `capability-dispatch.test.ts` holds both halves over the whole catalog.
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
  "edit.apply": ["add", "move", "under", "toggle", "walk", "title", "desc", "date", "repeat", "prop", "split", "merge", "unmirror", "mirror", "trash", "duplicate", "see", "after", "place", "mark", "remove"],
  "ops.run": [...MARKS, "add", "title", "desc", "date", "repeat", "prop", "move", "split", "merge", "trash", "duplicate", "see", "mirror", "unmirror", "after", "update", "apply"],
} as const
/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec.
 *
 * The general rule the two halves are decided by — the O(1)-ish cost rule, and
 * the render-shaped/request-shaped split beside it — is `@olai/surface/host`'s
 * `hostFaces`. This row is the widest instance of that split in the tree, and
 * the two maps below share exactly nothing: the browser gets SCREENS and the
 * agent gets NODES.
 *
 * ## The keyboard's door and the request vocabulary are the same split
 *
 * `edit.apply` is on the browser's face and `ops.*` on the agent's, and neither
 * crosses. A browser sends INTENTS and the placement is the server's
 * (`@olai/surface`'s `edit.ts` argues it at length); the ops request vocabulary
 * names what to do to which node, which is what an agent has and a keyboard
 * does not. An agent reaching `edit.apply` would be an agent sending intents
 * about a screen it cannot see, and a tab reaching `ops.run` would be a tab
 * deciding a placement the server owns. That the ops vocabulary can be on the
 * surface AT ALL is a property of these two maps rather than of the members —
 * `@olai/server`'s `faces.test.ts` refuses a write verb on a live browser
 * socket while the same connection goes on answering what a page asks.
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
  // The item: its key set is the file list, and
  // `surface://collections/outlines/outlines/<path>` is one file's records —
  // the same rows the browser draws, subscribable, so an agent watching one
  // outline is told when THAT outline moves instead of polling for it.
  outlines: "resource",
} as const

export const faces = {
  "browser": {
    // WHAT A SCREEN IS — rows carrying the fold keys of the places they are
    // drawn at, a rollup beside a checkbox, the blockers a mark draws, and the
    // titles of the ids those rows point at. The browser's alone: an agent
    // asking what an outline holds asks `outlines_index` and `outlines_subtree` and
    // is answered in NODES, which is what it can act on and what none of this
    // is.
    "page": "resource",
    // ...and the two readings beside it, absent from the agent's face for that
    // same reason. `narrowing` answers a set of ids and why, which is useful
    // only to a caller already looking at the rows those ids name — an agent
    // asking which nodes match asks `search_nodes` and is answered with the
    // nodes. `tagCompletions` answers a POPUP.
    "narrowing": "resource",
    "tagCompletions": "resource",
    // A DIM AND A SENTENCE for a list of rows somebody is arrowing through. An
    // agent moving a node calls `outlines_move` and is refused by the planner, in
    // the planner's own words.
    "moving": "resource",
    // THE KEYBOARD'S DOOR — see the header above.
    "edit.apply": "tool",
    // A POPUP'S WORTH OF WORDS, ranked by how much this set uses each of them
    // and capped by the widget that asked. An agent writing `#home` writes the
    // word, so this whole group is absent from the face below.
    "vocabulary.tags": "tool",
    // A DOZEN IDS, EACH WITH THE NODE IT NAMES — for a panel deciding which of
    // an agent's own backticks are pressable. Absent from the agent's face
    // because an agent asking whether an id is real asks `outlines_read` and is
    // told everything about it.
    "nodes.named": "tool",
    // ...and a file per id, for a browser reconciling a memory of what it had
    // collapsed. An agent that wants to know where a node lives reads it, and
    // is told beside everything else about it.
    "nodes.homes": "tool"
  },
  "agent": {
    // THE SERVED DIRECTORY, one entry per outline file — the item an agent
    // watches. Its key set is the file list and
    // `surface://collections/outlines/<path>` is one file's `{ rev, nodes,
    // broken }`, subscribable, so an agent watching one outline is told when
    // that outline moves instead of polling for it. The `rev` rides along,
    // which is the base a write will one day name.
    //
    // IT IS ABSENT FROM THE BROWSER'S MAP, and that absence is what the whole
    // vault-in-browser arc was for. It was the first member on that face, and
    // every page in the app was a pure function over the tab's own copy of it —
    // which is the ruling that was reversed: a browser may hold at most the
    // current page's data, never the whole vault. A tab reads
    // `olai-plugin-vault`'s `heads` for the directory and `page` above for the
    // page it is drawing, and asks for no record it does not draw. Watching ONE
    // outline's records, keyed, with deltas, is exactly what a request-shaped
    // reader wants, and it was never the problem.
    "outlines": "resource",
    "ops.outlines": "tool",
    "ops.node": "tool",
    "ops.subtree": "tool",
    "ops.run": "tool"
  }
} as const
