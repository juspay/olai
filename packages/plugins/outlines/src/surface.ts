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
     * screen. An agent moving a node asks `move_node` and is refused by the
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
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), like the filter's
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
     * A BATCH is the whole shape: a `read_node` per span would be a dozen round
     * trips carrying a dozen nodes in full to decide which two words in a
     * paragraph are pressable.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), for the reason the
     * member above is: an agent asking whether an id is real asks `read_node`
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
       * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), for the reason
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
ops: { /** Every outline under the served directory — what `list_outlines` answers.
   *  No input: the question has no parameters, and a `Schema.Struct({})` would
   *  be an empty object a caller has to spell. */
  outlines: { output: OutlineAnswer, error: OpFailure },
/** One node in full, or the id nothing here declares — `read_node`. */
  node: { input: NodeRequest, output: NodeAnswer, error: OpFailure },
/** A node and what hangs under it, nested — or a whole OUTLINE, every
   *  top-level node in it, which is what makes reading a file one call rather
   *  than one per root. `read_subtree`, and the request names one or the other:
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
 * `dispatch["edit.apply"].cases` to tell `@olai/edit-history`'s
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
 */
export const dispatch = {
  "edit.apply": { field: "verb", cases: ["add", "move", "under", "toggle", "walk", "title", "desc", "date", "repeat", "prop", "split", "merge", "unmirror", "mirror", "trash", "duplicate", "see", "after", "place", "mark", "remove"] },
  "ops.run": { field: "op", cases: [...MARKS, "add", "title", "desc", "date", "repeat", "prop", "move", "split", "merge", "trash", "duplicate", "see", "mirror", "unmirror", "after", "update", "apply"] },
} as const
export const faces = {
  "browser": {
    "page": "resource",
    "narrowing": "resource",
    "tagCompletions": "resource",
    "moving": "resource",
    "edit.apply": "tool",
    "vocabulary.tags": "tool",
    "nodes.named": "tool",
    "nodes.homes": "tool"
  },
  "agent": {
    "outlines": "resource",
    "ops.outlines": "tool",
    "ops.node": "tool",
    "ops.subtree": "tool",
    "ops.run": "tool"
  }
} as const
