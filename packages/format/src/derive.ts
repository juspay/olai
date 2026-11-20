import type { Claims } from "./kinds.ts"
import { Order, Schema } from "effect"

import { Tag } from "./address.ts"
import {
  MENTION_ALPHABET,
  isLeftoverArchive,
  isPutAway,
  isTrashed,
  isMirror,
  isRegular,
  Located,
  LocatedRegular,
  type Node,
  type RegularNode,
  type Settled,
  settles,
  Status,
  storedMarker,
  type TargetField,
  targetsOf,
  Unfinished,
} from "./node.ts"
import { type Dated, dateInto } from "./occasion.ts"
import type { Read } from "./overlay.ts"
import { byPath } from "./paths.ts"

export { Status } from "./node.ts"

export interface Derived {
  readonly claims: Claims
  readonly nodes: ReadonlyArray<Located>
  readonly byId: ReadonlyMap<string, Located>
  readonly children: ReadonlyMap<string, ReadonlyArray<Located>>
  readonly status: ReadonlyMap<string, Status>
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  readonly blocked: ReadonlyMap<string, ReadonlyArray<InTheWay>>
  readonly byFile: ReadonlyMap<string, ReadonlyArray<Located>>
  readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
  readonly edgesTo: ReadonlyMap<string, ReadonlySet<string>>
  readonly namedBy: ReadonlyMap<string, ReadonlyArray<Naming>>
  readonly taggedBy: ReadonlyMap<string, ReadonlyArray<LocatedRegular>>
  readonly byDay: ReadonlyMap<string, ReadonlyArray<Dated>>
  readonly owedByDay: ReadonlyMap<string, number>
  /**
   * THE SAME KEYS AND THE SAME ORDER as `byDay`, never a second opinion about
   * which days the set has.
   */
  readonly days: ReadonlyArray<string>
}

export type Index = {
  [K in keyof Derived]: Derived[K] extends ReadonlyMap<string, unknown> ? K : never
}[keyof Derived]

export const READ: { readonly [K in Index]: Read } = {
  byId: "by key",
  children: "by key",
  status: "by key",
  after: "by key",
  blocked: "by key",
  mirrorsOf: "by key",
  edgesTo: "by key",
  byFile: "whole",
  namedBy: "whole",
  taggedBy: "whole",
  byDay: "whole",
  owedByDay: "whole",
}

export const parentInto = (
  children: Map<string, Array<Located>>,
  located: Located,
): void => {
  const parent = located.node.parent
  if (parent === undefined) return
  const siblings = children.get(parent)
  if (siblings === undefined) children.set(parent, [located])
  else siblings.push(located)
}

export interface Naming {
  readonly at: Located
  readonly fields: ReadonlyArray<TargetField>
}

export interface Filing {
  readonly at: Located
  readonly fields: Array<TargetField>
}

export const nameInto = (
  namedBy: Map<string, Array<Filing>>,
  located: Located,
): void => {
  for (const [field, target] of targetsOf(located.node)) {
    const naming = namedBy.get(target)
    const held = naming?.[naming.length - 1]
    if (held?.at === located) {
      if (!held.fields.includes(field)) held.fields.push(field)
    } else if (naming === undefined) {
      namedBy.set(target, [{ at: located, fields: [field] }])
    } else {
      naming.push({ at: located, fields: [field] })
    }
  }
}

export const writtenTags = (node: Node): ReadonlyArray<Tag> => {
  if (isMirror(node)) return NO_TAGS
  const title = tagsIn(node.title)
  const note = node.desc === undefined ? NO_TAGS : tagsIn(node.desc)
  if (note.length === 0) return title
  if (title.length === 0) return note
  return [...title, ...note]
}

const NO_TAGS: ReadonlyArray<Tag> = []

export const tagsIn = (text: string): ReadonlyArray<Tag> => {
  if (!mayHoldTag(text)) return NO_TAGS
  let found: Array<Tag> | undefined
  for (const part of titleParts(text)) {
    if (part.kind === "tag") (found ??= []).push(tagText(part))
  }
  return found ?? NO_TAGS
}

