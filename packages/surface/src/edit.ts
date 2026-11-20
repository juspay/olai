import { OpFailure, Status } from "@olai/format"
import { Schema } from "effect"

const Id = Schema.String

const Was = <A extends Schema.Top>(text: A) =>
  Schema.optionalKey(
    text.annotate({
      description:
        "What this field is expected to hold right now. Omit to overwrite whatever is there " +
        "(last-one-wins, which is what a bare write means); supply to make the write conditional " +
        "— undo rides this field, and the chip's every commit, on the value its box was opened on.",
    }),
  )

export const Anchor = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("after"), id: Id }),
  Schema.Struct({ kind: Schema.Literal("before"), id: Id }),
  Schema.Struct({ kind: Schema.Literal("under"), id: Id }),
  Schema.Struct({ kind: Schema.Literal("first"), file: Schema.String }),
])
export type Anchor = typeof Anchor.Type

export const Edit = Schema.Union([
  Schema.Struct({
    verb: Schema.Literal("add"),
    at: Anchor,
    title: Schema.String,
    desc: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("move"),
    id: Id,
    how: Schema.Literals(["in", "out", "up", "down"]),
  }),
  Schema.Struct({
    verb: Schema.Literal("under"),
    id: Id,
    parent: Id,
  }),
  Schema.Struct({ verb: Schema.Literal("toggle"), id: Id, mark: Status }),
  Schema.Struct({ verb: Schema.Literal("walk"), id: Id }),
  Schema.Struct({
    verb: Schema.Literal("split"),
    id: Id,
    title: Schema.String,
    rest: Schema.String,
    under: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    verb: Schema.Literal("merge"),
    id: Id,
    title: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("title"),
    id: Id,
    title: Schema.String,
    was: Was(Schema.String),
    pinned: Schema.optionalKey(Schema.Literal(true)),
  }),
  Schema.Struct({
    verb: Schema.Literal("desc"),
    id: Id,
    desc: Schema.NullOr(Schema.String),
    was: Was(Schema.NullOr(Schema.String)),
  }),

  Schema.Struct({
    verb: Schema.Literal("mark"),
    id: Id,
    mark: Schema.NullOr(Status),
  }),

  Schema.Struct({
    verb: Schema.Literal("date"),
    id: Id,
    date: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("repeat"),
    id: Id,
    repeat: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("prop"),
    id: Id,
    key: Schema.String,
    value: Schema.NullOr(Schema.String),
    was: Was(Schema.NullOr(Schema.String)),
  }),
  Schema.Struct({ verb: Schema.Literal("unmirror"), id: Id }),
  Schema.Struct({
    verb: Schema.Literal("mirror"),
    target: Id,
    at: Anchor,
  }),
  Schema.Struct({ verb: Schema.Literal("trash"), id: Id }),
  Schema.Struct({ verb: Schema.Literal("duplicate"), id: Id }),

  Schema.Struct({
    verb: Schema.Literal("see"),
    id: Id,
    add: Schema.optionalKey(Schema.Array(Id)),
    remove: Schema.optionalKey(Schema.Array(Id)),
  }),
  Schema.Struct({
    verb: Schema.Literal("after"),
    id: Id,
    add: Schema.optionalKey(Schema.Array(Id)),
    remove: Schema.optionalKey(Schema.Array(Id)),
  }),
  Schema.Struct({
    verb: Schema.Literal("untrash"),
    id: Id,
    parent: Schema.optionalKey(Id),
    file: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("emptyTrash"),
    was: Schema.optionalKey(Schema.Int),
  }),

  Schema.Struct({ verb: Schema.Literal("capture"), title: Schema.String }),

  Schema.Struct({
    verb: Schema.Literal("pin"),
    at: Schema.String,
    name: Schema.optionalKey(Schema.String),
  }),

  Schema.Struct({
    verb: Schema.Literal("doc"),
    file: Schema.String,
    text: Schema.String,
    was: Was(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("docNew"),
    file: Schema.String,
  }),

  Schema.Struct({
    verb: Schema.Literal("outlineNew"),
    file: Schema.String,
  }),
  Schema.Struct({
    verb: Schema.Literal("fileDelete"),
    file: Schema.String,
  }),

  Schema.Struct({
    verb: Schema.Literal("place"),
    id: Id,
    parent: Schema.NullOr(Id),
    file: Schema.optionalKey(Schema.String),
    after: Schema.NullOr(Id),
  }),
  Schema.Struct({ verb: Schema.Literal("remove"), id: Id }),
])
export type Edit = typeof Edit.Type

export const Applied = Schema.Struct({
  id: Id,
  title: Schema.String,
  file: Schema.String,
  nudge: Schema.optionalKey(Schema.String),
  undo: Schema.optionalKey(Schema.Array(Edit)),
})
export type Applied = typeof Applied.Type

export const editProcedures = {
  apply: { input: Edit, output: Applied, error: OpFailure },
} as const
