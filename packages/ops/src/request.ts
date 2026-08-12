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
const Anchor = {
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

/**
 * What a capture may say about ONE node.
 *
 * Declared once because it is asked twice, and the two answers must not differ:
 * `add_node` names a node with these fields, and every node hanging off its
 * `children` is described with exactly the same ones. A child that could carry
 * less than the node above it would make "capture this subtree" mean something
 * different depending on where in the subtree you stood.
 */
const CAPTURE = {
  title: Title,
  desc: Schema.optionalKey(
    Schema.String.annotate({ description: "The note. Markdown, stored verbatim." }),
  ),
  date: Schema.optionalKey(
    Schema.String.annotate({
      description: "ISO date (`2026-08-10`) or datetime, making this a scheduled node.",
    }),
  ),
  /** The mark this node is born with, if any. One field rather than three
   *  booleans: the format allows AT MOST ONE mark, and a shape that can spell
   *  two is a shape a caller can get wrong. */
  mark: Schema.optionalKey(
    Schema.Literals(MARKS).annotate({
      description:
        "The mark this node is born with, written exactly as `set_done` / `set_doing` / `set_todo` would: `done` records the instant, so it lands on today's page; the other two store `true` and place it on no day. Absent leaves a bullet, which is not an unstarted task.",
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
} as const

/**
 * One node of a capture, and the tree hanging off it.
 *
 * The fields come from {@link CAPTURE} rather than from a second list of names
 * beside it — a hand-written copy would be a field this type has and the schema
 * does not, silently, the day somebody adds one. What is written by hand is the
 * one thing the schema cannot say: `children` is genuinely recursive, and
 * {@link NESTING} bounds the SCHEMA rather than the idea.
 */
type CaptureFields = Schema.Struct<typeof CAPTURE>["Type"]

export interface Capture extends CaptureFields {
  readonly children?: ReadonlyArray<Capture>
}

/** The same fields with their descriptions taken off, for every level BELOW the
 *  first ({@link childAt}). Derived rather than re-listed: a second field table
 *  is the drift {@link CAPTURE} exists to prevent, and the prose is the only
 *  thing that differs. */
const TERSE = Object.fromEntries(
  Object.entries(CAPTURE).map(([name, field]) => [
    name,
    field.annotate({ description: undefined }),
  ]),
) as unknown as typeof CAPTURE

/**
 * How many generations of `children` one call may nest below the node it adds.
 *
 * A CAP, and one this file would rather not have had: the format has no depth
 * limit, and nothing about planning a tree wants one. What has one is the JSON
 * Schema an MCP host reads. A recursive Effect schema compiles to a `$ref` into
 * a `$defs` pool — and the adapter that projects these schemas onto MCP INLINES
 * every local ref and STRIPS the pool, because `$ref` is rejected across the
 * host matrix it is byte-compatible with. A ref that cannot be inlined finitely
 * survives as a pointer into a pool that is no longer there, so `add_node`
 * would advertise a dangling reference and a whole tool would be unusable.
 *
 * So the nesting is unrolled, three levels of it, and the schema stays a finite
 * object an agent can actually read. Three is what the capture this was filed
 * for needs — an outline, its rooms, the things in them — and each further
 * level is another whole copy of the child schema in every `tools/list`. Deeper
 * than that is a second call under an id the first one hands back, which is why
 * the answer names every node it created.
 *
 * It lives HERE, beside the schema that unrolls it, and {@link ./plan.ts} reads
 * it to refuse what the floor below lets through. That is the planner enforcing
 * the schema's limit rather than one of its own, and it is the whole reason the
 * limit is a refusal rather than a truncation. The alternative — a recursive
 * schema here and an unrolled twin built in the MCP projection — is exactly the
 * pair that projection deleted when it stopped advertising one object and
 * decoding against another.
 */
export const NESTING = 3

/**
 * The `children` field of a node that may nest `below` further generations —
 * the ONE declaration of it, read by the request's own root and by every level
 * under it, so "how deep may this go" is counted one way everywhere.
 *
 * At the floor the field stays PRESENT and accepts anything, which is the whole
 * point of spelling it: an Effect struct silently DROPS a key it does not
 * declare, so a floor that simply omitted `children` would swallow the deepest
 * level of a capture and report success. The planner refuses it instead, by
 * name, with nothing written ({@link ./plan.ts}).
 */
const childrenOf = (below: number) =>
  Schema.optionalKey(
    below === 0
      // The one place the unrolled schema and the recursive interface disagree,
      // and it exists to be refused — so it is the one place a cast is needed.
      ? Schema.Array(Schema.Unknown).annotate({
        description:
          `A capture nests ${NESTING} levels of children and this node is at the last of them, so anything here refuses the whole call. Hang it off a second \`add_node\` instead, under an id from \`captured\`.`,
      }) as unknown as Schema.Codec<ReadonlyArray<Capture>>
      : Schema.Array(childAt(below - 1)).annotate({
        description:
          "Nodes to capture under this one, in this order. Each takes the same fields as this one, and may carry `children` of its own.",
      }),
  )

/**
 * The child schema, unrolled `below` further generations deep.
 *
 * The fields are {@link CAPTURE}'s with their prose taken off, and that is a
 * measured decision rather than a slip: the descriptions are identical at every
 * level, so spelling them four times would put three redundant copies of every
 * sentence in the first frame of every agent session (~2kB). The root says what
 * each field means, and the `children` blurb says a child takes the same ones.
 */
const childAt = (below: number): Schema.Codec<Capture> =>
  Schema.Struct({
    ...TERSE,
    children: childrenOf(below),
  }) as unknown as Schema.Codec<Capture>

/**
 * A capture as a CALL names it: the documented fields, and the subtree that may
 * hang off them.
 *
 * Both ops that bring nodes into being take exactly this — the node `add_node`
 * adds, and the first node a new outline is born with — so "what one call may
 * capture" has one spelling and one depth. A tool that could capture less than
 * the other would be a reason to make two calls where the point is to make one.
 */
const ROOT = { ...CAPTURE, children: childrenOf(NESTING) } as const

/**
 * Where a record a call brings into being LANDS: under a node, or at the top
 * level of an outline.
 *
 * One declaration for the two ops that create a record — `add_node` and
 * `add_mirror` — because the planner answers it with one function
 * ({@link ./plan.ts}'s `landsIn`) and two copies of the prose would be two
 * agent-facing descriptions of one rule, free to drift. Neither field says
 * "node" or "mirror": what lands is the caller's business, and where it lands
 * is this.
 */
const LANDING = {
  /** The outline to write into. Required only when there is no `parent`: with
   *  one, the file is wherever the parent lives, and a second answer could
   *  disagree with it. */
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to write into, relative to the served directory. Required when `parent` is absent; ignored when it is present (it goes in its parent's file).",
    }),
  ),
  parent: Schema.optionalKey(
    Schema.String.annotate({
      description: "Id of the node it goes under. Absent puts it at top level.",
    }),
  ),
} as const

export const AddRequest = Schema.Struct({
  op: Schema.Literal("add"),
  ...LANDING,
  /** The node, and the subtree under it. One call, one plan, one validation,
   *  one write, one commit — which is what makes a half-captured outline
   *  impossible. */
  ...ROOT,
  ...Anchor,
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

/**
 * What a text field is expected to hold before this write replaces it — the
 * one CONDITIONAL thing a request may say, and absent from every caller that
 * is simply typing.
 *
 * It exists because "put back what I replaced" is a narrower claim than "set
 * this": it is only entitled to overwrite the words it wrote. Absent, a write
 * is last-one-wins, which is what `set_title` has always meant and what a
 * person retyping a line means. Present, the planner refuses when the field
 * says something else — and it refuses on EVERY attempt, which is the whole
 * reason this lives here rather than in a caller: the write gate re-plans a
 * request when the store moves under it, so a check made once before the loop
 * is a check the retry does not make (found by review, 2026-08-12 — the retry
 * path silently overwrote a concurrent retitle).
 */
const Was = (what: string) =>
  `What this field is expected to hold right now. Absent overwrites whatever is ` +
  `there, which is the ordinary case. Supply it to make the write CONDITIONAL — ` +
  `${what} — and it is refused, naming what is there, if anything else has been ` +
  `written since you read it.`

export const TitleRequest = Schema.Struct({
  op: Schema.Literal("title"),
  id: Id,
  title: Title,
  was: Schema.optionalKey(
    Schema.String.annotate({
      description: Was("putting back a title you read a moment ago"),
    }),
  ),
})

export const DescRequest = Schema.Struct({
  op: Schema.Literal("desc"),
  id: Id,
  /** `null` removes the note. */
  desc: Schema.NullOr(Schema.String),
  /** `null` is a real answer here — "expects no note at all" — which is why
   *  the CHECK is on the field being present rather than on its content. */
  was: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: Was("putting back a note you read a moment ago; `null` expects none"),
    }),
  ),
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
  ...Anchor,
})

export const ArchiveRequest = Schema.Struct({
  op: Schema.Literal("archive"),
  id: Id,
})

/**
 * What a brand-new outline is born holding: a capture, exactly as `add_node`
 * takes one — the same fields, the same `children`, the same depth.
 *
 * No parent (it is top-level by definition) and no placement (it is the first
 * row of an empty file); everything else is {@link ROOT}, because a seed that
 * could say less would be a reason to make a second call, and the second call
 * is what this whole feature exists to delete. It is also what closes the last
 * hole in the atomicity claim: a `create` that lands followed by an `add` that
 * refuses left an empty outline behind, and now the file and everything in it
 * are one plan, one validation and one rename — a refused seed leaves no file
 * at all.
 */
const Seed = Schema.Struct(ROOT)

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
        "What the new outline is born holding — a capture, exactly as `add_node` takes " +
        "one: a title, optional note/date/mark/id, and `children` nesting the same " +
        "way. So a new outline and everything in it is ONE call, and a seed that is " +
        "refused leaves no file behind. Absent creates the outline empty.",
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
        "Ids to add to this node's `see` list. Each must name a node in the loaded set; an unknown one is refused with the closest id that exists.",
    }),
  ),
  remove: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to drop from this node's `see` list. Naming one that is not there is a no-op for that id.",
    }),
  ),
})

