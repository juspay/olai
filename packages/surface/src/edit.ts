import { OpFailure, Status } from "@olai/format"
import { Schema } from "effect"

const NodeId = Schema.String

const ExpectedText = <A extends Schema.Top>(text: A) =>
  Schema.optionalKey(
    text.annotate({
      description:
        "What this field is expected to hold right now. Omit to overwrite whatever is there " +
        "(last-one-wins, which is what a bare write means); supply to make the write conditional " +
        "— undo rides this field, and the chip's every commit, on the value its box was opened on.",
    }),
  )

export const Anchor = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("after"), id: NodeId }),
  Schema.Struct({ kind: Schema.Literal("before"), id: NodeId }),
  Schema.Struct({ kind: Schema.Literal("under"), id: NodeId }),
  Schema.Struct({ kind: Schema.Literal("first"), file: Schema.String }),
])
export type Anchor = typeof Anchor.Type

const NodeEdit = Schema.Union([
  Schema.Struct({
    verb: Schema.Literal("add"),
    at: Anchor,
    title: Schema.String,
    desc: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("move"),
    id: NodeId,
    how: Schema.Literals(["in", "out", "up", "down"]),
  }),
  Schema.Struct({
    verb: Schema.Literal("under"),
    id: NodeId,
    parent: NodeId,
  }),
  Schema.Struct({ verb: Schema.Literal("toggle"), id: NodeId, mark: Status }),
  Schema.Struct({ verb: Schema.Literal("walk"), id: NodeId }),
  Schema.Struct({
    verb: Schema.Literal("split"),
    id: NodeId,
    title: Schema.String,
    rest: Schema.String,
    under: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    verb: Schema.Literal("merge"),
    id: NodeId,
    title: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("title"),
    id: NodeId,
    title: Schema.String,
    was: ExpectedText(Schema.String),
    pinned: Schema.optionalKey(Schema.Literal(true)),
  }),
  Schema.Struct({
    verb: Schema.Literal("desc"),
    id: NodeId,
    desc: Schema.NullOr(Schema.String),
    was: ExpectedText(Schema.NullOr(Schema.String)),
  }),

  Schema.Struct({
    verb: Schema.Literal("mark"),
    id: NodeId,
    mark: Schema.NullOr(Status),
  }),

  Schema.Struct({
    verb: Schema.Literal("date"),
    id: NodeId,
    date: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("repeat"),
    id: NodeId,
    repeat: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("prop"),
    id: NodeId,
    key: Schema.String,
    value: Schema.NullOr(Schema.String),
    was: ExpectedText(Schema.NullOr(Schema.String)),
  }),
  Schema.Struct({ verb: Schema.Literal("unmirror"), id: NodeId }),
  Schema.Struct({
    verb: Schema.Literal("mirror"),
    target: NodeId,
    at: Anchor,
  }),
  Schema.Struct({ verb: Schema.Literal("trash"), id: NodeId }),
  Schema.Struct({ verb: Schema.Literal("duplicate"), id: NodeId }),

  Schema.Struct({
    verb: Schema.Literal("see"),
    id: NodeId,
    add: Schema.optionalKey(Schema.Array(NodeId)),
    remove: Schema.optionalKey(Schema.Array(NodeId)),
  }),
  Schema.Struct({
    verb: Schema.Literal("after"),
    id: NodeId,
    add: Schema.optionalKey(Schema.Array(NodeId)),
    remove: Schema.optionalKey(Schema.Array(NodeId)),
  }),
  Schema.Struct({
    verb: Schema.Literal("untrash"),
    id: NodeId,
    parent: Schema.optionalKey(NodeId),
    file: Schema.optionalKey(Schema.String),
  }),
])

const DirectoryEdit = Schema.Union([
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
])

const FileEdit = Schema.Union([
  Schema.Struct({
    verb: Schema.Literal("doc"),
    file: Schema.String,
    text: Schema.String,
    was: ExpectedText(Schema.String),
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
])

const InverseEdit = Schema.Union([
  Schema.Struct({
    verb: Schema.Literal("place"),
    id: NodeId,
    parent: Schema.NullOr(NodeId),
    file: Schema.optionalKey(Schema.String),
    after: Schema.NullOr(NodeId),
  }),
  Schema.Struct({ verb: Schema.Literal("remove"), id: NodeId }),
])

export const Edit = Schema.Union([
  ...NodeEdit.members,
  ...DirectoryEdit.members,
  ...FileEdit.members,
  ...InverseEdit.members,
])
export type Edit = typeof Edit.Type

export const Applied = Schema.Struct({
  id: NodeId,
  title: Schema.String,
  file: Schema.String,
  nudge: Schema.optionalKey(Schema.String),
  undo: Schema.optionalKey(Schema.Array(Edit)),
})
export type Applied = typeof Applied.Type

export const editProcedures = {
  apply: { input: Edit, output: Applied, error: OpFailure },
} as const