export const tagInto = (
  taggedBy: Map<string, Array<LocatedRegular>>,
  located: Located,
): void => {
  if (!isRegular(located)) return
  for (const tag of writtenTags(located.node)) {
    const held = taggedBy.get(tag)
    if (held === undefined) taggedBy.set(tag, [located])
    else if (held[held.length - 1] !== located) held.push(located)
  }
}

export const derive = (claims: Claims, nodes: ReadonlyArray<Located>): Derived => {
  const byFile = Map.groupBy(nodes, (located) => located.file)

  const byId = new Map<string, Located>()
  const children = new Map<string, Array<Located>>()
  const namedBy = new Map<string, Array<{ at: Located; fields: Array<TargetField> }>>()
  const taggedBy = new Map<string, Array<LocatedRegular>>()
  const dated = new Map<string, Array<Dated>>()

  for (const located of nodes) {
    if (!byId.has(located.node.id)) byId.set(located.node.id, located)

    parentInto(children, located)
    nameInto(namedBy, located)
    tagInto(taggedBy, located)
    dateInto(claims, dated, located)
  }

  for (const own of byFile.values()) own.sort(byLine)
  for (const siblings of children.values()) siblings.sort(byOrd)
  const byDay = new Map([...dated].sort(([one], [other]) => byDayKey(one, other)))
  const days: Array<string> = []
  const owedByDay = new Map<string, number>()
  for (const [day, own] of byDay) {
    days.push(day)
    const owed = owingOn(own)
    if (owed > 0) owedByDay.set(day, owed)
  }

  const { status, mirrorsOf } = resolutions(nodes, byId)
  const { after, edgesTo } = orderings(byId, nodes)
  return {
    claims,
    nodes,
    byId,
    children,
    status,
    after,
    blocked: blockage(claims, byId, status, after),
    byFile,
    mirrorsOf,
    edgesTo,
    namedBy,
    taggedBy,
    byDay,
    owedByDay,
    days,
  }
}

export const byDayKey: (a: string, b: string) => number = Order.String

export const byLine = (a: Located, b: Located): number => a.line - b.line

export const byCorpus = (a: Located, b: Located): number =>
  a.file === b.file ? a.line - b.line : byPath(a.file, b.file)

export const nodesOf = (
  derived: Pick<Derived, "byFile">,
  file: string,
): ReadonlyArray<Located> => derived.byFile.get(file) ?? []

export const byOrd = (a: Located, b: Located): number =>
  a.node.ord === b.node.ord ? a.line - b.line : a.node.ord < b.node.ord ? -1 : 1

export const siblingsOf = (
  derived: Derived,
  file: string,
  parent: string | undefined,
): ReadonlyArray<Located> =>
  parent === undefined
    ? nodesOf(derived, file)
      .filter((located) => located.node.parent === undefined)
      .sort(byOrd)
    : (derived.children.get(parent) ?? []).filter((located) => located.file === file)

export const rootsOf = (
  derived: Derived,
  file: string,
): ReadonlyArray<LocatedRegular> => siblingsOf(derived, file, undefined).filter(isRegular)

const counted = (
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
  id: string,
): ReadonlyArray<LocatedRegular> =>
  (children.get(id) ?? []).filter(isRegular)

export const countedChildren = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => counted(derived.children, id)

const resolutions = (
  nodes: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
): {
  readonly status: ReadonlyMap<string, Status>
  readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
} => {
  const index = { byId }
  const status = new Map<string, Status>()
  const mirrorsOf = new Map<string, Set<string>>()
  for (const located of nodes) {
    const found = follow(index, located)
    if (found.kind !== "found") continue
    const mark = storedMarker(found.shows.node)
    if (mark !== undefined) status.set(located.node.id, mark)
    if (!isMirror(located.node)) continue
    if (isLeftoverArchive(located.file)) continue
    const mirrors = mirrorsOf.get(found.shows.node.id)
    if (mirrors === undefined) mirrorsOf.set(found.shows.node.id, new Set([located.node.id]))
    else mirrors.add(located.node.id)
  }
  return { status, mirrorsOf }
}

