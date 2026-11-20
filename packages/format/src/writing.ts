import { Sort } from "./changes.ts"
import { Status } from "./node.ts"
import { REPEAT_GRAMMAR } from "./repeat.ts"
import { Schema } from "effect"

const Id = Schema.String.annotate({
  description: "The `id` of a node in the loaded set.",
})

const Title = Schema.String.annotate({
  description:
    "The node's title, verbatim. Inline tags live here — `#topic` and `@person`, two namespaces over the same alphabet. A relative link resolves beside the file this node lives in, not beside the reader; the answer names any link that lands on nothing served.",
})

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

const CAPTURE = {
  title: Title,
  desc: Schema.optionalKey(
    Schema.String.annotate({ description: "The note. Markdown, stored verbatim. A relative link resolves beside the file this node lives in, not beside the reader; the answer names any link that lands on nothing served." }),
  ),
  date: Schema.optionalKey(
    Schema.String.annotate({
      description: "ISO date (`2026-08-10`) or datetime, making this a scheduled node.",
    }),
  ),
  mark: Schema.optionalKey(
    Status.annotate({
      description:
        "The mark this node is born with, written exactly as `outlines_done` / `outlines_doing` / `outlines_todo` would: `done` records the instant, so it lands on today's page; the other two store `true` and place it on no day — and a `doing` birth also stamps `started`, exactly as `outlines_doing` stamps it, since work born under way has no later door for a start. Absent leaves a bullet, which is not an unstarted task.",
    }),
  ),
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id (`[A-Za-z0-9_-]+`), unique across the set. Absent mints one.",
    }),
  ),
  props: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.String).annotate({
      description:
        "Named facts this node is born with — the map `outlines_prop` writes into, several keys at once, with that verb's own refusals: for a key spelled like a field the format already has, and for a value that does not fit what its key DECLARES in `_olai/Properties.olai`. One bad value refuses the whole capture, children included, and nothing is written. A key holding an empty string is a key the file does not carry.",
    }),
  ),
  see: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Free cross-references this node is born with — `outlines_see`'s list. Each names a node in the loaded set OR another node in THIS capture, by a chosen `id`, wherever it sits in the tree and including one declared LATER. An unknown target refuses the whole capture, with the closest id that exists.",
    }),
  ),
  waitsOn: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "The ids this node must come AFTER — `outlines_after`'s edges, written at capture time. Same targets as `see`: a node in the loaded set, or one in this capture named by its chosen `id`, forward references included. Spelled `waitsOn` rather than `after` because at the top of a capture `after` already names the SIBLING this node is placed after. An edge that would close a loop is refused NAMING the loop.",
    }),
  ),
  after: Schema.optionalKey(
    Schema.Unknown.annotate({
      description:
        "NOT the edge list — write `waitsOn`. Anything here refuses the whole call, because `after` is the SIBLING anchor at the top of a capture and a child has no anchor.",
    }),
  ),
} as const

type CaptureFields = Schema.Struct<typeof CAPTURE>["Type"]

export interface Capture extends CaptureFields {
  readonly children?: ReadonlyArray<Capture>
}

const stripped = <F extends Schema.Struct.Fields>(fields: F): F =>
  Object.fromEntries(
    Object.entries(fields).map((
      [name, field],
    ) => [name, (field as Schema.Top).annotate({ description: undefined })]),
  ) as unknown as F

const TERSE = stripped(CAPTURE)

export const NESTING = 3

const childrenOf = (below: number) =>
  Schema.optionalKey(
    below === 0
      ? Schema.Array(Schema.Unknown).annotate({
        description:
          `A capture nests ${NESTING} levels of children and this node is at the last of them, so anything here refuses the whole call. Hang it off a second \`outlines_add\` instead, under an id from \`captured\`.`,
      }) as unknown as Schema.Codec<ReadonlyArray<Capture>>
      : Schema.Array(childAt(below - 1)).annotate({
        description:
          "Nodes to capture under this one, in this order. Each takes the same fields as this one, and may carry `children` of its own.",
      }),
  )

