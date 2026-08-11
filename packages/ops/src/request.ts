/**
 * The things a writer may ask for.
 *
 * They are SEMANTIC — "mark this node done", "start a new outline" — not
 * "replace bytes 40 through 90" — and that is the property the whole write path
 * is built on. A semantic edit can be re-derived from a newer snapshot when the
 * store has moved ({@link ./ops.ts}'s retry), and it cannot express a broken
 * file: there is no request here whose result is not a set of whole records.
 *
 * Schemas rather than interfaces because these are the payloads a tool call
 * arrives as. One declaration is the type the planner switches on, the JSON
 * Schema the MCP tool advertises ({@link ./mcp.ts}) and the decoder that
 * refuses a malformed call — three uses that would otherwise be three lists of
 * field names kept in step by hand.
 */

import { MARKS } from "@olai/format"
import { Schema } from "effect"

/** An id the request names. Spelled once so every op's `id` field carries the
 *  same description into the tool schemas. */
const Id = Schema.String.annotate({
  description: "The `id` of a node in the loaded set.",
})

const Title = Schema.String.annotate({
  description: "The node's title, verbatim. Inline `#tags` live here.",
})

/**
 * Where a node goes among its siblings. Absent is "last", which is what a
 * capture wants; `before`/`after` name a sibling, which is what a reorder
 * wants. A struct rather than two loose fields so "both at once" is one check
 * in one place.
 */
const Placement = {
  before: Schema.optionalKey(
    Schema.String.annotate({
      description: "Place it immediately before this sibling id.",
    }),
  ),
  after: Schema.optionalKey(
    Schema.String.annotate({
      description: "Place it immediately after this sibling id.",
    }),
  ),
}

export const AddRequest = Schema.Struct({
  op: Schema.Literal("add"),
  /** The outline to write into. Required only when there is no `parent`: with
   *  one, the file is wherever the parent lives, and a second answer could
   *  disagree with it. */
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to add to, relative to the served directory. Required when `parent` is absent; ignored when it is present (the node goes in its parent's file).",
    }),
  ),
  parent: Schema.optionalKey(
    Schema.String.annotate({
      description: "Id of the parent node. Absent puts the node at top level.",
    }),
  ),
  title: Title,
  desc: Schema.optionalKey(
    Schema.String.annotate({ description: "The note. Markdown, stored verbatim." }),
  ),
  date: Schema.optionalKey(
    Schema.String.annotate({
      description: "ISO date (`2026-08-10`) or datetime, making this a scheduled node.",
    }),
  ),
  /** A chosen slug. Absent mints one — which is the usual case; supply one
   *  when the node needs a name a person will type. */
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id (`[A-Za-z0-9_-]+`), unique across the set. Absent mints one.",
    }),
  ),
  ...Placement,
})

/** The marks are one op: same resolver, same refusals, and the format's own
 *  exclusion rule means setting any of them clears the others. The op names
 *  ARE the format's mark names, read from it rather than re-listed — a fourth
 *  mark should not be writable everywhere except here. */
export const MarkRequest = Schema.Struct({
  op: Schema.Literals(MARKS),
  id: Id,
  /** Take the mark off instead of putting it on. */
  undo: Schema.optionalKey(Schema.Boolean),
})

export const TitleRequest = Schema.Struct({
  op: Schema.Literal("title"),
  id: Id,
  title: Title,
})

export const DescRequest = Schema.Struct({
  op: Schema.Literal("desc"),
  id: Id,
  /** `null` removes the note. */
  desc: Schema.NullOr(Schema.String),
})

export const DateRequest = Schema.Struct({
  op: Schema.Literal("date"),
  id: Id,
  /** `null` clears it. */
  date: Schema.NullOr(Schema.String),
})

export const MoveRequest = Schema.Struct({
  op: Schema.Literal("move"),
  id: Id,
  /** The new parent, or `null` for top level. ABSENT leaves the parent alone,
   *  which is how a pure reorder is spelled. `parent` is same-file by the
   *  format, so a move never crosses outlines — archiving is what does. */
  parent: Schema.optionalKey(Schema.NullOr(Schema.String)),
  ...Placement,
})

export const ArchiveRequest = Schema.Struct({
  op: Schema.Literal("archive"),
  id: Id,
})

/** The optional first node of a brand-new outline. Same fields a capture under
 *  an existing file mints — title, optional note/date/id — without a parent
 *  (it is top-level by definition) and without placement (it is the only row). */
const Seed = Schema.Struct({
  title: Title,
  desc: Schema.optionalKey(
    Schema.String.annotate({ description: "The note. Markdown, stored verbatim." }),
  ),
  date: Schema.optionalKey(
    Schema.String.annotate({
      description: "ISO date (`2026-08-10`) or datetime, making this a scheduled node.",
    }),
  ),
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id (`[A-Za-z0-9_-]+`), unique across the set. Absent mints one.",
    }),
  ),
})

export const CreateRequest = Schema.Struct({
  op: Schema.Literal("create"),
  file: Schema.String.annotate({
    description:
      "Relative path of the new outline under the served directory. Must end in " +
      "`.jsonl`. No absolute path, no `..` / `.` segments, no separators inside a " +
      "segment. Refused if that file already exists among the loaded outlines.",
  }),
  seed: Schema.optionalKey(
    Seed.annotate({
      description:
        "Optional first node. Same shape a capture mints: a title, and optional " +
        "note, date and id. Absent leaves an empty outline the agent can fill with " +
        "`add_node`.",
    }),
  ),
})

/**
 * Add and/or remove `see` targets on an existing node. Incremental rather
 * than a whole-array replace: an agent that has just discovered one reference
 * should not have to re-state every other one it already set. Both fields are
 * optional, but at least one target must be named — the planner refuses a
 * no-op with a teaching message.
 */
export const SeeRequest = Schema.Struct({
  op: Schema.Literal("see"),
  id: Id,
  add: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to add to this node's `see` list. Each must name a node in the loaded set; unknowns are refused with the ids that do exist.",
    }),
  ),
  remove: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to drop from this node's `see` list. Naming one that is not there is a no-op for that id.",
    }),
  ),
})

export const Request = Schema.Union([
  AddRequest,
  MarkRequest,
  TitleRequest,
  DescRequest,
  DateRequest,
  MoveRequest,
  ArchiveRequest,
  CreateRequest,
  SeeRequest,
])
export type Request = typeof Request.Type

/** What an op that succeeded says. The node it was about, where that node
 *  lives NOW (archiving moves it), and the one-line summary that becomes both
 *  the git commit subject and the tool's reply. */
export interface Applied {
  readonly id: string
  readonly title: string
  readonly file: string
  readonly summary: string
  /** The store revision this write produced. */
  readonly rev: number
  /** Whether the write was committed to git. `false` when the directory is not
   *  a work tree, when the server was started with the opt-out, or when git
   *  itself refused — the write landed either way. */
  readonly committed: boolean
}
