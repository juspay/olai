/**
 * The tool surface: everything an agent may do to a served directory, and
 * nothing else.
 *
 * This is a CLOSED list, and what is missing from it is the design. There is no
 * file read, no directory listing, no shell and no grep, and no write that
 * names a byte — the agent names a NODE, or (since `md-editing`) a whole
 * DOCUMENT. That second one is the closest this list comes to a file write and
 * is deliberately not one: `write_document` takes a `.md` the set already
 * holds and replaces its text ENTIRELY, through the same plan → validate →
 * stage → rename → commit gate, so there is no offset, no range, and nothing
 * for a caller to splice. Two consequences follow, and both were paid for:
 *
 *   - a malformed outline is unrepresentable through this path. Every write
 *     goes through {@link ./plan.ts} to whole records and the format's own
 *     writer, so the glued-line file of 2026-08-09 — two records on one line,
 *     produced by an agent editing text — is not a thing these tools can
 *     express;
 *   - a refusal is structured. A `validation` refusal comes back with the
 *     validator's own rows as data, which is what lets the agent fix the one
 *     line that is wrong and the chat panel draw the report.
 *
 * Each entry carries its request schema, and the JSON Schema an agent sees is
 * DERIVED from it ({@link ./mcp.ts}) rather than written beside it. A READ
 * carries its reader too, in the same entry — so a tool the table declares and
 * nothing answers is a type error rather than a runtime throw, which is what
 * the dispatch switch this replaced could only discover when somebody called
 * it. One declaration, several uses, no second list to keep in step.
 */

import { Effect, Schema } from "effect"

