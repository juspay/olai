import { type Derived, type Index, READ } from "./derive.ts"
import { type Face, sameFace } from "./document.ts"
import type { BrokenFile, OutlineSet } from "./set.ts"
import type { Reading } from "./validate.ts"

const INDEXES = Object.keys(READ) as ReadonlyArray<Index>

const BESIDE: {
  readonly [K in Exclude<keyof Reading, "set" | "derived" | "claims">]: (
    at: Reading,
  ) => ReadonlyMap<string, unknown>
} = {
  pointing: (at) => at.pointing,
}

type Table = Index | keyof typeof BESIDE

const tableIn = (at: Reading, which: Table): ReadonlyMap<string, unknown> =>
  which in BESIDE
    ? BESIDE[which as keyof typeof BESIDE](at)
    : (at.derived[which as Index] as ReadonlyMap<string, unknown>)

const LISTS: { readonly [K in Exclude<keyof Derived, Index | "claims">]: null } = {
  nodes: null,
  days: null,
}

type Held = unknown

export interface Tape {
  readonly keyed: Map<Table, Map<string, Held>>
  readonly walked: Set<Table>
  readonly lists: Set<keyof typeof LISTS>
  documents: boolean
  broken: boolean
}

class Taped<V> implements ReadonlyMap<string, V> {
  private readonly own: Map<string, Held>

  constructor(
    private readonly of: ReadonlyMap<string, V>,
    private readonly which: Table,
    private readonly tape: Tape,
  ) {
    const held = tape.keyed.get(which)
    if (held === undefined) {
      this.own = new Map<string, Held>()
      tape.keyed.set(which, this.own)
    } else this.own = held
  }

  private taped(key: string): V | undefined {
    const held = this.of.get(key)
    this.own.set(key, held)
    return held
  }

  get(key: string): V | undefined {
    return this.taped(key)
  }

  has(key: string): boolean {
    this.taped(key)
    return this.of.has(key)
  }

  get size(): number {
    this.tape.walked.add(this.which)
    return this.of.size
  }

  forEach(
    each: (value: V, key: string, map: ReadonlyMap<string, V>) => void,
    self?: unknown,
  ): void {
    this.tape.walked.add(this.which)
    this.of.forEach(each, self)
  }

  keys(): MapIterator<string> {
    this.tape.walked.add(this.which)
    return this.of.keys()
  }

  values(): MapIterator<V> {
    this.tape.walked.add(this.which)
    return this.of.values()
  }

  entries(): MapIterator<[string, V]> {
    this.tape.walked.add(this.which)
    return this.of.entries()
  }

  [Symbol.iterator](): MapIterator<[string, V]> {
    this.tape.walked.add(this.which)
    return this.of[Symbol.iterator]()
  }
}

export const taping = (
  at: Reading,
): { readonly reading: Reading; readonly tape: Tape } => {
  const tape: Tape = {
    keyed: new Map(),
    walked: new Set(),
    lists: new Set(),
    documents: false,
    broken: false,
  }
  const view: Record<string, unknown> = {}
  for (const which of INDEXES) {
    let held: Taped<unknown> | undefined
    Object.defineProperty(view, which, {
      enumerable: true,
      get: () =>
        held ??= new Taped(at.derived[which] as ReadonlyMap<string, unknown>, which, tape),
    })
  }
  for (const which of Object.keys(LISTS) as ReadonlyArray<keyof typeof LISTS>) {
    Object.defineProperty(view, which, {
      enumerable: true,
      get: () => {
        tape.lists.add(which)
        return at.derived[which]
      },
    })
  }
  const set: OutlineSet = {
    get documents() {
      tape.documents = true
      return at.set.documents
    },
    get broken() {
      tape.broken = true
      return at.set.broken
    },
  }
  Object.defineProperty(view, "claims", { enumerable: true, get: () => at.claims })
  const reading = { claims: at.claims, set, derived: view as unknown as Derived } as Record<string, unknown>
  for (const which of Object.keys(BESIDE) as ReadonlyArray<keyof typeof BESIDE>) {
    let held: Taped<unknown> | undefined
    Object.defineProperty(reading, which, {
      enumerable: true,
      get: () => held ??= new Taped(tableIn(at, which), which, tape),
    })
  }
  return { reading: reading as unknown as Reading, tape }
}