/**
 * A second PLACEMENT of a node that already exists.
 *
 * It takes what `add_node` takes minus everything that describes a node, and
 * that subtraction is the format's own: a mirror is exactly
 * `{id, parent?, ord, mirror}`, because any field describing the node itself has
 * an authoritative copy at the target and a second one here could only disagree
 * with it (docs/format.md's Two record shapes). So there is no `title` to give,
 * no `mark`, no `desc` — the schema cannot spell them, which is one fewer thing
 * the planner has to refuse.
 *
 * What is left is where the placement GOES, which is the same question
 * `add_node` answers: under a `parent`, or at the top level of a `file`, placed
 * among the siblings there by `before` / `after`.
 */
export const MirrorRequest = Schema.Struct({
  op: Schema.Literal("mirror"),
  target: Schema.String.annotate({
    description:
      "The `id` this mirror shows. Any node in the loaded set, in any outline — and it may itself be a mirror, in which case the chain is followed to the node at its end.",
  }),
  ...LANDING,
  /** The placement's OWN id — not the target's. Absent mints one; supply one
   *  when the placement itself needs a name a person will type, which is what
   *  a ledger convention like `now-<item>` is. */
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id for the PLACEMENT (`[A-Za-z0-9_-]+`), unique across the set — not the target's id. Absent mints one, and the answer's `id` names it either way.",
    }),
  ),
  ...Anchor,
})

