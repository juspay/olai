import {
  blockageAt,
  byCorpus,
  byLine,
  byOrd,
  derive,
  type Derived,
  type Filing,
  type Index,
  follow,
  type InTheWay,
  nameInto,
  type Naming,
  byDayKey,
  nodeNamed,
  owingOn,
  parentInto,
  READ,
  tagInto,
} from "./derive.ts"
import {
  isMirror,
  type Located,
  type LocatedRegular,
  type Status,
  storedMarker,
} from "./node.ts"
import { type Dated, dateInto } from "./occasion.ts"
import { type Editable, overlay } from "./overlay.ts"
import { byPath } from "./paths.ts"

export interface FileNodes {
  readonly nodes: ReadonlyArray<Located>
}

export interface SetDelta {
  readonly upserts: ReadonlyArray<readonly [file: string, entry: FileNodes]>
  readonly removes: ReadonlyArray<string>
}

export const patch = (derived: Derived, delta: SetDelta): Derived => {
  const grouped = regrouped(derived, delta)
  return patched(derived, delta, grouped) ?? derive(derived.claims, flattened(grouped.byFile))
}

export const patched = (
  derived: Derived,
  delta: SetDelta,
  grouped: Regrouped = regrouped(derived, delta),
): Derived | undefined => {
  const { byFile, touched } = grouped
  if (touched.size === 0) return derived

  if (!claimsAreUnique(derived)) return undefined
  if (!some(derived.byFile.keys(), (file) => !touched.has(file))) return undefined

  const edit: Edit = {
    before: derived,
    touched,
    outgoing: recordsIn(derived.byFile, touched),
    incoming: recordsIn(byFile, touched),
  }

  const claimed = new Set<string>()
  for (const at of edit.incoming) {
    const id = at.node.id
    if (claimed.has(id)) return undefined
    claimed.add(id)
    const held = derived.byId.get(id)
    if (held !== undefined && !touched.has(held.file)) return undefined
  }

  let flat: ReadonlyArray<Located> | undefined
  const nodes = (): ReadonlyArray<Located> => (flat ??= flattened(byFile))

  const byId = ids(edit, nodes, claimed)
  const children = containment(edit)
  const namedBy = namings(edit, nodes)
  const taggedBy = taggings(edit)
  const journal = dating(edit)
  const { status, mirrorsOf, dirty } = resolutions(edit, byId)
  const { after, edgesTo, rewritten } = orderings(edit, { byId, mirrorsOf, namedBy }, dirty)
  const blocked = blockage(edit, { byId, status, after, edgesTo }, dirty, rewritten)

  return {
    claims: derived.claims,
    get nodes() {
      return nodes()
    },
    byId,
    children,
    status,
    after,
    blocked,
    byFile,
    mirrorsOf,
    edgesTo,
    namedBy,
    taggedBy,
    ...journal,
  }
}

interface Edit {
  readonly before: Derived
  readonly touched: ReadonlySet<string>
  readonly outgoing: ReadonlyArray<Located>
  readonly incoming: ReadonlyArray<Located>
}

interface Refiled<T> {
  readonly map: ReadonlyMap<string, ReadonlyArray<T>>
  readonly rekeyed: boolean
  readonly keys: ReadonlySet<string>
  readonly arriving: ReadonlyMap<string, ReadonlyArray<T>>
  readonly departing: ReadonlyMap<string, ReadonlyArray<T>>
  readonly headMoved: boolean
}