export const unfinished = (
  mark: Status | undefined,
): mark is Exclude<Status, Settled> => mark !== undefined && !settles(mark)

export const unfinishedWork = (node: RegularNode): boolean =>
  unfinished(storedMarker(node))

export const owingOn = (dated: ReadonlyArray<Dated>): number => {
  let owed = 0
  for (const one of dated) {
    if (unfinishedWork(one.at.node)) owed++
  }
  return owed
}

export const dayAt = (days: ReadonlyArray<string>, value: string): number => {
  let low = 0
  let high = days.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((days[middle] as string) < value) low = middle + 1
    else high = middle
  }
  return low
}

const tasksUnder = (
  derived: Derived,
  id: string,
): ReadonlyArray<{ readonly at: LocatedRegular; readonly status: Status }> =>
  counted(derived.children, id).flatMap((at) => {
    const status = derived.status.get(at.node.id)
    return status === undefined ? [] : [{ at, status }]
  })

export const Progress = Schema.Struct({
  done: Schema.Int,
  total: Schema.Int,
})
export type Progress = typeof Progress.Type

export const progressOf = (derived: Derived, id: string): Progress | undefined => {
  const tasks = tasksUnder(derived, id)
  let done = 0
  let total = 0
  for (const task of tasks) {
    if (task.status === "cancelled") continue
    total += 1
    if (task.status === "done") done += 1
  }
  return total === 0 ? undefined : { done, total }
}

export const spanOf = (started: string, settled: string): number | undefined => {
  const from = Date.parse(started)
  const at = Date.parse(settled)
  if (Number.isNaN(from) || Number.isNaN(at)) return undefined
  return Math.max(0, Math.round((at - from) / 1000))
}

export const tookOf = (node: RegularNode): number | undefined => {
  const mark = storedMarker(node)
  if (mark === undefined || !settles(mark)) return undefined
  if (node.worked !== undefined) return Math.max(0, node.worked)
  const started = node.started
  if (started === undefined) return undefined
  const settled = node[mark]
  if (typeof settled !== "string") return undefined
  return spanOf(started, settled)
}

export const unfinishedWithin = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => {
  const open: Array<LocatedRegular> = []
  const seen = new Set<string>([id])
  const descend = (at: string): void => {
    for (const child of counted(derived.children, at)) {
      if (seen.has(child.node.id)) continue
      seen.add(child.node.id)
      if (unfinished(derived.status.get(child.node.id))) open.push(child)
      descend(child.node.id)
    }
  }
  descend(id)
  return open
}

export const InTheWay = Schema.Struct({
  at: LocatedRegular,
  status: Unfinished,
})
export type InTheWay = typeof InTheWay.Type

const orderings = (
  byId: ReadonlyMap<string, Located>,
  nodes: ReadonlyArray<Located>,
): {
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  readonly edgesTo: ReadonlyMap<string, ReadonlySet<string>>
} => {
  const index = { byId }
  const named = (id: string): string => nodeNamed(index, id)?.node.id ?? id
  const after = new Map<string, Array<string>>()
  const edgesTo = new Map<string, Set<string>>()
  const edge = (from: string, to: string): void => {
    const existing = after.get(from)
    if (existing === undefined) after.set(from, [to])
    else if (!existing.includes(to)) existing.push(to)
    const sources = edgesTo.get(to)
    if (sources === undefined) edgesTo.set(to, new Set([from]))
    else sources.add(from)
  }

  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.after ?? []) edge(node.id, named(target))
  }
  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.blocks ?? []) edge(named(target), node.id)
  }
  return { after, edgesTo }
}

