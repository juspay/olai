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
 *   - a refusal is structured. A `derived` write comes back with the unfinished
 *     children as data, which is what lets the agent do them one at a time and
 *     the chat panel draw them as rows.
 *
 * Each entry carries its request schema, and the JSON Schema an agent sees is
 * DERIVED from it ({@link ./mcp.ts}) rather than written beside it. A READ
 * carries its reader too, in the same entry — so a tool the table declares and
 * nothing answers is a type error rather than a runtime throw, which is what
 * the dispatch switch this replaced could only discover when somebody called
 * it. One declaration, several uses, no second list to keep in step.
 */

import { Schema } from "effect"

import type { Derived, OutlineSet } from "@olai/format"

import * as Query from "./query.ts"
import {
  AddRequest,
  ArchiveRequest,
  CreateRequest,
  DateRequest,
  DescRequest,
  MarkRequest,
  MoveRequest,
  TitleRequest,
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

/**
 * A tool, as this package declares it.
 *
 * The two arms are the two halves of the surface, and they differ in what they
 * carry rather than in a flag: a READ answers from a snapshot and says how; a
 * WRITE names the part of the request its own NAME already decides (`set_done`
 * is `op: "done"`), so that field never appears in the schema an agent fills in.
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
    "Find nodes by title, id, `#tag` or note. Results carry `file:line`, the node's derived status and its ancestor titles, so a hit can be acted on without reading the file.",
    SearchArgs,
    (at, args: typeof SearchArgs.Type) => Query.search(at.derived, args),
  ),
  read(
    "read_node",
    "Read a node",
    "One node in full: its record, its `#tags`, its derived status, its ancestors and its immediate children.",
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
    "Start a new outline file under the served directory. `file` is a relative `.jsonl` path (no absolute paths, no `..`); refused if that file already exists. Optionally pass `seed` with a title (and optional note/date/id) to mint the first node the way `add_node` does — otherwise the file is empty and further captures use `add_node` against it. This is how a brand-new outline is born: `add_node` only writes into outlines that are already loaded.",
    CreateRequest,
    { op: "create" },
  ),
  write(
    "add_node",
    "Add a node",
    "Capture a new node. Give `parent` to put it under a node, or `file` to put it at the top level of an *existing* outline. It goes last among its siblings unless `before` or `after` names one. To start a brand-new outline file, use `create_outline` first.",
    AddRequest,
    { op: "add" },
  ),
  write(
    "set_done",
    "Mark done",
    "Mark a node done, or undo that with `undo: true`. Refused for a node whose status is DERIVED from its children — the refusal lists the unfinished ones, which are what to mark instead.",
    MarkRequest,
    { op: "done" },
  ),
  write(
    "set_doing",
    "Mark doing",
    "Put a node in the state between open and done, or undo that with `undo: true`. A node that is already done must be un-done first.",
    MarkRequest,
    { op: "doing" },
  ),
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
]

export const toolNamed = (name: string): Tool | undefined =>
  TOOLS.find((tool) => tool.name === name)
