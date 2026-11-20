import { DeadLink } from "./dead-links.ts"

import { ClaimData } from "./kinds.ts"
import { Schema } from "effect"

import { Reference, Way } from "./backlinks.ts"
import { Custom } from "./custom.ts"
import { Progress } from "./derive.ts"
import { MARKS, MirrorNode, RegularNode, Site, STAMPED, Status } from "./node.ts"

export const Found = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  ...Site.fields,
  status: Schema.optionalKey(Status),
  path: Schema.Array(Schema.String),
  parent: RegularNode.fields.parent,
  see: RegularNode.fields.see,
  after: RegularNode.fields.after,
  custom: RegularNode.fields.custom,
})
export type Found = typeof Found.Type

const Unreadable = Schema.Struct({
  file: Schema.String,
  unreadable: Schema.Array(Schema.String),
})

export const OutlineSummary = Schema.Union([
  Schema.Struct({
    file: Schema.String,
    nodes: Schema.Int,
    roots: Schema.Array(Schema.String),
  }),
  Unreadable,
])
export type OutlineSummary = typeof OutlineSummary.Type

export const OutlineAnswer = Schema.Struct({
  outlines: Schema.Array(OutlineSummary),
})
export type OutlineAnswer = typeof OutlineAnswer.Type

export const PathsAnswer = Schema.Struct({
  claims: Schema.Array(ClaimData),
  outlineRow: Schema.String,
  paths: Schema.Array(Schema.String),
})
export type PathsAnswer = typeof PathsAnswer.Type

export const DocumentSummary = Schema.Union([
  Schema.Struct({
    file: Schema.String,
    title: Schema.String,
    bytes: Schema.Int,
    props: Schema.optionalKey(Custom),
  }),
  Unreadable,
])
export type DocumentSummary = typeof DocumentSummary.Type

export const DocumentAnswer = Schema.Struct({
  documents: Schema.Array(DocumentSummary),
})
export type DocumentAnswer = typeof DocumentAnswer.Type

export const DocumentRequest = Schema.Struct({
  file: Schema.String.annotate({
    description:
      "Path of a document (`.md`) under the served directory, exactly as `markdown_index` lists it.",
  }),
})
export type DocumentRequest = typeof DocumentRequest.Type

export const DocumentBody = Schema.Struct({
  deadLinks: Schema.optionalKey(Schema.Array(DeadLink)),
  file: Schema.String,
  text: Schema.String,
})
export type DocumentBody = typeof DocumentBody.Type

export const PROJECTABLE = [
  "title",
  "parent",
  "status",
  "took",
  ...MARKS,
  "started",
  "worked",
  "date",
  "repeat",
  "desc",
  "created",
  "changed",
  "see",
  "after",
  "custom",
] as const
export type Projectable = (typeof PROJECTABLE)[number]

const NOT_PROJECTABLE: Record<
  Exclude<keyof RegularNode | keyof MirrorNode, Projectable>,
  string
> = {
  id: "rides every row already",
  ord: "a fractional index is a sorting detail, not a fact a read reports",
  blocks: "`after` answers the same edge said from the waiting node",
  mirror: "a placement carries its target's id, not a life of its own",
}

export const isProjectable = (name: string): name is Projectable =>
  (PROJECTABLE as ReadonlyArray<string>).includes(name)

export const LEGAL_FIELDS =
  PROJECTABLE.map((name) => `\`${name}\``).join(", ") +
  ", and one property spelled as `custom.<key>`"

export const Projected = Schema.Struct({
  id: Schema.String,
  title: Schema.optionalKey(RegularNode.fields.title),
  status: Schema.optionalKey(Status),
  took: Schema.optionalKey(Schema.Int),
  ...STAMPED,
  started: RegularNode.fields.started,
  worked: RegularNode.fields.worked,
  date: RegularNode.fields.date,
  repeat: RegularNode.fields.repeat,
  desc: RegularNode.fields.desc,
  created: RegularNode.fields.created,
  changed: RegularNode.fields.changed,
  parent: RegularNode.fields.parent,
  see: RegularNode.fields.see,
  after: RegularNode.fields.after,
  custom: RegularNode.fields.custom,
})
export type Projected = typeof Projected.Type

const FieldsRequest = Schema.optionalKey(
  Schema.Array(Schema.String).annotate({
    description:
      "Name what each row carries: " +
      LEGAL_FIELDS +
      ". The two settles carry their instants; `started` is when the " +
      "CURRENT round opened (re-stamped on every start), `worked` is the " +
      "rounds banked before it, and `took` is how long the work took — " +
      "whole seconds, derived at read time by the format's `tookOf`, " +
      "absent when there is no span to tell. The id rides regardless, and " +
      "an unknown name is refused with this same list. Absent: the full " +
      "row this read answers today.",
  }),
)

export const NodeRequest = Schema.Struct({
  id: Schema.String.annotate({ description: "The node's `id`." }),
  fields: FieldsRequest,
})
export type NodeRequest = typeof NodeRequest.Type

export const Placement = Schema.Struct({
  id: Schema.String,
  ...Site.fields,
  parent: Schema.optionalKey(Schema.String),
})
export type Placement = typeof Placement.Type

export const Placed = Schema.Struct({
  ...Placement.fields,
  shows: Found,
})
export type Placed = typeof Placed.Type

export const ProjectedPlaced = Schema.Struct({
  ...Placement.fields,
  shows: Projected,
})
export type ProjectedPlaced = typeof ProjectedPlaced.Type