const inPlay = (
  index: { readonly claims: Claims; readonly byId: ReadonlyMap<string, Located> },
  status: ReadonlyMap<string, Status>,
  id: string,
): InTheWay | undefined => {
  const at = nodeNamed(index, id)
  if (at === undefined || isPutAway(index.claims, at.file)) {
    return undefined
  }
  const mark = status.get(at.node.id)
  return unfinished(mark) ? { at, status: mark } : undefined
}

const waitingOn = (
  index: { readonly claims: Claims; readonly byId: ReadonlyMap<string, Located> },
  status: ReadonlyMap<string, Status>,
  targets: ReadonlyArray<string>,
): ReadonlyArray<InTheWay> =>
  targets
    .map((target) => inPlay(index, status, target))
    .filter((blocker) => blocker !== undefined)

const blockage = (
  claims: Claims,
  byId: ReadonlyMap<string, Located>,
  status: ReadonlyMap<string, Status>,
  after: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyMap<string, ReadonlyArray<InTheWay>> => {
  const view = { claims, byId, status, after }
  const blocked = new Map<string, ReadonlyArray<InTheWay>>()
  for (const id of after.keys()) {
    const found = blockageAt(view, id)
    if (found !== undefined) blocked.set(found.at, found.waiting)
  }
  return blocked
}

export const blockageAt = (
  view: Pick<Derived, "claims" | "byId" | "status" | "after">,
  id: string,
): { readonly at: string; readonly waiting: ReadonlyArray<InTheWay> } | undefined => {
  const source = inPlay(view, view.status, id)
  if (source === undefined) return undefined
  const waiting = standingBefore(view, id)
  return waiting.length === 0 ? undefined : { at: source.at.node.id, waiting }
}

export const drawnFrom = (
  derived: Pick<Derived, "children">,
  node: Node,
): ReadonlyArray<string> => [
  ...(derived.children.get(node.id) ?? []).map((child) => child.node.id),
  ...(isMirror(node) ? [node.mirror] : []),
]

export const drawingPath = (
  derived: Pick<Derived, "byId" | "children">,
  from: string,
  to: string,
): ReadonlyArray<string> | null => {
  const seen = new Set<string>()
  const walk = (at: string, trail: ReadonlyArray<string>): ReadonlyArray<string> | null => {
    if (at === to) return [...trail, at]
    if (seen.has(at)) return null
    seen.add(at)
    const located = derived.byId.get(at)
    if (located === undefined) return null
    const path = [...trail, at]
    for (const next of drawnFrom(derived, located.node)) {
      const found = walk(next, path)
      if (found !== null) return found
    }
    return null
  }
  return walk(from, [])
}

export const blockersOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<InTheWay> => derived.blocked.get(id) ?? []

export const isBlocked = (derived: Derived, id: string): boolean =>
  derived.blocked.has(id)

export const isMirrored = (derived: Pick<Derived, "mirrorsOf">, id: string): boolean =>
  derived.mirrorsOf.has(id)

export const standingBefore = (
  derived: Pick<Derived, "claims" | "byId" | "status" | "after">,
  id: string,
): ReadonlyArray<InTheWay> =>
  waitingOn(derived, derived.status, derived.after.get(id) ?? [])

interface Place {
  readonly at: Located
  readonly status?: Status | undefined
  readonly blocked: ReadonlyArray<InTheWay>
  readonly progress?: Progress | undefined
  readonly key: string
  readonly under: number
  readonly children: ReadonlyArray<Row>
}

const PLACE = {
  at: Located,
  status: Schema.optional(Status),
  blocked: Schema.Array(InTheWay),
  progress: Schema.optional(Progress),
  key: Schema.String,
  under: Schema.Int,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Row> => Row)),
}

export type Row =
  | (Place & { readonly kind: "node" | "mirror"; readonly shows: LocatedRegular })
  | (Place & { readonly kind: "dangling"; readonly missing: string })
  | (Place & { readonly kind: "cycle"; readonly through: string })