/**
 * Retire one placement.
 *
 * `id` names the MIRROR record, never the node it shows: what goes is the line
 * that placed it, and the target is not touched. That is why this is its own op
 * rather than an arm of `archive` — see {@link ../../../packages/ops/README.md},
 * and the planner's own refusal for the id of a regular node.
 */
export const UnmirrorRequest = Schema.Struct({
  op: Schema.Literal("unmirror"),
  id: Schema.String.annotate({
    description:
      "The `id` of the MIRROR record — the placement — not of the node it shows.",
  }),
})

/**
 * Add and/or remove `after` edges on a node — what it must come after.
 *
 * {@link SeeRequest}'s shape exactly, because it is the same gesture over the
 * other kind of edge: incremental, so an agent that has just learned about one
 * dependency does not re-state the others, and at least one target must be
 * named. What differs is what the edges MEAN — `after` is the ordering graph, so
 * an add that would close a loop is refused (docs/format.md's Status) where a
 * `see` cycle is fine.
 */
export const AfterRequest = Schema.Struct({
  op: Schema.Literal("after"),
  id: Id,
  add: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids this node must come AFTER. Each must name a node in the loaded set; unknowns are refused with the closest id that exists, and an add that would close a loop is refused naming the loop.",
    }),
  ),
  remove: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to drop from this node's `after` list. Naming one that is not there is a no-op for that id.",
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
  MirrorRequest,
  UnmirrorRequest,
  AfterRequest,
])
export type Request = typeof Request.Type