export const stillHolds = (tape: Tape, was: Reading, now: Reading): boolean => {
  if (was.claims !== now.claims) return false
  if (was === now) return true
  for (const which of tape.lists) {
    if (!carriedList(was.derived, now.derived, which)) return false
  }
  if (tape.documents && !carriedSet(was.set, now.set).documents) return false
  if (tape.broken && !carriedSet(was.set, now.set).broken) return false
  for (const which of tape.walked) {
    if (!carriedIndex(was, now, which)) return false
  }
  for (const [which, own] of tape.keyed) {
    const index = tableIn(now, which)
    for (const [key, held] of own) if (!carried(held, index.get(key))) return false
  }
  return true
}

const carried = (was: unknown, now: unknown): boolean => {
  if (was === now) return true
  if (Array.isArray(was) && Array.isArray(now)) {
    return was.length === now.length && was.every((one, at) => one === now[at])
  }
  if (was instanceof Set && now instanceof Set) {
    if (was.size !== now.size) return false
    for (const one of was) if (!now.has(one)) return false
    return true
  }
  return false
}

interface Carried {
  readonly against: Derived
  readonly indexes: Map<Table, boolean>
  readonly lists: Map<keyof typeof LISTS, boolean>
}

const comparedIndexes = new WeakMap<Derived, Carried>()

const carriedIndex = (was: Reading, now: Reading, which: Table): boolean => {
  const held = comparing(was.derived, now.derived)
  const answered = held.indexes.get(which)
  if (answered !== undefined) return answered
  const same = sameIndex(tableIn(was, which), tableIn(now, which))
  held.indexes.set(which, same)
  return same
}

const carriedList = (was: Derived, now: Derived, which: keyof typeof LISTS): boolean => {
  const held = comparing(was, now)
  const answered = held.lists.get(which)
  if (answered !== undefined) return answered
  const same = carried(was[which], now[which])
  held.lists.set(which, same)
  return same
}

const comparing = (was: Derived, now: Derived): Carried => {
  const held = comparedIndexes.get(was)
  if (held !== undefined && held.against === now) return held
  const fresh: Carried = { against: now, indexes: new Map(), lists: new Map() }
  comparedIndexes.set(was, fresh)
  return fresh
}

const sameIndex = (
  was: ReadonlyMap<string, unknown>,
  now: ReadonlyMap<string, unknown>,
): boolean => {
  if (was === now) return true
  if (was.size !== now.size) return false
  const walk = now[Symbol.iterator]()
  for (const [key, held] of was) {
    const other = walk.next()
    if (other.done === true) return false
    if (other.value[0] !== key) return false
    if (!carried(held, other.value[1])) return false
  }
  return true
}

interface CarriedSet {
  readonly against: OutlineSet
  readonly documents: boolean
  readonly broken: boolean
}

const comparedSets = new WeakMap<OutlineSet, CarriedSet>()

const carriedSet = (was: OutlineSet, now: OutlineSet): CarriedSet => {
  const held = comparedSets.get(was)
  if (held !== undefined && held.against === now) return held
  const fresh: CarriedSet = {
    against: now,
    documents: sameFaces(was.documents, now.documents),
    broken: sameBroken(was.broken, now.broken),
  }
  comparedSets.set(was, fresh)
  return fresh
}

const sameFaces = (was: ReadonlyArray<Face>, now: ReadonlyArray<Face>): boolean => {
  if (was === now) return true
  if (was.length !== now.length) return false
  return was.every((one, at) => one === now[at] || sameFace(one, now[at] as Face))
}

const sameBroken = (
  was: ReadonlyArray<BrokenFile>,
  now: ReadonlyArray<BrokenFile>,
): boolean => {
  if (was === now) return true
  if (was.length !== now.length) return false
  return was.every((one, at) => one === now[at])
}