export const Row: Schema.Codec<Row> = Schema.Union([
  Schema.Struct({
    ...PLACE,
    kind: Schema.Literals(["node", "mirror"]),
    shows: LocatedRegular,
  }),
  Schema.Struct({ ...PLACE, kind: Schema.Literal("dangling"), missing: Schema.String }),
  Schema.Struct({ ...PLACE, kind: Schema.Literal("cycle"), through: Schema.String }),
])

export const under = (
  derived: Pick<Derived, "children">,
  id: string,
  memo: Map<string, number> = new Map(),
): number => descendants(derived, id, memo)

const descendants = (
  derived: Pick<Derived, "children">,
  id: string,
  memo: Map<string, number>,
): number => {
  const held = memo.get(id)
  if (held !== undefined) return held
  memo.set(id, 0)
  const count = (derived.children.get(id) ?? []).reduce(
    (total, child) => total + 1 + descendants(derived, child.node.id, memo),
    0,
  )
  memo.set(id, count)
  return count
}

export const idsUnder = (
  derived: Pick<Derived, "children">,
  id: string,
  stop: ReadonlySet<string> = new Set(),
  seen: Set<string> = new Set([id]),
): ReadonlySet<string> => {
  const under = new Set<string>()
  const descend = (at: string): void => {
    for (const child of derived.children.get(at) ?? []) {
      const below = child.node.id
      if (seen.has(below) || stop.has(below)) continue
      seen.add(below)
      under.add(below)
      descend(below)
    }
  }
  descend(id)
  return under
}

export interface MovedRow {
  readonly id: string
  readonly title: string
}

export const movedUnder = (
  derived: Pick<Derived, "children" | "byId">,
  id: string,
  since: string | null,
  stop: ReadonlySet<string> = new Set(),
): ReadonlyArray<MovedRow> => {
  const moved: Array<MovedRow> = []
  for (const under of idsUnder(derived, id, stop)) {
    const at = derived.byId.get(under)
    if (at === undefined || !isRegular(at)) continue
    const stamp = stampedAt(at.node)
    if (stamp === undefined || !newerThan(stamp, since)) continue
    moved.push({ id: under, title: at.node.title })
  }
  return moved
}

export const memoryScope = (
  derived: Pick<Derived, "children">,
  id: string,
  stop: ReadonlySet<string> = new Set(),
  seen: Set<string> = new Set([id]),
): ReadonlySet<string> => new Set([id, ...idsUnder(derived, id, stop, seen)])

export const memoryFiles = (
  derived: Pick<Derived, "children" | "byId">,
  id: string,
  stop: ReadonlySet<string> = new Set(),
  seen: Set<string> = new Set([id]),
): ReadonlySet<string> => {
  const files = new Set<string>()
  for (const within of memoryScope(derived, id, stop, seen)) {
    const at = derived.byId.get(within)
    if (at !== undefined) files.add(at.file)
  }
  return files
}

export interface Changes {
  readonly rows: number
  readonly newest: number | null
  readonly oldest: number | null
}

export const changesUnder = (
  derived: Pick<Derived, "children" | "byId">,
  id: string,
  since: string | null,
  stop: ReadonlySet<string> = new Set(),
): Changes => {
  let rows = 0
  let newest: number | null = null
  let oldest: number | null = null
  for (const under of idsUnder(derived, id, stop)) {
    const at = derived.byId.get(under)
    if (at === undefined || !isRegular(at)) continue
    const stamp = stampedAt(at.node)
    if (stamp === undefined) continue
    const instant = instantOf(stamp)
    if (newest === null || instant > newest) newest = instant
    if (!newerThan(stamp, since)) continue
    rows += 1
    if (oldest === null || instant < oldest) oldest = instant
  }
  return { rows, newest, oldest }
}

const stampedAt = (node: RegularNode): string | undefined =>
  node.changed !== undefined && (node.created === undefined || instantOf(node.changed) >= instantOf(node.created))
    ? node.changed
    : node.created