const childAt = (below: number): Schema.Codec<Capture> =>
  Schema.Struct({
    ...TERSE,
    after: CAPTURE.after,
    children: childrenOf(below),
  }) as unknown as Schema.Codec<Capture>

const ROOT = { ...CAPTURE, children: childrenOf(NESTING) } as const

const LANDING = {
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
  ...ROOT,
  ...Anchor,
})

export const MarkRequest = Schema.Struct({
  op: Status,
  id: Id,
  undo: Schema.optionalKey(Schema.Boolean),
})

const Was = (what: string) =>
  `What this field is expected to hold right now. Absent overwrites whatever is ` +
  `there, which is the ordinary case. Supply it to make the write CONDITIONAL — ` +
  `${what} — and it is refused, naming what is there, if anything else has been ` +
  `written since you read it.`

export const TitleRequest = Schema.Struct({
  op: Schema.Literal("title"),
  id: Id,
  title: Title,
  pinned: Schema.optionalKey(Schema.Literal(true)),
  was: Schema.optionalKey(
    Schema.String.annotate({
      description: Was("putting back a title you read a moment ago"),
    }),
  ),
})

export const DescRequest = Schema.Struct({
  op: Schema.Literal("desc"),
  id: Id,
  desc: Schema.NullOr(Schema.String).annotate({ description: "A relative link resolves beside the file this node lives in, not beside the reader; the answer names any link that lands on nothing served." }),
  was: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: Was("putting back a note you read a moment ago; `null` expects none"),
    }),
  ),
})

export const DateRequest = Schema.Struct({
  op: Schema.Literal("date"),
  id: Id,
  date: Schema.NullOr(Schema.String),
})

export const RepeatRequest = Schema.Struct({
  op: Schema.Literal("repeat"),
  id: Id,
  repeat: Schema.NullOr(Schema.String),
})

export const PropRequest = Schema.Struct({
  op: Schema.Literal("prop"),
  id: Id,
  key: Schema.String.annotate({
    description:
      "The property's name. Any key, except one spelled like a field the format already has (`done`, `doing`, `todo`, `status`, `date`, `see`, `after`, `id`, `title`, `created`, `changed`) — those are refused toward the verb that writes them.",
  }),
  value: Schema.NullOr(Schema.String).annotate({
    description:
      "What the property holds, as text. `null` removes it — and so does the empty string, since a key holding nothing is a key the file does not carry. A key the vault DECLARES in `_olai/Properties.olai` has a type, and a value that does not fit it is REFUSED with the values it may hold named: `merge` is one of its declared variants' ids, `records` is a whole number, `dispatched` is a date and nothing else — the commentary goes in the note. An accepted spelling is stored as the one canonical spelling (`2026-08-25 10:06` lands as the instant a mark records). Every other key is text and takes anything, as before.",
  }),
  was: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: Was(
        "putting back a property value you read a moment ago; `null` expects the key to be absent — which is what an add is",
      ),
    }),
  ),
})

export const MoveRequest = Schema.Struct({
  op: Schema.Literal("move"),
  id: Id,
  parent: Schema.optionalKey(Schema.NullOr(Schema.String)),
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to move it into, AT TOP LEVEL, relative to the served directory — the node and everything under it, every id kept. Absent leaves it in the outline it is already in. Ignored when `parent` is present (it goes in its parent's file).",
    }),
  ),
  ...Anchor,
})

export const SplitRequest = Schema.Struct({
  op: Schema.Literal("split"),
  id: Id,
  title: Schema.String.annotate({
    description:
      "What the node KEEPS — the first half of its title, verbatim. It goes on carrying its children, note, mark, date and edges.",
  }),
  rest: Schema.String.annotate({
    description:
      "What comes OFF it — the second half, verbatim, written as a brand-new node placed immediately after this one among its siblings (or as its FIRST CHILD with `under`). It is born a bullet: no mark, no note, no date, nothing under it.",
  }),
  under: Schema.optional(Schema.Boolean).annotate({
    description:
      "`true` makes the tail the head's FIRST CHILD instead of its next sibling — the reading a browser asks for when the head's children are on screen, so the line that comes off lands on the very next line a reader sees rather than below the whole subtree. Absent is the sibling.",
  }),
})