import {
  AddRequest,
  AfterRequest,
  ArchiveRequest,
  type CommitRequest,
  CommitRequest as CommitRequestSchema,
  type CommitResult,
  CreateDocumentRequest,
  CreateRequest,
  DateRequest,
  DescRequest,
  type Derived,
  MARKS,
  MarkRequest,
  MergeRequest,
  MirrorRequest,
  MoveRequest,
  NodeAnswer,
  NodeRequest,
  PropRequest,
  type OpFailure,
  OutlineAnswer,
  type OutlineSet,
  type PushResult,
  SearchAnswer,
  SearchRequest,
  SeeRequest,
  SplitRequest,
  type Status,
  SubtreeAnswer,
  SubtreeRequest,
  TitleRequest,
  UnarchiveRequest,
  UnmirrorRequest,
  WriteDocumentRequest,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"

import * as Query from "./query.ts"

/** The set as a reader sees it: the files that were found, and the derivations
 *  every answer is computed from. One value, so a run of queries walks the tree
 *  once ({@link ./query.ts}).
 *
 *  TWO FIELDS, and both are pure functions of one snapshot — which is what
 *  lets `@olai/server`'s `edit.ts` and `context.ts` advertise themselves as
 *  pure over a Reading. */
export interface Reading {
  readonly set: OutlineSet
  readonly derived: Derived
}

interface Described {
  readonly name: string
  readonly title: string
  readonly description: string
  /** The schema the arguments are decoded against. */
  readonly schema: Schema.Top
}

/**
 * The READ half of the ops layer, as the four questions the query tools ask —
 * not as a snapshot for each of them to walk.
 *
 * It is {@link Acting} for reads, and it exists for the reason that one does,
 * one door further along: a tool has to be answerable by something that is not
 * a local `Ops`. Since `mcp-bridge` the table is projected onto a SURFACE
 * CLIENT — in-process over a direct dispatch, or over a unix socket into an
 * `olai web` that already holds the store — and neither of those can be handed
 * a {@link Reading}, which is the whole set plus its derivations and exists
 * only where the store is.
 *
 * So the envelope each read answers in — `{ outlines }`, `?? { missing: id }` —
 * is declared ONCE, here in {@link asking}, and the table's entries are the
 * one-line calls onto it that the act arm's already are. What a reader would
 * otherwise have is two spellings of the same envelope, one for the local
 * answer and one for the wire's.
 *
 * The WALKS do not move and are not here: which nodes match, which mirrors
 * resolve, how far a subtree descends stay in {@link ./query.ts}, pure over a
 * `Reading`, exactly as `@olai/format` holds the shapes and this package holds
 * the walks.
 */
export interface Asking {
  /** Every outline under the served directory — `list_outlines`. */
  readonly outlines: Effect.Effect<OutlineAnswer, OpFailure>
  /** One node in full, or the id nothing here declares — `read_node`. */
  readonly node: (request: NodeRequest) => Effect.Effect<NodeAnswer, OpFailure>
  /** A node and what hangs under it, nested — `read_subtree`. */
  readonly subtree: (
    request: SubtreeRequest,
  ) => Effect.Effect<SubtreeAnswer, OpFailure>
  /** The one question two faces ask — `search_nodes` and the ⌘K palette. */
  readonly search: (
    request: SearchRequest,
  ) => Effect.Effect<SearchAnswer, OpFailure>
}

/** The four envelopes, over whatever answers "the set as a reader sees it".
 *  ONE declaration: `{@link ./ops.ts}`'s `make` builds an {@link Asking} over
 *  its own gated read, and a test builds one over a fixture — and the second is
 *  then genuinely testing what an agent calls rather than what `Query` returns.
 *
 *  The read is taken as an EFFECT rather than a value because that is what the
 *  ops layer has: "the served directory has never loaded" is one refusal,
 *  raised in one place, and every question inherits it. */
export const asking = (read: Effect.Effect<Reading, OpFailure>): Asking => ({
  outlines: Effect.map(read, (at) => ({
    outlines: Query.outlines(at.set, at.derived),
  })),
  node: (request) =>
    Effect.map(read, (at) => Query.detail(at.derived, request.id) ?? { missing: request.id }),
  subtree: (request) =>
    Effect.map(read, (at) =>
      Query.subtree(
        at.derived,
        request.id,
        request.depth === undefined ? {} : { depth: request.depth },
      ) ?? { missing: request.id }),
  search: (request) => Effect.map(read, (at) => Query.search(at.derived, request)),
})

/**
 * The WRITE half, the same way: one verb, and the only thing every one of the
 * write tools does. Named as an argument for {@link Acting}'s reason —
 * and, since `mcp-bridge`, satisfied by a surface client as readily as by a
 * local `Ops`.
 *
 * NO WRITER, unlike `Ops.run` which this is otherwise the shape of. Who is
 * writing is not a tool's business — a tool that could name a writer could name
 * the wrong one — so it is bound where the DOOR is built, one layer out, and
 * every table entry below is one call with nothing to remember.
 */
export interface Running {
  readonly run: (request: Request) => Effect.Effect<Applied, OpFailure>
}

/** The half of the ops layer a self-answering tool reaches. Named as an
 *  argument rather than imported as the whole `Ops`, so the table below stays a
 *  declaration of tools rather than a consumer of the writer. */
export interface Acting {
  readonly commit: (request: CommitRequest) => Effect.Effect<CommitResult>
  /** No arguments at all: the current branch to the upstream it already has. */
  readonly push: Effect.Effect<PushResult>
}

/**
 * A tool, as this package declares it.
 *
 * Three arms, and each CARRIES what answers it rather than leaving the
 * dispatcher to know: a READ answers from a snapshot and says how; an ACT
 * answers from the ops layer and says how; a WRITE names the part of the
 * request its own NAME already decides (`set_done` is `op: "done"`), so that
 * field never appears in the schema an agent fills in — and it is the one arm
 * with nothing to carry, because every write is the same call.
 *
 * That is the rule the read arm was built on and the reason it is worth
 * keeping: a tool the table declares and nothing answers is a type error rather
 * than something a caller discovers. A tag the dispatcher had to branch on
 * would put the next verb's answer in a switch in another file.
 */
export type Tool =
  | (Described & {
    readonly kind: "read"
    /**
     * The shape this read answers with — `@olai/format`'s declaration, beside
     * the request schema and for the same reason.
     *
     * The read arm is the one that can say this, because it is the one whose
     * answer is a VALUE rather than an effect, and saying it is what makes the
     * arm's own rule reach the answer as well as the reader: a read that
     * answers something other than what it declares does not build, and a read
     * added without declaring one does not build either. Without it the reader
     * comes back as `unknown` and its literal — the `outlines` envelope, the
     * `{ missing }` — is checked against nothing at all.
     *
     * READ AT RUNTIME by `./tools.test.ts`, which walks the table, calls every
     * reader over a maximal set and decodes each answer against this. That is
     * deliberately a test rather than an encode at the MCP seam: what is being
     * checked is that the declaration agrees with the producer, which is a
     * fact about the build, and an encode there would either drop a drifted
     * field silently (Effect's default) or turn one into a failed tool call
     * for a live agent.
     */
    readonly answers: Schema.Top
    /** How this read is ANSWERED — one call onto {@link Asking}, exactly as the
     *  act arm below is one call onto {@link Acting}. It used to be a pure
     *  function of a {@link Reading}, which is a thing only a process holding
     *  the store has; the door it reaches through is now the same one whether
     *  the store is in this process or in an `olai web` next door. */
    readonly ask: (
      asking: Asking,
      args: never,
    ) => Effect.Effect<unknown, OpFailure>
  })
  | (Described & {
    readonly kind: "write"
    readonly fixed: Readonly<Record<string, unknown>>
  })
  | (Described & {
    readonly kind: "act"
    readonly act: (ops: Acting, args: never) => Effect.Effect<unknown, never>
  })

// ── reading ────────────────────────────────────────────────────────────

/** A read asks NOTHING that is not on the floor either — the request schemas
 *  below are `@olai/format`'s, for the reason its `./reading.ts` argues: a
 *  question the agent's face asks and a question a wire spec would carry are one
 *  question, and two spellings of it are two spellings free to drift. This is
 *  the one read with nothing to ask, which is why it is the only one declared
 *  here. */
const NoArgs = Schema.Struct({})

// ── the list ───────────────────────────────────────────────────────────

/**
 * Both schemas, then the question between them.
 *
 * `R` is INFERRED from `answers`, so the call is checked against the floor's
 * declaration with nothing written at the call site — and a read that does not
 * say what it answers does not compile, rather than quietly getting `unknown`
 * and being checked against nothing. `A` still needs its annotation on the
 * asker, because the request parameter's `| Schema.Top` arm defeats inference;
 * that is the older half and untouched here.
 */
const read = <A, R>(
  name: string,
  title: string,
  description: string,
  schema: Schema.Codec<A, never, never, never> | Schema.Top,
  answers: Schema.Codec<R, R, never, never>,
  ask: (asking: Asking, args: A) => Effect.Effect<R, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "read",
  answers,
  ask: ask as (asking: Asking, args: never) => Effect.Effect<unknown, OpFailure>,
})