const refiled = <K extends Listed, Filed extends Member<K> = Member<K>>(
  edit: Edit,
  index: K,
  filing: {
    readonly into: (filed: Map<string, Array<Filed>>, at: Located) => void
    readonly at: (one: Member<K>) => Located
    readonly order?: (one: Located, other: Located) => number
  },
): Refiled<Member<K>> => {
  const { into, at, order = byCorpus } = filing
  const before = edit.before[index] as ReadonlyMap<string, ReadonlyArray<Member<K>>>
  const arriving = new Map<string, Array<Filed>>()
  for (const one of edit.incoming) into(arriving, one)
  const departing = new Map<string, Array<Filed>>()
  for (const one of edit.outgoing) into(departing, one)

  const keys = new Set<string>(arriving.keys())
  for (const key of departing.keys()) keys.add(key)
  if (keys.size === 0) {
    return { map: before, keys, arriving, departing, rekeyed: false, headMoved: false }
  }

  const head = (own: ReadonlyArray<Member<K>> | undefined): Located | undefined => {
    const first = own?.[0]
    return first === undefined ? undefined : at(first)
  }
  const inOrder = (one: Member<K>, other: Member<K>): number => order(at(one), at(other))
  const departed = (one: Member<K>): boolean => edit.touched.has(at(one).file)

  const map = carrying(edit.before, index) as unknown as Editable<
    string,
    ReadonlyArray<Member<K>>
  >
  let rekeyed = false
  let headMoved = false
  for (const key of keys) {
    const held = before.get(key)
    const own = spliced(held ?? NOTHING, arriving.get(key) ?? NOTHING, departed, inOrder)
    if (!headMoved && elsewhere(head(held), head(own))) headMoved = true
    if (filedAt(map, key, own, own.length > 0)) rekeyed = true
  }
  return { map: map.sealed(), keys, arriving, departing, rekeyed, headMoved }
}

export const spliced = <T>(
  held: ReadonlyArray<T>,
  arriving: ReadonlyArray<T>,
  left: (one: T) => boolean,
  order: (one: T, other: T) => number,
): ReadonlyArray<T> => {
  const kept = surviving(held, left)
  if (arriving.length === 0) return kept
  const coming = arriving.length > 1 ? [...arriving].sort(order) : arriving
  if (kept.length === 0) return coming
  const own: Array<T> = []
  let from = 0
  for (const one of coming) {
    const to = placeFor(kept, one, order, from)
    for (let at = from; at < to; at++) own.push(kept[at] as T)
    own.push(one)
    from = to
  }
  for (let at = from; at < kept.length; at++) own.push(kept[at] as T)
  return own
}

const surviving = <T>(held: ReadonlyArray<T>, left: (one: T) => boolean): ReadonlyArray<T> => {
  let gone = -1
  for (let at = 0; at < held.length; at++) {
    if (left(held[at] as T)) {
      gone = at
      break
    }
  }
  if (gone < 0) return held
  const kept = held.slice(0, gone)
  for (let at = gone + 1; at < held.length; at++) {
    const one = held[at] as T
    if (!left(one)) kept.push(one)
  }
  return kept
}

const placeFor = <T>(
  within: ReadonlyArray<T>,
  one: T,
  order: (a: T, b: T) => number,
  from: number,
): number => {
  let low = from
  let high = within.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (order(within[middle] as T, one) > 0) high = middle
    else low = middle + 1
  }
  return low
}

const filedAt = <V extends {}>(
  map: Editable<string, V>,
  key: string,
  own: V,
  holds: boolean,
): boolean => holds ? map.set(key, own) : map.delete(key)

const inKeyOrder = <V>(
  map: ReadonlyMap<string, V>,
  moved: boolean,
  order: (one: string, other: string) => number,
): ReadonlyMap<string, V> =>
  moved ? new Map([...map].sort(([one], [other]) => order(one, other))) : map

const NOTHING: ReadonlyArray<never> = []

const containment = (
  edit: Edit,
): ReadonlyMap<string, ReadonlyArray<Located>> =>
  refiled(edit, "children", {
    into: parentInto,
    at: (one) => one,
    order: bySibling,
  }).map

interface Regrouped {
  readonly byFile: ReadonlyMap<string, ReadonlyArray<Located>>
  readonly touched: ReadonlySet<string>
}