export const MergeRequest = Schema.Struct({
  op: Schema.Literal("merge"),
  id: Schema.String.annotate({
    description:
      "The `id` of the node to merge INTO THE ROW ABOVE IT — the sibling above, or its PARENT when it is first among its siblings, which is the line above it on the page either way. Its title is appended to that row's, its note joined to that row's, its children moved under it — and its own record goes to `_olai/Trash.olai`, keeping its id, mark, date and edges. Refused for a node with neither: the first of an outline's top-level rows.",
  }),
  title: Schema.optional(Schema.String).annotate({
    description:
      "What this node CONTRIBUTES to the join, verbatim — carried when what the caller is looking at is not the record's title: a title erased to nothing in the editor joins nothing, and the survivor's title stands. Absent is the record's own title — the reading every other caller keeps.",
  }),
})

export const TrashRequest = Schema.Struct({
  op: Schema.Literal("trash"),
  id: Id,
})

export const DuplicateRequest = Schema.Struct({
  op: Schema.Literal("duplicate"),
  id: Schema.String.annotate({
    description:
      "The `id` of the node to copy. The copy — it and everything under it, with fresh ids throughout — lands as the sibling immediately below it.",
  }),
})

export const UntrashRequest = Schema.Struct({
  op: Schema.Literal("untrash"),
  id: Schema.String.annotate({
    description:
      "The `id` of a node in an `_olai/Trash.olai`. It comes back out with everything under it.",
  }),
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to restore into, at top level. Ignored when `parent` is present. Absent (with no `parent`), the recorded chain of ancestor titles decides — refused, naming what it found, when that chain matches nowhere or more than one place.",
    }),
  ),
  parent: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Id of the live node it goes back under. Absent, the recorded ancestor chain decides (see `file`).",
    }),
  ),
})

export const EmptyRequest = Schema.Struct({
  op: Schema.Literal("empty"),
  file: Schema.String.annotate({
    description:
      "The trash this write empties — `_olai/Trash.olai`, root-relative, exactly as `outlines_index` spells it. Every record in it goes, the source-file signposts and ancestor-title scaffold included, and the file stays behind empty. A leftover `Archive.olai` is not the trash and is refused. Refused for an outline that is not the trash, for one the set does not hold, for a trash that holds nothing, and while anything outside it still points into it — naming what to re-point first.",
  }),
  was: Schema.optionalKey(
    Schema.Int.annotate({
      description:
        "How many records the named trash is expected to hold RIGHT NOW. Absent empties whatever is there, which is what a sweep means. Supply it when a number was shown to somebody — the web's confirm names one — and the write is refused, naming both counts, if a record arrived in the meantime: the alternative is deleting something nobody agreed to and reporting the count they read.",
    }),
  ),
})

const Seed = Schema.Struct(ROOT)

export const CreateRequest = Schema.Struct({
  op: Schema.Literal("create"),
  file: Schema.String.annotate({
    description:
      "Relative path of the new outline under the served directory. Must end in " +
      "`.olai`. No absolute path, no `..` / `.` segments, no separators inside a " +
      "segment. Refused if that file already exists among the loaded outlines.",
  }),
  seed: Schema.optionalKey(
    Seed.annotate({
      description:
        "What the new outline is born holding — a capture, exactly as `outlines_add` takes " +
        "one: a title, optional note/date/mark/id, the `props` / `see` / `waitsOn` a " +
        "node is born carrying, and `children` nesting the same way, with the same " +
        "forward references. So a new outline, everything in it AND the order its steps " +
        "happen in is ONE call, and a seed that is refused leaves no file behind. Absent " +
        "creates the outline empty.",
    }),
  ),
})

