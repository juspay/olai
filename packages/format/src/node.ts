import { Schema } from "effect"

import { Custom } from "./custom.ts"
import { type Claims, fileKind, stemOf, mintExt } from "./kinds.ts"
import { basenameOf } from "./paths.ts"

const Marker = Schema.Union([Schema.Literal(true), Schema.String])

/**
 * The four MARKS a record may carry, at most one of them, in the order a
 * reader resolves them. The order is precedence, and the two that SETTLE lead
 * it ({@link SETTLED}).
 */
export const MARKS = ["done", "cancelled", "doing", "todo"] as const

export const SETTLED = ["done", "cancelled"] as const

export const Status = Schema.Literals(MARKS)
export type Status = typeof Status.Type

export type Settled = (typeof SETTLED)[number]

export const settles = (mark: Status): mark is Settled =>
  (SETTLED as ReadonlyArray<Status>).includes(mark)

export const Unfinished = Schema.Literals(
  MARKS.filter((mark): mark is Exclude<Status, Settled> => !settles(mark)),
)
export type Unfinished = typeof Unfinished.Type

export const STAMPED = {
  done: Schema.optionalKey(Marker),
  cancelled: Schema.optionalKey(Marker),
  doing: Schema.optionalKey(Marker),
  todo: Schema.optionalKey(Marker),
} satisfies { readonly [M in Status]: unknown }

const Common = {
  id: Schema.String,
  parent: Schema.optionalKey(Schema.String),
  ord: Schema.String,
}

export const RegularNode = Schema.Struct({
  ...Common,
  title: Schema.String,
  ...STAMPED,
  started: Schema.optionalKey(Schema.String),
  worked: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  date: Schema.optionalKey(Schema.String),
  repeat: Schema.optionalKey(Schema.String),
  desc: Schema.optionalKey(Schema.String),
  after: Schema.optionalKey(Schema.Array(Schema.String)),
  blocks: Schema.optionalKey(Schema.Array(Schema.String)),
  see: Schema.optionalKey(Schema.Array(Schema.String)),
  created: Schema.optionalKey(Schema.String),
  changed: Schema.optionalKey(Schema.String),
  custom: Schema.optionalKey(Custom),
})
export type RegularNode = typeof RegularNode.Type

export const MirrorNode = Schema.Struct({
  ...Common,
  mirror: Schema.String,
})
export type MirrorNode = typeof MirrorNode.Type

export const Node = Schema.Union([RegularNode, MirrorNode])
export type Node = typeof Node.Type

const DOORS = {
  id: "an id is minted or chosen when the node is captured, and never rewritten",
  parent: "`outlines_move` writes where a node sits",
  ord: "`outlines_move` writes where a node sits among its siblings",
  title: "`outlines_title` writes the title",
  mirror: "`outlines_mirror` places a node in a second location",
  done: "`outlines_done` writes it, and records the instant",
  cancelled: "`outlines_cancelled` writes it, and records the instant",
  doing: "`outlines_doing` writes it, and records the instant",
  todo: "`outlines_todo` writes it, and records the instant",
  started:
    "`outlines_doing` stamps it on every start — a settle keeps it when the round banked, buries it when none could; a peel banks the round and takes the stamp with the `doing`",
  worked:
    "rounds bank where the `doing` comes off — `outlines_done` / `outlines_cancelled` add the round they closed, `outlines_todo` and an un-done start bank at the peel; only a live `doing` opens one",
  status:
    "the mark is `done`, `cancelled`, `doing` or `todo` — `outlines_done` / `outlines_cancelled` / `outlines_doing` / `outlines_todo` write it",
  date: "`outlines_date` writes it, and validates the day",
  repeat: "`outlines_repeat` writes the repeat rule, and completing the node hands it to the next occurrence",
  desc: "`outlines_desc` writes the note",
  after: "`outlines_after` writes it, and refuses a cycle",
  blocks: "`outlines_after` writes it, said from the waiting node — `a blocks b` is `b after a`",
  see: "`outlines_see` writes it, and resolves the target",
  created: "the ops layer stamps this when a node is captured — nothing else may",
  changed: "the ops layer stamps this on every write — nothing else may",
  custom: "this is the map itself; a key inside it is what `outlines_prop` writes",
} as const satisfies Record<keyof RegularNode | keyof MirrorNode | "status", string>