const write = (
  name: string,
  title: string,
  description: string,
  schema: Schema.Top,
  fixed: Readonly<Record<string, unknown>>,
): Tool => ({ name, title, description, schema, kind: "write", fixed })

const act = <A>(
  name: string,
  title: string,
  description: string,
  schema: Schema.Codec<A, never, never, never> | Schema.Top,
  answer: (ops: Acting, args: A) => Effect.Effect<unknown, never>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "act",
  act: answer as (ops: Acting, args: never) => Effect.Effect<unknown, never>,
})

/**
 * What each MARK's tool says. The prose is per mark — they refuse for
 * different reasons and mean different things — but WHICH marks there are is
 * not this table's to decide, which is what the spread below is for.
 */
const MARK_TOOL = {
  done: {
    title: "Mark done",
    description:
      "Mark a node done, or undo that with `undo: true`. The mark RECORDS THE INSTANT it is made — a local ISO datetime with this machine's UTC offset, written for you — so the node appears on that day's journal page; there is no way here to write a bare `true` or to choose the day, and `set_date` is what schedules a node for one. Works on any node, children or not — a mark is a stored fact, never computed from what hangs below. Done-hidden hides a done node WITH its subtree, so this is a claim about the whole branch: it is REFUSED while the branch below holds a task that is not done, and the refusal names them (title, id and mark). Finish those first, or take the mark off the ones that are not happening — an unmarked bullet is not unfinished work, so bullets never stand in the way.",
  },
  doing: {
    title: "Mark doing",
    description:
      "Mark a node as under way, or undo that with `undo: true`. Stored as `true` and not dated, and a date written here by hand would place the node nowhere: the journal reads a node's `date` and its `done` instant only, because the day work was picked up is a fact about the task rather than about the day. A node that is already done must be un-done first. THE ORDER IS A LAW FOR THIS VERB: a node whose `after` targets include a task that is not done cannot start, and the refusal names them — finish those, or start what is ready. `set_done` is not gated that way, because finishing out of order is sometimes simply what happened. Works on any node, children or not. IF AN ANCESTOR IS DONE, its `done` comes OFF — starting work under a branch somebody called finished says the branch is not finished; the write lands and the answer's `nudge` names every mark it took off.",
  },
  todo: {
    title: "Mark todo",
    description:
      "Mark a node as work that has not started, or undo that with `undo: true`. Stored as `true` and not dated, and a date written here by hand would place the node nowhere: the journal reads a node's `date` and its `done` instant only, so `set_date` is what says which day a task is FOR. This is what makes a bullet a TASK: a node with no mark is not an unstarted task, it is not a task at all, so there is nothing to search for until someone says otherwise. Works on any node, children or not — a parent whose children are all notes is marked exactly like a leaf. IF AN ANCESTOR IS DONE, its `done` comes OFF — done-hiding would sweep this new task off the page with the branch, and a mark that has gone stale is not a reason to refuse work somebody is filing; the write lands and the answer's `nudge` names every mark it took off.",
  },
} as const satisfies Record<Status, { readonly title: string; readonly description: string }>