export const WriteDocumentRequest = Schema.Struct({
  op: Schema.Literal("doc"),
  file: Schema.String.annotate({
    description:
      "Path of a document (`.md`) under the served directory, exactly as the set lists it.",
  }),
  text: Schema.String.annotate({
    description:
      "The document's new text, whole and verbatim. Markdown, stored exactly as given " +
      "and interpreted only at view time.",
  }),
  was: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The text this write expects the document to hold right now — what you read " +
        "before editing. Supply it to make the write CONDITIONAL: if the file has " +
        "changed since (another editor, a `git pull`), the write is refused instead of " +
        "landing on top of words you have not seen. Absent overwrites whatever is there.",
    }),
  ),
})

export const CreateDocumentRequest = Schema.Struct({
  op: Schema.Literal("create-doc"),
  file: Schema.String.annotate({
    description:
      "Relative path of the new document under the served directory. Must end in " +
      "`.md`. No absolute path, no `..` / `.` segments, no separators inside a " +
      "segment. Refused if that document already exists.",
  }),
  text: Schema.optionalKey(
    Schema.String.annotate({
      description: "What the document is born holding. Absent creates it empty.",
    }),
  ),
})

export const DeleteRequest = Schema.Struct({
  op: Schema.Literal("delete"),
  file: Schema.String.annotate({
    description:
      "Path of the file to delete, exactly as the served set lists it — a `.md` document " +
      "(any content) or an `.olai` outline holding NO records. Refused, naming what to " +
      "settle first, for a path the set does not hold, an outline still carrying records, " +
      "a document a link or a `doc`-declared property still names, a file the set " +
      "could not load, and any of the kinds olai only shows (`.html`, `.csv`, pictures, " +
      "`.pdf`). The delete is not undoable in olai: what survives is whatever git had " +
      "already recorded.",
  }),
})

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

export const MirrorRequest = Schema.Struct({
  op: Schema.Literal("mirror"),
  target: Schema.String.annotate({
    description:
      "The `id` this mirror shows. Any node in the loaded set, in any outline — and it may itself be a mirror, in which case the chain is followed to the node at its end.",
  }),
  ...LANDING,
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id for the PLACEMENT (`[A-Za-z0-9_-]+`), unique across the set — not the target's id. Absent mints one, and the answer's `id` names it either way.",
    }),
  ),
  ...Anchor,
})

export const UnmirrorRequest = Schema.Struct({
  op: Schema.Literal("unmirror"),
  id: Schema.String.annotate({
    description:
      "The `id` of the MIRROR record — the placement — not of the node it shows.",
  }),
})

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

export const UpdateRequest = Schema.Struct({
  op: Schema.Literal("update"),
  id: Id,
  title: Schema.optionalKey(Title),
  desc: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: "The note, replaced whole. Markdown, stored verbatim; `null` removes it. A relative link resolves beside the file this node lives in, not beside the reader; the answer names any link that lands on nothing served.",
    }),
  ),
  date: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description:
        "ISO date (`2026-08-10`) or datetime, scheduling the node; `null` clears it.",
    }),
  ),
  /** Written BEFORE the mark, like the date it needs, so a call that
   *  schedules a node, gives it a rule and ticks it in one breath spawns the
   *  next occurrence off the values this call wrote. */
  repeat: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description:
        `The repeat rule, in the format's own words — ${REPEAT_GRAMMAR}; \`null\` stops the recurrence. Needs a \`date\` on the node (set one in the same call if it has none).`,
    }),
  ),
  props: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.NullOr(Schema.String)).annotate({
      description:
        "Properties to write, MERGED key by key — exactly as one `outlines_prop` per key would, and in the same words when one is refused. A key not named here is left alone; `null` (or `\"\"`) removes the one it names. A key spelled like a field the format already has is refused toward the verb that writes that fact, and a value that does not fit what its key DECLARES in `_olai/Properties.olai` is refused with the values it may hold named.",
    }),
  ),
  after: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "What this node must come AFTER, as the WHOLE list — this REPLACES the node's `after` rather than adding to it, and `[]` clears it. Written that way because every other field here is the field's whole value; `outlines_after` is the incremental verb, taking `add` / `remove`. The difference against what the node holds now is what is actually written, so the refusals are that verb's: an unknown target is answered with the closest id that exists, and an edge that would close a loop is refused NAMING the loop.",
    }),
  ),
  was: Schema.optionalKey(
    Schema.Struct({
      title: Schema.optionalKey(
        Schema.String.annotate({
          description: Was("putting back a title you read a moment ago"),
        }),
      ),
      desc: Schema.optionalKey(
        Schema.NullOr(Schema.String).annotate({
          description: Was(
            "putting back a note you read a moment ago; `null` expects none",
          ),
        }),
      ),
    }).annotate({
      description:
        "What this write expects those fields to hold RIGHT NOW, checked before anything is written and on every retry — `outlines_title`'s and `outlines_desc`'s `was`, per field. Supply the half you read; the write is refused, naming what is there, if anything else has been written since. Only `title` and `desc` take one here — a condition on one KEY is `outlines_prop`'s own `was`, which a merged map cannot spell. A `was` for a field this call is not writing is refused.",
    }),
  ),
  mark: Schema.optionalKey(
    Schema.NullOr(Status).annotate({
      description:
        "The mark, written exactly as `outlines_done` / `outlines_doing` / `outlines_todo` writes it — `done` records the instant, the other two store `true`. `null` takes off whatever mark the node carries. Applied LAST, after every other field here, so it is judged against the node this call has finished making: asking for `doing` in the same breath as an `after` edge on an unfinished task is refused, as `outlines_doing` refuses it.",
    }),
  ),
})