export interface Shadow {
  readonly door: string
  readonly field: boolean
}

const FIELD_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(RegularNode.fields),
  ...Object.keys(MirrorNode.fields),
])

export const shadowFor = (key: string): Shadow | undefined => {
  const folded = key.trim().toLowerCase()
  const door = (DOORS as Record<string, string | undefined>)[folded]
  return door === undefined ? undefined : { door, field: FIELD_NAMES.has(folded) }
}

export const isMirror = (node: Node): node is MirrorNode => "mirror" in node

export const Site = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
})
export type Site = typeof Site.Type

export const Located = Schema.Struct({
  ...Site.fields,
  node: Node,
})
export type Located = typeof Located.Type

export const LocatedRegular = Schema.Struct({
  ...Site.fields,
  node: RegularNode,
})
export type LocatedRegular = typeof LocatedRegular.Type

export const isRegular = (at: Located): at is LocatedRegular => !isMirror(at.node)

/** Read in {@link MARKS} order, which is precedence. */
export const storedMarker = (node: RegularNode): Status | undefined =>
  MARKS.find((mark) => node[mark] !== undefined)

export const MENTION_ALPHABET = "A-Za-z0-9_/-"

export const ID_SHAPE = new RegExp(`^[${MENTION_ALPHABET}]+$`)

export const EDGE_FIELDS = ["after", "blocks", "see"] as const
export type EdgeField = (typeof EDGE_FIELDS)[number]

export type TargetField = EdgeField | "mirror"

const NOTHING_NAMED: ReadonlyArray<readonly [field: TargetField, id: string]> = []

export const targetsOf = (
  node: Node,
): ReadonlyArray<readonly [field: TargetField, id: string]> => {
  if (isMirror(node)) return [["mirror", node.mirror] as const]
  let named: Array<readonly [field: TargetField, id: string]> | undefined
  for (const field of EDGE_FIELDS) {
    const ids = node[field]
    if (ids === undefined) continue
    for (const id of ids) (named ??= []).push([field, id] as const)
  }
  return named ?? NOTHING_NAMED
}

export const TRASH = "Trash"

export const INBOX = "Inbox"

export const inboxIn = (claims: Claims, files: Iterable<string>): string | undefined =>
  outlineCalled(claims, files, INBOX)

export const PINS = "Pins"

export const PROPERTIES = "Properties"

export const OLAI_DIR = "_olai"

const OLAI_PREFIX = `${OLAI_DIR}/`

export const inOlaiDir = (file: string): boolean => file.startsWith(OLAI_PREFIX)

export const mintedInto = (name: string): string => `${OLAI_DIR}/${name}`

export const TRASH_FILE = (claims: Claims, kind: string): string | null => {
  const ext = mintExt(claims, kind)
  return ext === null ? null : mintedInto(`${TRASH}${ext}`)
}

export const isTrashed = (claims: Claims, file: string): boolean => conventionCalled(claims, file, TRASH)

export const isLeftoverArchive = (file: string): boolean =>
  file === "Archive.olai" || file.endsWith("/Archive.olai")

export const isPutAway = (claims: Claims, file: string): boolean =>
  isTrashed(claims, file) || isLeftoverArchive(file)

export const pinsIn = (claims: Claims, files: Iterable<string>): string | undefined =>
  outlineCalled(claims, files, PINS)

export const propertiesIn = (claims: Claims, files: Iterable<string>): string | undefined =>
  outlineCalled(claims, files, PROPERTIES)

export const conventionCalled = (claims: Claims, file: string, stem: string): boolean => {
  const kind = fileKind(claims, file)
  return kind !== null && claims.byKind.get(kind)?.holds === "nodes"
    && file.slice(0, file.lastIndexOf("/")) === OLAI_DIR
    && stemOf(claims, file).toLowerCase() === stem.toLowerCase()
}

export const outlineCalled = (claims: Claims, files: Iterable<string>, stem: string): string | undefined => {
  let held: string | undefined
  for (const file of files) {
    if (!conventionCalled(claims, file, stem)) continue
    if (held !== undefined && held !== file) return undefined
    held = file
  }
  return held
}