/** One node a capture brought into being. The id matters most when nobody
 *  chose it: a minted id is unguessable, and a caller that just wrote thirteen
 *  nodes should not have to search for them.
 *
 *  Not `Query.Found`, which is what a READ answers with: that one carries
 *  `file:line` and an ancestor path, and a plan has neither — the file it
 *  describes has not been written, so a line number here would be invented. */
export interface Minted {
  readonly id: string
  readonly title: string
}

/** What an op that succeeded says. The node it was about, where that node
 *  lives NOW (archiving moves it), and the one-line summary that becomes both
 *  the git commit subject and the tool's reply. */
export interface Applied {
  readonly id: string
  readonly title: string
  readonly file: string
  readonly summary: string
  /** What the rollup noticed about a write that landed — the last task under a
   *  parent going done, a branch ticked over unfinished ones. Advice, carried
   *  back so an agent and a person both see it; absent when there is nothing
   *  to say, and never a reason a write did not happen. */
  readonly nudge?: string
  /** Every node this write brought into being, parent before child and siblings
   *  in the order they were given — id and title, so the caller can mark, note
   *  or capture UNDER one of them without a search for an id it never chose. A
   *  plain capture is a list of one; absent only when the op created no NODE,
   *  which is how the format spells an empty list everywhere else.
   *
   *  A placed mirror is absent from it, and that is the same word read
   *  strictly: `add_mirror` creates a placement of a node that already exists,
   *  not a node, and it has no title to report. `id` above names the placement
   *  it made, which is what `remove_mirror` takes. */
  readonly captured?: ReadonlyArray<Minted>
  /** The store revision this write produced. */
  readonly rev: number
  /**
   * Whether THIS WRITE was committed to git on its own.
   *
   * Only `--commit=auto` ever makes this true, and that mode exists for a
   * headless server with no browser to press anything. Under the default,
   * `manual`, a write lands on disk and waits: `false` here means "not yet",
   * and what is waiting is `pending` ({@link ./pending.ts}).
   */
  readonly committed: boolean
  /**
   * Why it was not, in one sentence. Absent when it was.
   *
   * The boolean above is four different pieces of news wearing one word, and
   * for a while the difference between them went only to the server log — where
   * somebody reading a browser can never see it, and where a person who knows
   * perfectly well that their notes are a git repository is left with a write
   * that quietly says `committed: false`. So the reason travels with the
   * answer: the agent reads it in its tool result, the panel draws it beside
   * the call, and nothing has to be inferred from a `false`.
   *
   * ADDITIVE and optional on purpose — a healthy commit says nothing, so
   * nothing that reads this reply had to change to keep working.
   */
  readonly why?: string
}