const newerThan = (stamp: string | undefined, since: string | null): boolean => {
  if (stamp === undefined) return false
  if (since === null) return true
  const at = instantOf(stamp)
  const from = instantOf(since)
  if (Number.isNaN(at) || Number.isNaN(from)) return true
  return at > from
}

const instantOf = (stamp: string): number => Date.parse(stamp)

export const rowsOf = (derived: Derived, file: string): ReadonlyArray<Row> => {
  const counting = new Map<string, number>()
  return siblingsOf(derived, file, undefined).map((root) =>
    expand(derived, root, [], "", counting)
  )
}

export const rowsUnder = (
  derived: Derived,
  shows: LocatedRegular,
  ancestors: ReadonlyArray<LocatedRegular>,
): ReadonlyArray<Row> => {
  const within = [...ancestors.map((crumb) => crumb.node.id), shows.node.id]
  const counting = new Map<string, number>()
  return (derived.children.get(shows.node.id) ?? []).map((child) =>
    expand(derived, child, within, "", counting)
  )
}

const expand = (
  derived: Derived,
  at: Located,
  ancestors: ReadonlyArray<string>,
  parentKey: string,
  counting: Map<string, number>,
): Row => {
  const key = `${parentKey}/${at.node.id}`
  const found = follow(derived, at)
  const status = derived.status.get(at.node.id)
  const place = {
    at,
    ...(status === undefined ? {} : { status }),
    blocked: found.kind === "found" ? blockersOf(derived, found.shows.node.id) : [],
    under: found.kind === "found"
      ? descendants(derived, found.shows.node.id, counting)
      : 0,
    key,
  }

  if (found.kind !== "found") {
    return { ...place, children: [], ...found }
  }
  if (ancestors.includes(found.shows.node.id)) {
    return { ...place, children: [], kind: "cycle", through: found.shows.node.id }
  }

  const within = [...ancestors, found.shows.node.id]
  const progress = progressOf(derived, found.shows.node.id)
  return {
    ...place,
    ...(progress === undefined ? {} : { progress }),
    kind: isMirror(at.node) ? "mirror" : "node",
    shows: found.shows,
    children: (derived.children.get(found.shows.node.id) ?? []).map((child) =>
      expand(derived, child, within, key, counting)
    ),
  }
}

export const withoutDone = (
  rows: ReadonlyArray<Row>,
  keep?: ReadonlySet<string>,
): ReadonlyArray<Row> =>
  pruneRows(rows, row => row.status === "done" && keep?.has(row.key) !== true
    ? undefined : withoutDone(row.children, keep))

const pruneRows = (rows: ReadonlyArray<Row>, childrenOf: (row: Row) => ReadonlyArray<Row> | undefined): ReadonlyArray<Row> => {
  const kept: Row[] = []
  for (const row of rows) {
    const children = childrenOf(row)
    if (children !== undefined) kept.push(children === row.children ? row : { ...row, children })
  }
  return kept.length === rows.length && kept.every((row, index) => row === rows[index]) ? rows : kept
}

export const ancestorsOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => ancestryOver((key) => derived.byId.get(key), id)

export const nearestAtOrAbove = (
  derived: Derived,
  id: string,
  selected: ReadonlySet<string>,
): string | null => {
  if (selected.has(id)) return id
  const nearest = [...ancestorsOf(derived, id)].reverse()
    .find((crumb) => selected.has(crumb.node.id))
  return nearest?.node.id ?? null
}

export const ancestryOver = (
  at: (id: string) => Located | undefined,
  id: string,
): ReadonlyArray<LocatedRegular> => {
  const chain: Array<LocatedRegular> = []
  const seen = new Set<string>([id])
  let next = at(id)?.node.parent

  while (next !== undefined && !seen.has(next)) {
    seen.add(next)
    const located = at(next)
    if (located === undefined || isMirror(located.node)) break
    chain.push(located as LocatedRegular)
    next = located.node.parent
  }

  return chain.reverse()
}