const regrouped = (derived: Derived, delta: SetDelta): Regrouped => {
  const byFile = carrying(derived, "byFile")
  const touched = touchedBy(delta)
  let reordered = false
  for (const file of delta.removes) {
    if (filedAt(byFile, file, NOTHING, false)) reordered = true
  }
  for (const [file, entry] of delta.upserts) {
    const own = [...entry.nodes].sort(byLine)
    if (filedAt(byFile, file, own, own.length > 0)) reordered = true
  }
  const ordered = inKeyOrder(byFile.sealed(), reordered, byPath)
  return { byFile: ordered, touched }
}

const flattened = (
  byFile: ReadonlyMap<string, ReadonlyArray<Located>>,
): ReadonlyArray<Located> => [...byFile.values()].flat()

const countIn = (byFile: ReadonlyMap<string, ReadonlyArray<Located>>): number => {
  let held = 0
  for (const own of byFile.values()) held += own.length
  return held
}

const carrying = <K extends Index>(
  before: Derived,
  index: K,
): Editable<string, Values<K>> =>
  overlay(before[index] as unknown as ReadonlyMap<string, Values<K>>, READ[index])

type Values<K extends Index> = Derived[K] extends ReadonlyMap<string, infer V>
  ? undefined extends V ? never : V
  : never

type Listed = { [K in Index]: Values<K> extends ReadonlyArray<unknown> ? K : never }[Index]

type Member<K extends Listed> = Values<K> extends ReadonlyArray<infer E> ? E : never

export const claimsAreUnique = (derived: Derived): boolean =>
  derived.byId.size === countIn(derived.byFile)

export const touchedBy = (delta: SetDelta): ReadonlySet<string> => {
  const touched = new Set<string>()
  for (const file of delta.removes) touched.add(file)
  for (const [file] of delta.upserts) touched.add(file)
  return touched
}

export const recordsIn = (
  byFile: ReadonlyMap<string, ReadonlyArray<Located>>,
  files: ReadonlySet<string>,
): ReadonlyArray<Located> => {
  const found: Array<Located> = []
  for (const file of files) found.push(...(byFile.get(file) ?? []))
  return found
}

const some = <T>(over: Iterable<T>, asked: (one: T) => boolean): boolean => {
  for (const one of over) if (asked(one)) return true
  return false
}

const elsewhere = (one: Located | undefined, other: Located | undefined): boolean =>
  one?.file !== other?.file || one?.line !== other?.line

export const bySibling = (a: Located, b: Located): number => byOrd(a, b) || byCorpus(a, b)

const namedIn = (
  byId: ReadonlyMap<string, Located>,
): ((id: string) => string) => {
  const view = { byId }
  return (id) => nodeNamed(view, id)?.node.id ?? id
}

const ids = (
  edit: Edit,
  nodes: () => ReadonlyArray<Located>,
  claimed: ReadonlySet<string>,
): ReadonlyMap<string, Located> => {
  const left = edit.outgoing.some((at) => !claimed.has(at.node.id))
  const moved = edit.incoming.some((at) => elsewhere(edit.before.byId.get(at.node.id), at))
  if (left || moved) {
    const byId = new Map<string, Located>()
    for (const at of nodes()) if (!byId.has(at.node.id)) byId.set(at.node.id, at)
    return byId
  }
  const byId = carrying(edit.before, "byId")
  for (const at of edit.incoming) byId.set(at.node.id, at)
  return byId.sealed()
}

const namings = (
  edit: Edit,
  nodes: () => ReadonlyArray<Located>,
): ReadonlyMap<string, ReadonlyArray<Naming>> => {
  const { map, headMoved } = refiled(edit, "namedBy", {
    into: nameInto,
    at: (naming) => naming.at,
  })
  if (!headMoved) return map
  const namedBy = new Map<string, Array<Filing>>()
  for (const at of nodes()) nameInto(namedBy, at)
  return namedBy
}

const taggings = (edit: Edit): ReadonlyMap<string, ReadonlyArray<LocatedRegular>> =>
  refiled(edit, "taggedBy", {
    into: tagInto,
    at: (one) => one,
  }).map

