export type Read = "by key" | "whole"

export interface Editable<K, V> {
  get(key: K): V | undefined
  has(key: K): boolean
  set(key: K, value: V): boolean
  delete(key: K): boolean
  sealed(): ReadonlyMap<K, V>
}

export const overlay = <K, V extends {}>(
  base: ReadonlyMap<K, V>,
  read: Read,
): Editable<K, V> => (read === "whole" ? new Cloned(base) : new Overlay(base))

interface Held<K, V extends {}> {
  readonly base: ReadonlyMap<K, V>
  readonly changed: ReadonlyMap<K, V>
  readonly gone: ReadonlySet<K>
}

const gotAt = <K, V extends {}>(held: Held<K, V>, key: K): V | undefined => {
  const own = held.changed.get(key)
  if (own !== undefined) return own
  return held.gone.size !== 0 && held.gone.has(key) ? undefined : held.base.get(key)
}

const hasAt = <K, V extends {}>(held: Held<K, V>, key: K): boolean =>
  held.changed.has(key) ||
  ((held.gone.size === 0 || !held.gone.has(key)) && held.base.has(key))

const SPENT = "this overlay was sealed — what it held belongs to the map it left"

const NOTHING: ReadonlyMap<never, never> = new Map<never, never>()
const NOBODY: ReadonlySet<never> = new Set<never>()

class Cloned<K, V extends {}> implements Editable<K, V> {
  private whole: Map<K, V> | undefined
  private spent = false

  constructor(private readonly given: ReadonlyMap<K, V>) {}

  private get held(): Map<K, V> {
    return (this.whole ??= new Map(this.given))
  }

  get(key: K): V | undefined {
    return (this.whole ?? this.given).get(key)
  }

  has(key: K): boolean {
    return (this.whole ?? this.given).has(key)
  }

  set(key: K, value: V): boolean {
    if (this.spent) throw new Error(SPENT)
    const held = this.held
    const minted = !held.has(key)
    held.set(key, value)
    return minted
  }

  delete(key: K): boolean {
    if (this.spent) throw new Error(SPENT)
    return this.has(key) ? this.held.delete(key) : false
  }

  sealed(): ReadonlyMap<K, V> {
    this.spent = true
    return this.whole ?? this.given
  }
}

interface Mine<K, V extends {}> {
  readonly changed: Map<K, V>
  readonly appended: Set<K>
  readonly gone: Set<K>
}

class Overlay<K, V extends {}> implements Editable<K, V> {
  readonly base: ReadonlyMap<K, V>
  changed: ReadonlyMap<K, V>
  appended: ReadonlySet<K>
  gone: ReadonlySet<K>
  private readonly given: ReadonlyMap<K, V>
  private mine: Mine<K, V> | undefined
  private spent = false

  constructor(given: ReadonlyMap<K, V>) {
    const held = given instanceof Layer ? (given as Layer<K, V>) : undefined
    this.given = given
    this.base = held?.base ?? given
    this.changed = held?.changed ?? NOTHING
    this.appended = held?.appended ?? NOBODY
    this.gone = held?.gone ?? NOBODY
  }

  private own(): Mine<K, V> {
    const held = this.mine
    if (held !== undefined) return held
    const taken: Mine<K, V> = {
      changed: new Map(this.changed),
      appended: new Set(this.appended),
      gone: new Set(this.gone),
    }
    this.changed = taken.changed
    this.appended = taken.appended
    this.gone = taken.gone
    this.mine = taken
    return taken
  }

  get(key: K): V | undefined {
    return gotAt(this, key)
  }

  has(key: K): boolean {
    return hasAt(this, key)
  }

  set(key: K, value: V): boolean {
    if (this.spent) throw new Error(SPENT)
    const mine = this.own()
    if (mine.changed.has(key)) {
      mine.changed.set(key, value)
      return false
    }
    const live = this.base.has(key) && !(mine.gone.size !== 0 && mine.gone.has(key))
    if (!live) mine.appended.add(key)
    mine.changed.set(key, value)
    return !live
  }

  delete(key: K): boolean {
    if (this.spent) throw new Error(SPENT)
    if (!this.has(key)) return false
    const mine = this.own()
    mine.changed.delete(key)
    if (!mine.appended.delete(key)) mine.gone.add(key)
    return true
  }

  sealed(): ReadonlyMap<K, V> {
    this.spent = true
    const mine = this.mine
    if (mine === undefined) return this.given
    const carried = mine.changed.size + mine.appended.size + mine.gone.size
    if (carried * 2 > this.base.size) return this.flattened(mine)
    return new Layer(this.base, mine.changed, mine.appended, mine.gone)
  }

  private flattened(mine: Mine<K, V>): ReadonlyMap<K, V> {
    const whole = new Map(this.base)
    for (const key of mine.gone) whole.delete(key)
    for (const [key, value] of mine.changed) whole.set(key, value)
    return whole
  }
}

class Layer<K, V extends {}> implements ReadonlyMap<K, V> {
  constructor(
    readonly base: ReadonlyMap<K, V>,
    readonly changed: ReadonlyMap<K, V>,
    readonly appended: ReadonlySet<K>,
    readonly gone: ReadonlySet<K>,
  ) {}

  get size(): number {
    return this.base.size - this.gone.size + this.appended.size
  }

  has(key: K): boolean {
    return hasAt(this, key)
  }

  get(key: K): V | undefined {
    return gotAt(this, key)
  }

  keys(): MapIterator<K> {
    return this.gone.size === 0 && this.appended.size === 0
      ? this.base.keys()
      : this.walked()
  }

  private *walked(): MapIterator<K> {
    for (const key of this.base.keys()) if (!this.gone.has(key)) yield key
    yield* this.appended
  }

  *entries(): MapIterator<[K, V]> {
    const dropped = this.gone.size !== 0
    for (const [key, value] of this.base) {
      if (dropped && this.gone.has(key)) continue
      yield [key, this.changed.get(key) ?? value]
    }
    for (const key of this.appended) yield [key, this.changed.get(key) as V]
  }

  *values(): MapIterator<V> {
    for (const [, value] of this.entries()) yield value
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }

  forEach(
    each: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.entries()) each.call(thisArg, value, key, this)
  }
}
