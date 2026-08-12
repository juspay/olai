/**
 * The tool surface: everything an agent may do to a served directory, and
 * nothing else.
 *
 * This is a CLOSED list, and what is missing from it is the design. There is no
 * file read, no file write, no directory listing, no shell and no grep — the
 * agent cannot name a byte, only a node. Two consequences follow, and both were
 * paid for:
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

import { Schema } from "effect"

import {
  type CommitRequest,
  CommitRequest as CommitRequestSchema,
  type CommitResult,
  type Derived,
  MARKS,
  type OutlineSet,
  type Status,
  type Writer,
} from "@olai/format"
import type { Effect } from "effect"

import * as Query from "./query.ts"
import {
  AddRequest,
  AfterRequest,
  ArchiveRequest,
  CreateRequest,
  DateRequest,
  DescRequest,
  MarkRequest,
  MirrorRequest,
  MoveRequest,
  SeeRequest,
  TitleRequest,
  UnmirrorRequest,
} from "./request.ts"

/** The set as a reader sees it: the files that were found, and the derivations
 *  every answer is computed from. One value, so a run of queries walks the tree
 *  once ({@link ./query.ts}). */
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

/** The half of the ops layer a self-answering tool reaches. Named as an
 *  argument rather than imported as the whole `Ops`, so the table below stays a
 *  declaration of tools rather than a consumer of the writer. */
export interface Acting {
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
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
    readonly read: (at: Reading, args: never) => unknown
  })
  | (Described & {
    readonly kind: "write"
    readonly fixed: Readonly<Record<string, unknown>>
  })
  | (Described & {
    readonly kind: "act"
    readonly act: (
      ops: Acting,
      args: never,
      writer: Writer,
    ) => Effect.Effect<unknown, never>
  })

// ── reading ────────────────────────────────────────────────────────────

const SearchArgs = Schema.Struct({
  text: Schema.String.annotate({
    description:
      "Words to look for. Case-folded substrings, no operators: every word must appear somewhere in the same node.",
  }),
  limit: Schema.optionalKey(
    Schema.Number.annotate({
      description: "How many hits to return. Default 12; the total is reported either way.",
    }),
  ),
})

const NodeArgs = Schema.Struct({
  id: Schema.String.annotate({ description: "The node's `id`." }),
})

const SubtreeArgs = Schema.Struct({
  id: Schema.String.annotate({ description: "The node to read from." }),
  depth: Schema.optionalKey(
    Schema.Number.annotate({
      description: "How many levels of children to include. Default 3.",
    }),
  ),
})

const NoArgs = Schema.Struct({})

// ── the list ───────────────────────────────────────────────────────────