export const Detail = Schema.Struct({
  deadLinks: Schema.optionalKey(Schema.Array(DeadLink)),
  ...Found.fields,
  ...STAMPED,
  started: RegularNode.fields.started,
  worked: RegularNode.fields.worked,
  date: RegularNode.fields.date,
  repeat: RegularNode.fields.repeat,
  desc: RegularNode.fields.desc,
  created: RegularNode.fields.created,
  changed: RegularNode.fields.changed,
  tags: Schema.Array(Schema.String),
  progress: Schema.optionalKey(Progress),
  took: Schema.optionalKey(Schema.Int),
  children: Schema.Array(Schema.Union([Found, Projected])),
  mirrors: Schema.optionalKey(Schema.Array(Placement)),
  placed: Schema.optionalKey(Schema.Array(Placed)),
  referencedBy: Schema.optionalKey(Schema.Array(Reference)),
  blockedBy: Schema.optionalKey(Schema.Array(Found)),
})
export type Detail = typeof Detail.Type

export type Stamps = Pick<Detail, Status>

export const DEFAULT_SUBTREE_DEPTH = 3

export const SubtreeRequest = Schema.Struct({
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The node to read from. Give this or `file` — never both, never neither.",
    }),
  ),
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "An outline (`.olai`) under the served directory, exactly as `outlines_index` lists it. Reads the WHOLE file: every top-level node in it, each walked to `depth`. Give this or `id` — never both, never neither.",
    }),
  ),
  depth: Schema.optionalKey(
    Schema.Number.annotate({
      description:
        `How many levels of children to include — from the node, or from each of a file's roots. Default ${DEFAULT_SUBTREE_DEPTH}.`,
    }),
  ),
  withDesc: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "Carry each row's `desc` — its note, whole. ON by default: a targeted read usually wants the note. `false` is the lean read for a table of contents — ids, titles, marks, props, structure only. Depth bounds levels, not notes; notes dominate the cost of a walk. Per-node `truncated` is unchanged. It is the DEFAULT projection's note dial: with `fields` given the rows are exactly what was named and there is nothing left for it to turn — naming both is refused.",
    }),
  ),
  fields: FieldsRequest,
})
export type SubtreeRequest = typeof SubtreeRequest.Type

export interface Subtree extends Found {
  readonly deadLinks?: ReadonlyArray<DeadLink>
  readonly date?: string | undefined
  readonly desc?: string | undefined
  readonly children: ReadonlyArray<Subtree>
  readonly placed?: ReadonlyArray<Placed>
  readonly truncated?: true
}

export const Subtree = Schema.Struct({
  deadLinks: Schema.optionalKey(Schema.Array(DeadLink)),
  ...Found.fields,
  date: RegularNode.fields.date,
  desc: RegularNode.fields.desc,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Subtree> => Subtree)),
  placed: Schema.optionalKey(Schema.Array(Placed)),
  truncated: Schema.optionalKey(Schema.Literal(true)),
})

export interface ProjectedSubtree extends Projected {
  readonly deadLinks?: ReadonlyArray<DeadLink>
  readonly children: ReadonlyArray<ProjectedSubtree>
  readonly placed?: ReadonlyArray<ProjectedPlaced>
  readonly truncated?: true
}

export const ProjectedSubtree = Schema.Struct({
  deadLinks: Schema.optionalKey(Schema.Array(DeadLink)),
  ...Projected.fields,
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<ProjectedSubtree> => ProjectedSubtree),
  ),
  placed: Schema.optionalKey(Schema.Array(ProjectedPlaced)),
  truncated: Schema.optionalKey(Schema.Literal(true)),
})

export const ProjectedRoots = Schema.Struct({
  file: Schema.String,
  roots: Schema.Array(ProjectedSubtree),
  placed: Schema.optionalKey(Schema.Array(ProjectedPlaced)),
})
export type ProjectedRoots = typeof ProjectedRoots.Type

const Missing = Schema.Struct({ missing: Schema.String })

export const NodeAnswer = Schema.Union([Detail, Missing])
export type NodeAnswer = typeof NodeAnswer.Type

export const OutlineRoots = Schema.Struct({
  file: Schema.String,
  roots: Schema.Array(Subtree),
  placed: Schema.optionalKey(Schema.Array(Placed)),
})
export type OutlineRoots = typeof OutlineRoots.Type

export const SubtreeAnswer = Schema.Union([
  Subtree,
  OutlineRoots,
  ProjectedSubtree,
  ProjectedRoots,
  Missing,
])
export type SubtreeAnswer = typeof SubtreeAnswer.Type

export const NamedRequest = Schema.Struct({
  ids: Schema.Array(Schema.String),
})
export type NamedRequest = typeof NamedRequest.Type

const NamedNode = Schema.Struct({
  asked: Schema.String,
  id: Schema.String,
  title: Schema.String,
})

export const NamedAnswer = Schema.Struct({
  named: Schema.Array(NamedNode),
})
export type NamedAnswer = typeof NamedAnswer.Type

export const HomesRequest = Schema.Struct({
  ids: Schema.Array(Schema.String),
  files: Schema.Array(Schema.String),
})
export type HomesRequest = typeof HomesRequest.Type

const Home = Schema.Struct({
  id: Schema.String,
  file: Schema.String,
})

export const HomesAnswer = Schema.Struct({
  homes: Schema.Array(Home),
  loaded: Schema.Array(Schema.String),
})
export type HomesAnswer = typeof HomesAnswer.Type
