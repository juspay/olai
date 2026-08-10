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
 * DERIVED from it ({@link ./mcp.ts}) rather than written beside it. That is the
 * same rule as everywhere else here: one declaration, several uses, no second
 * list of field names to keep in step.
 */

import { Schema } from "effect"

import {
  AddRequest,
  ArchiveRequest,
  DateRequest,
  DescRequest,
  MarkRequest,
  MoveRequest,
  TitleRequest,
} from "./request.ts"

/** A tool, as this package declares it. `fixed` is the part of the request the
 *  tool NAME already decides — `set_done` is `op: "done"` — so it never
 *  appears in the schema the agent fills in. */
export interface Tool {
  readonly name: string
  readonly title: string
  readonly description: string
  /** The schema the arguments are decoded against, once `fixed` is merged in. */
  readonly schema: Schema.Top
  readonly fixed: Readonly<Record<string, unknown>>
  /** Reads answer; writes change the directory and land in git. Kept as a flag
   *  because the two halves are described differently to the agent and counted
   *  differently by anything watching. */
  readonly writes: boolean
}

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

const read = (
  name: string,
  title: string,
  description: string,
  schema: Schema.Top,
): Tool => ({ name, title, description, schema, fixed: {}, writes: false })

const write = (
  name: string,
  title: string,
  description: string,
  schema: Schema.Top,
  fixed: Readonly<Record<string, unknown>> = {},
): Tool => ({ name, title, description, schema, fixed, writes: true })

export const TOOLS: ReadonlyArray<Tool> = [
  read(
    "list_outlines",
    "List outlines",
    "Every outline under the served directory, with its top-level titles and how many nodes it holds. Start here: it is the map.",
    NoArgs,
  ),
  read(
    "search_nodes",
    "Search nodes",
    "Find nodes by title, id, `#tag` or note. Results carry `file:line`, the node's derived status and its ancestor titles, so a hit can be acted on without reading the file.",
    SearchArgs,
  ),
  read(
    "read_node",
    "Read a node",
    "One node in full: its record, its `#tags`, its derived status, its ancestors and its immediate children.",
    NodeArgs,
  ),
  read(
    "read_subtree",
    "Read a subtree",
    "A node and everything under it, nested. Says when it stopped at the depth it was given rather than at a leaf.",
    SubtreeArgs,
  ),

  write(
    "add_node",
    "Add a node",
    "Capture a new node. Give `parent` to put it under a node, or `file` to put it at the top level of an outline. It goes last among its siblings unless `before` or `after` names one.",
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