/** One tool per mark, keyed by the format's own list: written out one by one,
 *  a mark could be plannable, writable and derivable everywhere and still have
 *  no way for an agent to set it, silently. Keyed, that is a missing key. */
const MARK_TOOLS: ReadonlyArray<Tool> = MARKS.map((mark) =>
  write(
    `set_${mark}`,
    MARK_TOOL[mark].title,
    MARK_TOOL[mark].description,
    MarkRequest,
    { op: mark },
  )
)

export const TOOLS: ReadonlyArray<Tool> = [
  read(
    "list_outlines",
    "List outlines",
    "Every outline under the served directory, with its top-level titles and how many nodes it holds. Start here: it is the map.\n\nTWO FILENAMES IN IT MEAN SOMETHING, both by name and neither by any field. An `Archive.olai` holds what was put away (`unarchive_node` is the way back out). An `Inbox.olai` is where a line goes when nobody named a place for it: capture into whichever outline is called that — case-insensitively, shallowest first, then path order, so a directory keeping `notes/inbox.olai` gets its own file rather than a second one — and when this list holds none, `create_outline` an `Inbox.olai` at the ROOT, seeded with the line. The web's ⌘K `+` resolves exactly that; doing it by hand here is the same two moves and lands in the same file.",
    NoArgs,
    OutlineAnswer,
    (asking) => asking.outlines,
  ),
  read(
    "search_nodes",
    "Search nodes",
    "Find nodes by title, id, `#tag` or note — and by what they ARE, with the operators `text` documents (`is:`, `has:`, `date:`, `prop:`, and `-` to negate). `prop:` searches a node's custom properties: `prop:pr` finds every node carrying that key, `prop:agent=claude-opus` every node whose value is that. Results carry `file:line`, its ancestor titles and — for a node that is MARKED — that mark, so a hit can be acted on without reading the file. A node with no `status` is a bullet rather than an unstarted task. A hit also carries the edges the node itself writes, when it has any: `see` (free cross-references) and `after` (what it must come after), which are the ids `set_see` and `set_after` remove by. AND IT CARRIES `custom`, the whole map, uncut — so selecting by one property answers with the others beside it and \"every lane with `pr=…`\" or \"every node with `source=…`\" is THIS CALL, not this call and a `read_node` per hit. Absent for a node carrying no property. WHY a hit is there is TWO fields, because both can be true of one: `matched` says which field carried the WORDS, and is ABSENT for a query that named none (`is:done` on its own); `matchedProps` lists the custom keys a `prop:` clause selected the node on, in the node's OWN spelling (the query is case-folded, the map is not), and is ABSENT for a query that named no property. A NEGATED clause names nothing there — a node found by `-prop:agent` was not found ON `agent`, it carries no such key — so `matchedProps` is only ever keys the node really has, and reads straight into the `custom` map beside it.\n\nSCOPE IT when you know where to look: `file` is one outline, `under` is a node and everything beneath it. That is the same narrowing a person gets by filtering a zoomed page, which is why it is here — the two faces answer one question.",
    // `@olai/format`'s, and so is what comes back — ONE declaration behind the
    // JSON Schema this tool advertises and the wire shape the palette's
    // `search.nodes` procedure carries, so the two faces cannot ask for
    // different things or be told different ones. The operator prose above and
    // the per-field prose in that schema are the same grammar described from
    // the two ends a caller reads it from.
    SearchRequest,
    SearchAnswer,
    (asking, args: SearchRequest) => asking.search(args),
  ),
  read(
    "read_node",
    "Read a node",
    "One node in full: its record, its `custom` properties (the named facts `set_prop` writes), its tags (`#topic` and `@person`, reported as written), its ancestors, its immediate children, and its mark when it carries one — a node with no `status` is not a task. `progress` counts how many of its child tasks are done, which is an annotation and nothing more. Its edges come too when it has them — `see` and `after`, the ids `set_see` / `set_after` take.\n\nTHIS IS ALSO WHERE MIRRORS ARE FOUND, and it is the only place: a placement is not a node, so a search never returns one and `children` never lists one. Ask the node instead. `mirrors` is every placement OF this node — where else it is drawn, chains followed — and each entry's `id` is what `remove_mirror` takes, so a Now entry is retired by reading the ITEM that finished. `placed` is the other half: the placements UNDER this node, each with the node it shows — which is how you read a curated list (\"what is on Now?\") without knowing in advance what is on it.",
    NodeRequest,
    NodeAnswer,
    (asking, args: NodeRequest) => asking.node(args),
  ),
  read(
    "read_subtree",
    "Read a subtree",
    "A node and everything under it, nested. Says when it stopped at the depth it was given rather than at a leaf. Mirrors are not walked — a placement is a second view of a node rather than something hanging off this one — so read a list of them with `read_node`'s `placed`.",
    SubtreeRequest,
    SubtreeAnswer,
    (asking, args: SubtreeRequest) => asking.subtree(args),
  ),

  write(
    "create_outline",
    "Create an outline",
    "Start a new outline file under the served directory. `file` is a relative `.olai` path (no absolute paths, no `..`); refused if that file already exists. This is how a brand-new outline is born: `add_node` only writes into outlines that are already loaded.\n\nSEED IT WITH EVERYTHING YOU ALREADY KNOW. `seed` is a whole capture — the same fields and the same nested `children` `add_node` takes — so a new outline and the dozen nodes in it are ONE call: one validation, one atomic write, one commit. A seed that is refused anywhere in its tree leaves NO file behind, which is why this beats creating an empty outline and filling it afterwards (that way, a refused second call leaves an empty outline nobody asked for). Create without a `seed` only when you genuinely do not know yet what goes in it; `add_node` fills it later, and takes the same `children`.\n\nONE FILENAME IS A CONVENTION rather than a choice: `Inbox.olai` at the ROOT is where a captured line goes when the directory has no inbox yet (`list_outlines` says how to look for one first, and how a directory that keeps its own elsewhere is found). Seed it with the line — one call, so a refused capture leaves no empty inbox behind.",
    CreateRequest,
    { op: "create" },
  ),
  write(
    "add_node",
    "Add a node",
    "Capture a new node, and — with `children` — everything under it. Give `parent` to put it under a node, or `file` to put it at the top level of an *existing* outline. It goes last among its siblings unless `before` or `after` names one. To start a brand-new outline file, use `create_outline` — whose `seed` takes this same shape, so a new outline and its contents are one call.\n\nUSE `children` WHENEVER YOU ALREADY KNOW MORE THAN ONE NODE — rooms and what is in them, a plan and its steps, a page of notes. Thirteen nodes is ONE call rather than thirteen: one validation, one atomic write, one commit, and nothing is written unless all of it is. The answer names every node it made in `captured` (id and title), which is how you mark, note or capture under one of them afterwards.\n\nWHEN NOBODY NAMED A PLACE — a line to keep, with no parent it obviously belongs under — the `file` is the directory's INBOX rather than whichever outline you read last. `list_outlines` says how to find it, and `create_outline` mints one when there is none.\n\nCAPTURING UNDER A FINISHED BRANCH IS NOT REFUSED. If what arrives carries a `todo` or `doing` mark anywhere in it and an ancestor is `done`, that ancestor's mark comes OFF — done-hiding would have swept the capture off the page — and the answer's `nudge` names every mark it took off. What IS refused is a capture that contradicts itself: a node born `done` with an unfinished task born under it in the same call.",
    AddRequest,
    { op: "add" },
  ),
  ...MARK_TOOLS,
  write(
    "set_title",
    "Retitle a node",
    "Replace a node's title. Inline tags live in the title — `#topic` and `@person` — so this is also how a tag is added or removed.",
    TitleRequest,
    { op: "title" },
  ),
  write(
    "set_desc",
    "Write a note",
    "Replace a node's note (markdown, stored verbatim). `null` removes it.",
    DescRequest,
    { op: "desc" },
  ),
  write(
    "set_date",
    "Schedule a node",
    "Set the node's ISO date, making it a scheduled node, or clear it with `null`.",
    DateRequest,
    { op: "date" },
  ),
  write(
    "set_prop",
    "Set a property",
    "Put a named FACT on a node — `set_prop {id, key, value}` — or take it off with `value: null`. Any key, holding any text: `pr`, `agent`, `stage`, `isbn`, `source`. Nothing gives a key a meaning and nothing parses the value; a URL is a string that looks like a URL.\n\nUSE IT FOR WHAT WOULD OTHERWISE BE PROSE NOBODY CAN QUERY. A note saying \"PR #176, running on claude-opus\" is a sentence every reader re-parses by eye; `pr` and `agent` as properties are the same two facts, and `search_nodes` finds every node carrying them (`prop:pr`, `prop:agent=claude-opus`). The note keeps the story — what was found, what was ruled, why — and the properties keep the facts.\n\nIT WRITES ONLY INSIDE `custom`, the record's one open field, and it structurally cannot touch anything else: a node's own facts are FIELDS, and those have their own verbs (`set_done`, `set_date`, `set_after`, `set_see`, `set_title`, `set_desc`). The one refusal here is about SHADOWING — a key spelled like a field the format already has (`done`, `doing`, `todo`, `status`, `date`, `see`, `after`, `id`, `title`, `created`, `changed`) is turned toward the verb that writes that fact, because a node saying `done` twice with two meanings is a node no reader can trust.\n\n`read_node` answers `custom`, so read before you overwrite: this replaces one key's value outright.",
    PropRequest,
    { op: "prop" },
  ),
  write(
    "move_node",
    "Move a node",
    "Reparent or reorder a node within its outline. `parent: null` puts it at top level; `before` / `after` place it among its new siblings. Outlines are independent trees, so this never crosses files — archiving is what does. Landing a subtree that holds an unfinished task under a `done` ancestor takes that ancestor's mark OFF, as `set_todo` does: the answer's `nudge` names what it re-opened.",
    MoveRequest,
    { op: "move" },
  ),
  write(
    "split_node",
    "Split a node in two",
    "Cut one node into two siblings: `title` is what it KEEPS, `rest` is what comes off it as a brand-new node placed immediately after it. One op — one validation and one atomic write — because a `set_title` followed by an `add_node` can half-land, and both halves of the half are wrong: the tail written over an untouched head duplicates the sentence, and a truncated head with a refused tail loses what came off it.\n\nTWO TITLES, NEVER AN OFFSET. Nothing here names a character position — a position re-planned against a newer snapshot would cut somebody else's retitle in half, and no write in this table names a range into a field.\n\nEverything that DESCRIBED the node stays with the head: its children, note, mark, date and edges. The new node is born a bullet — no mark, so it is not an unstarted task until someone says so — and the answer's `id` names it. `merge_node` on that id is the exact inverse.",
    SplitRequest,
    { op: "split" },
  ),
  write(
    "merge_node",
    "Merge a node into the one above",
    "Join a node into the sibling ABOVE it: the titles are concatenated with nothing between them, the notes are joined one blank line apart, the children move to the end of that sibling's own — and the merged node's record goes to `Archive.olai` keeping its id. One op, because a retitle plus N reparentings plus an archive can stop in the middle and leave the outline saying something nobody wrote.\n\nTHE ROW ABOVE IS NOT AN ARGUMENT: which sibling that is is a fact about the set, read where the write is judged, so the request re-plans cleanly when something else writes first. Refused when the node is first among its siblings (there is nothing above it) or when the row above is a MIRROR (a placement has no title to merge into).\n\nWHAT DOES NOT SURVIVE ON THE PAGE: the merged node's mark, date and edges. The format allows one mark per node and the survivor already has its own answer, so they go with the record into the archive — nothing is destroyed, `unarchive_node` brings it back with its id, and the answer's `nudge` says so whenever there was anything to say. The adopted children ARRIVE under that sibling, so if any of them is unfinished work and the sibling (or something above it) is `done`, that mark comes off — the same rule `set_todo` and `move_node` follow, and the `nudge` names it.",
    MergeRequest,
    { op: "merge" },
  ),
  write(
    "archive_node",
    "Archive a subtree",
    "Move a node and everything under it into `Archive.olai` beside its outline, re-creating the chain of ancestor titles it hung off. Ids move with the nodes, so mirrors and edges pointing at them keep resolving. Nothing is stamped: archiving is not finishing. `unarchive_node` is the way back.",
    ArchiveRequest,
    { op: "archive" },
  ),
  write(
    "unarchive_node",
    "Unarchive a subtree",
    "Take a node and everything under it back OUT of an `Archive.olai` — the inverse of `archive_node`. The subtree comes back intact with its ids, and it lands LAST among its new siblings (the archive does not record where in a row a node sat). Where it lands: by default the chain of ancestor titles the archive recorded above the node is matched against the live outlines beside the archive, and the call is refused — naming what it found — when that chain matches nowhere or more than one place; give `parent` (it goes under that node) or `file` (top level of that outline) to decide instead. An ancestor the removal leaves empty in the archive is tidied away, provided it is the bare title scaffold `archive_node` wrote and nothing still names it. Work in an archive is over, so nothing in one is unfinished — that exemption ends here: a subtree holding a `todo` or `doing` that comes back under a `done` ancestor takes that ancestor's mark off, and the answer's `nudge` says so.",
    UnarchiveRequest,
    { op: "unarchive" },
  ),
  write(
    "set_see",
    "Set see references",
    "Add and/or remove free cross-references (`see`) on an existing node. `see` is a link and nothing more — no ordering, no blocking, cycles fine. Give `add` and/or `remove` (ids of targets in the loaded set); an unknown add is refused with the closest id that exists. Search and node reads carry a node's `see` so you can traverse what is already there. For \"this cannot start until that is done\", use `set_after` instead — that one is the ordering graph.",
    SeeRequest,
    { op: "see" },
  ),
  write(
    "set_after",
    "Set what a node waits on",
    "Add and/or remove `after` edges on an existing node: the ids it must come AFTER. This is how a DEPENDENCY is written — `set_after(id: \"install\", add: [\"order\"])` says installing waits on ordering, and olai then draws `install` as blocked while `order` is an unfinished task. Say it from the waiting node: `a blocks b` is spelled as `b after a`, and the ops layer writes the arrow one way. A target with no mark blocks nothing (a bullet is not work — mark the node, or its branch, with `set_todo`/`set_doing`). Unknown adds are refused with the closest id that exists, and an add that would close a loop is refused NAMING the loop, because nothing in a cycle could ever start first. Node reads carry a node's `after` so you can see what is already there before changing it.",
    AfterRequest,
    { op: "after" },
  ),
  write(
    "add_mirror",
    "Place a mirror",
    "Show a node that already exists in a SECOND place, without moving or copying it. The record written is a placement — `{id, parent, ord, mirror}` and nothing else — so the mirror has no title, no mark and no note of its own: it draws its target's, wherever the target lives, and edits go on landing at the target. It may cross outlines (a `parent` is same-file, a mirror is how a node appears in another file at all), and its target may itself be a mirror.\n\nTHIS IS HOW A CURATED LIST IS BUILT — a Now/Focus section is mirrors of the items that are live, so the entry and the item can never drift apart the way a re-typed copy does. Place it with `parent` (under a node) or `file` (top level of an outline), `before`/`after` among the siblings there; give `id` to keep a naming convention (`now-<item>`), or let it be minted — the answer's `id` names the placement either way, and that is what retires it. Refused if the placement would sit inside the subtree it shows, which would expand forever.",
    MirrorRequest,
    { op: "mirror" },
  ),
  write(
    "remove_mirror",
    "Retire a mirror",
    "Take one placement out. `id` is the MIRROR's own id — the placement — never the id of the node it shows: what goes is that one line, and the node keeps its title, its mark, its children, its own place in the outline that defines it, and every other placement of it. So this is what retires a finished item from a Now list without touching the work: nothing is archived, nothing is deleted, nothing is unsaid. Find the id with `read_node`: `mirrors` on the finished ITEM says where it is placed, and `placed` on the LIST says what is on it. Refused on the id of a regular node (`archive_node` is what puts a node and its subtree away), and refused while anything still names the placement — another mirror chained onto it, or an edge written at it — naming what to re-point first.",
    UnmirrorRequest,
    { op: "unmirror" },
  ),

  write(
    "create_document",
    "Create a document",
    "Start a new `.md` document under the served directory. `file` is a relative `.md` path (no absolute paths, no `..`); refused if that document already exists — `write_document` is what edits one, and the split is what keeps a typo from minting a file. `text` is what it is born holding; absent creates it empty. The new document joins the set on the write's own revision, so the sidebar and every open tab see it immediately, and the write lands and waits for `commit` like any other.\n\nWHERE IT GOES IS A CONVENTION YOU READ, NOT ONE YOU PICK. This directory is somebody's vault and it already has a shape: look at `surface://collections/documents` before choosing a path, and put the new file where its neighbours are. That matters most for a DAY'S NOTE, whose name is the whole of what makes it one (a basename that is exactly an ISO date, `2026-08-13.md`): a vault keeping `Daily/2026/08/2026-08-12.md` wants `Daily/2026/08/2026-08-13.md`, and the same file at the root is a second convention nobody asked for. The web's calendar derives exactly that from the newest existing daily note; there is no separate op for it because the answer is a path, and this is the tool that takes one.",
    CreateDocumentRequest,
    { op: "create-doc" },
  ),
  write(
    "write_document",
    "Write a document",
    "Replace a document's text, whole and verbatim. `file` names a `.md` the set already holds (refused with the closest path otherwise); `text` is the entire new content — markdown, stored exactly as given, interpreted only at view time, never validated. Read the document first (`surface://collections/documents/<path>`) and pass what you read as `was` to make the write CONDITIONAL: if the file has changed since — another editor, a `git pull` — the write is refused instead of landing on top of words you have not seen, and the answer says to read again. Omit `was` only when overwriting whatever is there is what you mean. The write lands on disk, reaches every open page on its own revision, and waits for `commit`.",
    WriteDocumentRequest,
    { op: "doc" },
  ),

  act(
    "commit",
    "Commit what you changed",
    "Record what is waiting in the repository as one git commit — the audit trail of what this tool wrote. Writes land on disk immediately and WAIT for this; nothing commits on your behalf. Call it when a train of thought is finished, not after every edit, and give `message` saying what the work was (`reconcile the roadmap with the #70-#81 merges`) — an omitted one is composed from what changed, which can only describe the edits and not why you made them.\n\nIT SWEEPS THE WHOLE REPOSITORY, not only the outlines: every file that differs from HEAD, including a `.md` or a source file a person edited by hand, and including anything untracked that `.gitignore` does not cover. Read `surface://cells/pending` first to see exactly what that is — `outlines` with their node-level changes, `others` as paths with a status each, and `served` saying which part of the repository olai serves. Give `paths` (repository-root-relative, as `pending` lists them) to commit only some of it; what you leave out stays waiting for a commit and a message of its own. A path nothing is waiting on is refused rather than quietly skipped. A row that says `renamed` names both halves in `from`, and it is ONE path to give — the commit carries the side it came from with it.\n\nIt never touches git's index, so anything staged by hand is left exactly as it was, and it refuses while the repository is mid-merge, mid-rebase or on a detached HEAD.",
    CommitRequestSchema,
    (ops, args: CommitRequest) => ops.commit(args),
  ),

  act(
    "push",
    "Push what is recorded",
    "Send the current branch to the upstream it already tracks. One verb and no arguments: no remote to pick, no refspec, never a force, and nothing that resolves a divergence — `surface://cells/pending` carries `unpushed` (the upstream's name and how many commits it is missing), and that is what this sends. Answers `NothingToPush` for a branch already in sync, and hands back git's own words verbatim when it refuses: authentication, a non-fast-forward, a branch with no upstream at all. Those are the terminal's business to resolve; report what git said rather than retrying.",
    NoArgs,
    (ops) => ops.push,
  ),
]