export const ancestorTitles = (
  derived: Derived,
  id: string,
): ReadonlyArray<string> =>
  ancestorsOf(derived, id).map((crumb) => crumb.node.title)

export const Situated = Schema.Struct({
  shows: LocatedRegular,
  status: Schema.optional(Status),
  blocked: Schema.Array(InTheWay),
  progress: Schema.optional(Progress),
  trail: Schema.Array(LocatedRegular),
  under: Schema.Int,
})
export type Situated = typeof Situated.Type

export const situate = (
  derived: Derived,
  shows: LocatedRegular,
  counted: Map<string, number> = new Map(),
): Situated => {
  const status = derived.status.get(shows.node.id)
  const progress = progressOf(derived, shows.node.id)
  return {
    shows,
    ...(status === undefined ? {} : { status }),
    blocked: blockersOf(derived, shows.node.id),
    ...(progress === undefined ? {} : { progress }),
    trail: ancestorsOf(derived, shows.node.id),
    under: under(derived, shows.node.id, counted),
  }
}

type Found =
  | { readonly kind: "found"; readonly shows: LocatedRegular }
  | { readonly kind: "dangling"; readonly missing: string }
  | { readonly kind: "cycle"; readonly through: string }

export const follow = (
  derived: Pick<Derived, "byId">,
  from: Located,
): Found => {
  if (!isMirror(from.node)) return { kind: "found", shows: from as LocatedRegular }

  const seen = new Set<string>()
  let at: Located = from
  while (isMirror(at.node)) {
    if (seen.has(at.node.id)) return { kind: "cycle", through: at.node.id }
    seen.add(at.node.id)
    const next = derived.byId.get(at.node.mirror)
    if (next === undefined) return { kind: "dangling", missing: at.node.mirror }
    at = next
  }
  return { kind: "found", shows: at as LocatedRegular }
}

export const nodeNamed = (
  derived: Pick<Derived, "byId">,
  id: string,
): LocatedRegular | undefined => {
  const named = derived.byId.get(id)
  if (named === undefined) return undefined
  const found = follow(derived, named)
  return found.kind === "found" ? found.shows : undefined
}

export const TAG_SIGILS = ["#", "@"] as const
export type TagSigil = (typeof TAG_SIGILS)[number]

export interface TitleTag {
  readonly sigil: TagSigil
  readonly tag: string
}

export type TitlePart =
  | { readonly kind: "text"; readonly text: string }
  | ({ readonly kind: "tag" } & TitleTag)

export const tagText = (part: TitleTag): Tag => Tag.make(`${part.sigil}${part.tag}`)

export const tagPart = (written: string): TitleTag => ({
  sigil: written[0] as TagSigil,
  tag: written.slice(1),
})

export const mayHoldTag = (text: string): boolean =>
  text.includes("#") || text.includes("@")

export const titleTagRe = (): RegExp =>
  new RegExp(`#[${MENTION_ALPHABET}]+|(?<![^\\s([{])@[${MENTION_ALPHABET}]+`, "g")

export const isTagName = (text: string): boolean =>
  new RegExp(`^[${MENTION_ALPHABET}]*$`).test(text)

export const tagOpensAt = (text: string, at: number): boolean =>
  at === 0 || /[\s([{]/.test(text[at - 1] as string)

export const titleParts = (title: string): ReadonlyArray<TitlePart> => {
  const parts: Array<TitlePart> = []
  const tags = titleTagRe()
  let at = 0
  let match: RegExpExecArray | null
  while ((match = tags.exec(title)) !== null) {
    const start = match.index
    if (start > at) parts.push({ kind: "text", text: title.slice(at, start) })
    parts.push({ kind: "tag", ...tagPart(match[0]) })
    at = start + match[0].length
  }
  if (at < title.length) parts.push({ kind: "text", text: title.slice(at) })
  return parts
}