const dating = (edit: Edit): Journal => {
  const moved = refiled(edit, "byDay", {
    into: (map, located) => dateInto(edit.before.claims, map, located),
    at: (one) => one.at,
  })
  const byDay = inKeyOrder(moved.map, moved.rekeyed, byDayKey)
  return {
    byDay,
    owedByDay: owing(edit, moved),
    days: moved.rekeyed ? [...byDay.keys()] : edit.before.days,
  }
}

interface Journal {
  readonly byDay: ReadonlyMap<string, ReadonlyArray<Dated>>
  readonly owedByDay: ReadonlyMap<string, number>
  readonly days: ReadonlyArray<string>
}

const owing = (
  edit: Edit,
  moved: Pick<Refiled<Dated>, "keys" | "arriving" | "departing">,
): ReadonlyMap<string, number> => {
  const { keys, arriving, departing } = moved
  if (keys.size === 0) return edit.before.owedByDay
  const before = edit.before.owedByDay
  let map: Editable<string, number> | undefined
  let rekeyed = false
  for (const key of keys) {
    const held = before.get(key) ?? 0
    const owed = held - owingOn(departing.get(key) ?? NOTHING) +
      owingOn(arriving.get(key) ?? NOTHING)
    if (owed === held) continue
    map ??= carrying(edit.before, "owedByDay")
    if (filedAt(map, key, owed, owed > 0)) rekeyed = true
  }
  return map === undefined ? before : inKeyOrder(map.sealed(), rekeyed, byDayKey)
}

const resolutions = (
  edit: Edit,
  byId: ReadonlyMap<string, Located>,
): {
  readonly status: ReadonlyMap<string, Status>
  readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
  readonly dirty: ReadonlySet<string>
} => {
  const arriving = new Map<string, Array<string>>()
  for (const at of edit.incoming) {
    if (!isMirror(at.node)) continue
    const shown = arriving.get(at.node.mirror)
    if (shown === undefined) arriving.set(at.node.mirror, [at.node.id])
    else shown.push(at.node.id)
  }

  const dirty = new Set<string>()
  const pending: Array<string> = []
  const wake = (id: string): void => {
    if (dirty.has(id)) return
    dirty.add(id)
    pending.push(id)
  }
  for (const at of edit.outgoing) wake(at.node.id)
  for (const at of edit.incoming) wake(at.node.id)
  while (pending.length > 0) {
    const id = pending.pop() as string
    for (const naming of edit.before.namedBy.get(id) ?? []) {
      if (naming.fields.includes("mirror")) wake(naming.at.node.id)
    }
    for (const mirror of arriving.get(id) ?? []) wake(mirror)
  }

  const status = carrying(edit.before, "status")
  const mirrorsOf = carrying(edit.before, "mirrorsOf")
  const shown = new Set<string>()
  const landing = new Map<string, Array<Located>>()
  const before = { byId: edit.before.byId }
  const now = { byId }
  for (const id of dirty) {
    const was = edit.before.byId.get(id)
    if (was !== undefined && isMirror(was.node)) {
      const found = follow(before, was)
      if (found.kind === "found") shown.add(found.shows.node.id)
    }
    const at = byId.get(id)
    const found = at === undefined ? undefined : follow(now, at)
    const mark = found?.kind === "found" ? storedMarker(found.shows.node) : undefined
    if (mark === undefined) status.delete(id)
    else status.set(id, mark)
    if (at === undefined || !isMirror(at.node) || found?.kind !== "found") continue
    shown.add(found.shows.node.id)
    const others = landing.get(found.shows.node.id)
    if (others === undefined) landing.set(found.shows.node.id, [at])
    else others.push(at)
  }

  for (const id of shown) {
    const members = [
      ...[...(mirrorsOf.get(id) ?? [])]
        .filter((mirror) => !dirty.has(mirror))
        .map((mirror) => byId.get(mirror) as Located),
      ...(landing.get(id) ?? []),
    ].sort(byCorpus)
    if (members.length === 0) mirrorsOf.delete(id)
    else mirrorsOf.set(id, new Set(members.map((at) => at.node.id)))
  }

  return { status: status.sealed(), mirrorsOf: mirrorsOf.sealed(), dirty }
}