const read = <A>(
  name: string,
  title: string,
  description: string,
  schema: Schema.Codec<A, never, never, never> | Schema.Top,
  reader: (at: Reading, args: A) => unknown,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "read",
  read: reader as (at: Reading, args: never) => unknown,
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
  answer: (ops: Acting, args: A, writer: Writer) => Effect.Effect<unknown, never>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "act",
  act: answer as (ops: Acting, args: never, writer: Writer) => Effect.Effect<unknown, never>,
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
      "Mark a node done, or undo that with `undo: true`. The mark RECORDS THE INSTANT it is made — a local ISO datetime with this machine's UTC offset, written for you — so the node appears on that day's journal page; there is no way here to write a bare `true` or to choose the day, and `set_date` is what schedules a node for one. Works on any node, children or not — a mark is a stored fact, never computed from what hangs below. Done-hidden hides a done node WITH its subtree, so this is a claim about the whole branch; marking one over unfinished tasks is allowed and comes back with a `nudge` saying so.",
  },
  doing: {
    title: "Mark doing",
    description:
      "Mark a node as under way, or undo that with `undo: true`. Stored as `true` and not dated, and a date written here by hand would place the node nowhere: the journal reads a node's `date` and its `done` instant only, because the day work was picked up is a fact about the task rather than about the day. A node that is already done must be un-done first. Works on any node, children or not.",
  },
  todo: {
    title: "Mark todo",
    description:
      "Mark a node as work that has not started, or undo that with `undo: true`. Stored as `true` and not dated, and a date written here by hand would place the node nowhere: the journal reads a node's `date` and its `done` instant only, so `set_date` is what says which day a task is FOR. This is what makes a bullet a TASK: a node with no mark is not an unstarted task, it is not a task at all, so there is nothing to search for until someone says otherwise. Works on any node, children or not — a parent whose children are all notes is marked exactly like a leaf.",
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
    "Every outline under the served directory, with its top-level titles and how many nodes it holds. Start here: it is the map.",
    NoArgs,
    (at) => ({ outlines: Query.outlines(at.set, at.derived) }),
  ),
  read(
    "search_nodes",
    "Search nodes",
    "Find nodes by title, id, `#tag` or note. Results carry `file:line`, its ancestor titles and — for a node that is MARKED — that mark, so a hit can be acted on without reading the file. A node with no `status` is a bullet rather than an unstarted task.",
    SearchArgs,
    (at, args: typeof SearchArgs.Type) => Query.search(at.derived, args),
  ),
  read(
    "read_node",
    "Read a node",
    "One node in full: its record, its `#tags`, its ancestors, its immediate children, and its mark when it carries one — a node with no `status` is not a task. `progress` counts how many of its child tasks are done, which is an annotation and nothing more.",
    NodeArgs,
    (at, args: typeof NodeArgs.Type) =>
      Query.detail(at.derived, args.id) ?? { missing: args.id },
  ),
  read(
    "read_subtree",
    "Read a subtree",
    "A node and everything under it, nested. Says when it stopped at the depth it was given rather than at a leaf.",
    SubtreeArgs,
    (at, args: typeof SubtreeArgs.Type) =>
      Query.subtree(
        at.derived,
        args.id,
        args.depth === undefined ? {} : { depth: args.depth },
      ) ?? { missing: args.id },
  ),

  write(
    "create_outline",
    "Create an outline",
    "Start a new outline file under the served directory. `file` is a relative `.jsonl` path (no absolute paths, no `..`); refused if that file already exists. This is how a brand-new outline is born: `add_node` only writes into outlines that are already loaded.\n\nSEED IT WITH EVERYTHING YOU ALREADY KNOW. `seed` is a whole capture — the same fields and the same nested `children` `add_node` takes — so a new outline and the dozen nodes in it are ONE call: one validation, one atomic write, one commit. A seed that is refused anywhere in its tree leaves NO file behind, which is why this beats creating an empty outline and filling it afterwards (that way, a refused second call leaves an empty outline nobody asked for). Create without a `seed` only when you genuinely do not know yet what goes in it; `add_node` fills it later, and takes the same `children`.",
    CreateRequest,
    { op: "create" },
  ),
  write(
    "add_node",
    "Add a node",
    "Capture a new node, and — with `children` — everything under it. Give `parent` to put it under a node, or `file` to put it at the top level of an *existing* outline. It goes last among its siblings unless `before` or `after` names one. To start a brand-new outline file, use `create_outline` — whose `seed` takes this same shape, so a new outline and its contents are one call.\n\nUSE `children` WHENEVER YOU ALREADY KNOW MORE THAN ONE NODE — rooms and what is in them, a plan and its steps, a page of notes. Thirteen nodes is ONE call rather than thirteen: one validation, one atomic write, one commit, and nothing is written unless all of it is. The answer names every node it made in `captured` (id and title), which is how you mark, note or capture under one of them afterwards.",
    AddRequest,
    { op: "add" },
  ),
  ...MARK_TOOLS,
  write(
    "set_title",
    "Retitle a node",
    "Replace a node's title. Inline `#tags` live in the title, so this is also how a tag is added or removed.",
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
    "move_node",
    "Move a node",
    "Reparent or reorder a node within its outline. `parent: null` puts it at top level; `before` / `after` place it among its new siblings. Outlines are independent trees, so this never crosses files — archiving is what does.",
    MoveRequest,
    { op: "move" },
  ),
  write(
    "archive_node",
    "Archive a subtree",
    "Move a node and everything under it into `Archive.jsonl` beside its outline, re-creating the chain of ancestor titles it hung off. Ids move with the nodes, so mirrors and edges pointing at them keep resolving. Nothing is stamped: archiving is not finishing.",
    ArchiveRequest,
    { op: "archive" },
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
    "Take one placement out. `id` is the MIRROR's own id — the placement — never the id of the node it shows: what goes is that one line, and the node keeps its title, its mark, its children, its own place in the outline that defines it, and every other placement of it. So this is what retires a finished item from a Now list without touching the work: nothing is archived, nothing is deleted, nothing is unsaid. Refused on the id of a regular node — `archive_node` is what puts a node and its subtree away.",
    UnmirrorRequest,
    { op: "unmirror" },
  ),

  act(
    "commit",
    "Commit what you changed",
    "Record the outline edits waiting in the served directory as one git commit — the audit trail of what this tool wrote. Writes land on disk immediately and WAIT for this; nothing commits on your behalf. Call it when a train of thought is finished, not after every edit, and give `message` saying what the work was (`reconcile the roadmap with the #70-#81 merges`) — an omitted one is composed from what changed, which can only describe the edits and not why you made them. It commits every outline that differs from HEAD, including any a person edited by hand, and refuses while the repository is mid-merge, mid-rebase or on a detached HEAD.",
    CommitRequestSchema,
    (ops, args: CommitRequest, writer) => ops.commit(args, writer),
  ),
]

export const toolNamed = (name: string): Tool | undefined =>
  TOOLS.find((tool) => tool.name === name)