const arm = <F extends Schema.Struct.Fields>(schema: Schema.Struct<F>): Schema.Struct<F> =>
  Schema.Struct(stripped(schema.fields))

const BATCHED = [
  arm(AddRequest),
  arm(MarkRequest),
  arm(TitleRequest),
  arm(DescRequest),
  arm(DateRequest),
  arm(RepeatRequest),
  arm(PropRequest),
  arm(UpdateRequest),
  arm(MoveRequest),
  arm(SplitRequest),
  arm(MergeRequest),
  arm(TrashRequest),
  arm(DuplicateRequest),
  arm(UntrashRequest),
  arm(EmptyRequest),
  arm(SeeRequest),
  arm(MirrorRequest),
  arm(UnmirrorRequest),
  arm(AfterRequest),
] as const

export const BATCH_AT_MOST = 100

export const ApplyRequest = Schema.Struct({
  op: Schema.Literal("apply"),
  ops: Schema.Array(Schema.Union([...BATCHED])).annotate({
    description:
      `The ops, in the order they are applied — at most ${BATCH_AT_MOST} of them. Each is exactly what its own tool takes, plus the \`op\` tag that names the verb: \`{"op":"done","id":"order"}\`, \`{"op":"prop","id":"lane","key":"pr","value":"…"}\`, \`{"op":"add","parent":"plan","title":"…"}\`. Each op sees the set as the ops before it left it, so a later one may name what an earlier one created. Any refusal aborts the whole list.`,
  }),
})

export const WriteRequest = Schema.Union([
  AddRequest,
  MarkRequest,
  TitleRequest,
  DescRequest,
  DateRequest,
  RepeatRequest,
  PropRequest,
  MoveRequest,
  SplitRequest,
  MergeRequest,
  TrashRequest,
  DuplicateRequest,
  UntrashRequest,
  EmptyRequest,
  CreateRequest,
  SeeRequest,
  MirrorRequest,
  UnmirrorRequest,
  AfterRequest,
  WriteDocumentRequest,
  CreateDocumentRequest,
  DeleteRequest,
  UpdateRequest,
  ApplyRequest,
])
export type WriteRequest = typeof WriteRequest.Type

export type BatchedRequest = typeof ApplyRequest.Type["ops"][number]

export const Minted = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
})
export type Minted = typeof Minted.Type

export const WriteResult = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  file: Schema.String,
  summary: Schema.String,
  nudge: Schema.optionalKey(Schema.String),
  sort: Schema.optionalKey(Sort),
  captured: Schema.optionalKey(Schema.Array(Minted)),
  rev: Schema.Int,
  why: Schema.String,
})
export type WriteResult = typeof WriteResult.Type