const orderings = (
  edit: Edit,
  view: {
    readonly byId: ReadonlyMap<string, Located>
    readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
    readonly namedBy: ReadonlyMap<string, ReadonlyArray<Naming>>
  },
  dirty: ReadonlySet<string>,
): {
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  readonly edgesTo: ReadonlyMap<string, ReadonlySet<string>>
  readonly rewritten: ReadonlySet<string>
} => {
  const { byId, mirrorsOf, namedBy } = view
  const namedBefore = namedIn(edit.before.byId)
  const namedNow = namedIn(byId)

  const keys = new Set<string>()
  for (const at of [...edit.outgoing, ...edit.incoming]) {
    if (isMirror(at.node)) continue
    keys.add(at.node.id)
    for (const target of [...(at.node.after ?? []), ...(at.node.blocks ?? [])]) {
      keys.add(namedBefore(target))
      keys.add(namedNow(target))
    }
  }
  for (const id of dirty) {
    if (namedBefore(id) === namedNow(id)) continue
    keys.add(namedBefore(id))
    keys.add(namedNow(id))
    for (
      const naming of [...(edit.before.namedBy.get(id) ?? []), ...(namedBy.get(id) ?? [])]
    ) {
      if (naming.fields.includes("after") || naming.fields.includes("blocks")) {
        keys.add(naming.at.node.id)
      }
    }
  }

  const contributors = (
    key: string,
    field: "after" | "blocks",
  ): ReadonlyArray<Located> => {
    const found: Array<Located> = []
    const written = [...(mirrorsOf.get(key) ?? [])]
    if (namedNow(key) === key) written.push(key)
    for (const id of written) {
      for (const naming of namedBy.get(id) ?? []) {
        if (naming.fields.includes(field) && !found.includes(naming.at)) found.push(naming.at)
      }
    }
    return found.sort(byCorpus)
  }

  const after = carrying(edit.before, "after")
  const edgesTo = carrying(edit.before, "edgesTo")
  for (const key of keys) {
    const own = byId.get(key)
    const mine = own === undefined || isMirror(own.node) ? undefined : own.node
    const waits: Array<string> = []
    for (const target of mine?.after ?? []) {
      const to = namedNow(target)
      if (!waits.includes(to)) waits.push(to)
    }
    for (const at of contributors(key, "blocks")) {
      if (!waits.includes(at.node.id)) waits.push(at.node.id)
    }
    if (waits.length === 0) after.delete(key)
    else after.set(key, waits)

    const sources = new Set(contributors(key, "after").map((at) => at.node.id))
    for (const target of mine?.blocks ?? []) sources.add(namedNow(target))
    if (sources.size === 0) edgesTo.delete(key)
    else edgesTo.set(key, sources)
  }

  return { after: after.sealed(), edgesTo: edgesTo.sealed(), rewritten: keys }
}

const blockage = (
  edit: Edit,
  view: Pick<Derived, "byId" | "status" | "after" | "edgesTo">,
  dirty: ReadonlySet<string>,
  rewritten: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlyArray<InTheWay>> => {
  const keys = new Set<string>(rewritten)
  for (const id of dirty) {
    keys.add(id)
    for (const source of edit.before.edgesTo.get(id) ?? []) keys.add(source)
    for (const source of view.edgesTo.get(id) ?? []) keys.add(source)
  }

  const blocked = carrying(edit.before, "blocked")
  for (const key of keys) {
    blocked.delete(key)
    const found = blockageAt({ ...view, claims: edit.before.claims }, key)
    if (found !== undefined) blocked.set(found.at, found.waiting)
  }
  return blocked.sealed()
}
