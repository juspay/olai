/**
 * An index carried across a patch WITHOUT copying it.
 *
 * {@link ./patch.ts} answers a one-file edit by rebuilding only what depended
 * on that file — and then paid for a whole `new Map(index)` per index anyway,
 * one clone of an entry per key in the directory, so that the revision a
 * reader is holding could not move under them. On a 21,552-record vault the
 * `byId` clone alone is ABOUT HALF of a patch, which `patch.bench.ts` prints
 * as `patch+clone` against `patch` — and all of them together are most of what
 * is left once the work the edit really caused is taken out. This is the lever
 * open question 1 of `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/model-indices.md` named: a LAYER over
 * the map the last patch left standing, holding the entries this one changed,
 * so an edit costs what it touched rather than what the directory holds.
 *
 * WHAT IT IS EQUAL TO is the whole of its contract, and it is one line:
 *
 *     overlay(base) — written to — sealed()  ≡  new Map(base), written to
 *
 * Same answers, same `size`, same key order, same iteration — a `ReadonlyMap`
 * a caller cannot tell from the clone it replaces, which is why nothing that
 * reads {@link ./derive.ts}'s indexes had to learn about it. Key order is not
 * a detail: the did-you-mean behind every unknown-target error walks its map's
 * keys and promises that ties go to the first candidate offered
 * ({@link ./suggest.ts}), and three more of them promise their keys in an order
 * of their own. So the layer keeps `Map`'s own rule to the letter — a
 * key re-set keeps its place, a key deleted leaves and takes its place with
 * it, and a key added, or DELETED AND SET AGAIN, goes to the end.
 *
 * IT DELETES, and that is the whole of what changed here. The first layer kept
 * `base`'s key set exactly — size, `has` and `keys` were the underlying map's
 * own answers and cost nothing — and the price of that was that only ONE of its
 * caller's maps could have one, since a patch drops keys from nearly all
 * of them (a tag nothing writes any more has to leave that index rather than
 * stand there empty). This file used to say so and stop there, which was a fact
 * about the layer as BUILT dressed as one about layers. A tombstone set
 * beside the changed values is what it costs to say it properly: `size` is a
 * subtraction, `has` is one extra lookup, and `keys` is a walk that skips.
 * That is a real price and it is paid PER READ, which is what decides where a
 * layer goes rather than whether one can exist —
 *
 * WHICH IS THE RULE THIS MODULE IS FOR: a map read BY KEY gets a layer, a map
 * read WHOLE stays a map ({@link Overlay.sealed}'s one argument). A lookup
 * through a layer is a small map's miss on the way past, bounded by what the
 * edit wrote and not by what the map holds; a WALK pays that miss once per
 * entry, which costs more than the clone it would have saved. Which side each
 * of its caller's maps is on is its caller's own fact and is written down there
 * ({@link ./derive.ts}'s `READ`, one row per index, with the readers that
 * decided it named). `patch.bench.ts` prints what each half costs.
 *
 * WHY NOT A PERSISTENT MAP, which is the other half of what the open question
 * offered and would have cost nothing to import: `effect`'s `HashMap` is
 * already in this package's dependencies and is exactly the structure — a HAMT
 * with structural sharing, where a change costs the path to it. It is ruled out
 * by the key-order paragraph above and by the one after it. A HAMT iterates in
 * HASH order, and three of the maps this carries promise a key order a reader
 * spends; and it is not a `ReadonlyMap` — `get` answers with an `Option` — so
 * adopting it would rewrite the hundred-odd call sites that read them across
 * three packages, to reach a structure this one is not asking for. What a patch
 * does to an index is set and delete at keys it mostly already has: the
 * narrowest structure that does that is a layer, and the narrowest structure is
 * the one whose promises can be checked.
 *
 * IT IS COPY-ON-WRITE AND NOT A MUTATION. `base` is never touched, and the
 * value it gave a key stays whatever it was — a reader holding the previous
 * map goes on being answered by it. That is the property the clone was there
 * for, kept at the cost of the layer rather than of the corpus.
 *
 * AND THE COPY IS TAKEN AT THE FIRST WRITE, in both spellings and for one
 * reason: a patch opens every index of the view and writes to the few keys its
 * edit reached, so what the rest must cost is NOTHING. A map read whole is not
 * cloned until something is set in it, and a layer handed on is carried BY
 * REFERENCE — its three structures shared with the revision that sealed them —
 * until a write copies all three and goes into those. Constructing used to take
 * those three copies, which is three per index per keystroke thrown away
 * untouched, against a layer that may hold half the corpus before it flattens
 * (`perf-overlay-copies`).
 *
 * WHICH MAKES THE SHARING LOAD-BEARING, so it is a law here rather than an
 * economy: what an unwritten overlay holds belongs to the revision that sealed
 * it, and no reader of that revision may see this one's write through it. The
 * only writable handle in this file is what {@link Overlay.own} hands back, it
 * is minted by copying, and every field a read goes through is `Readonly` — so
 * a write that skipped the copy would not typecheck rather than being caught by
 * a test. `./overlay.test.ts` pins it from the READER's seat regardless, a
 * revision behind, because what the compiler cannot say is which structure a
 * value already in hand came out of.
 *
 * WHEN IT DECLINES, and it does so silently because both answers are the same
 * value, only one is cheaper to reach:
 *
 *   - a sealing that was never written to hands back WHAT IT WAS GIVEN — the
 *     map, or the layer the patch before it left. Nothing touched, nothing
 *     copied to get there AND nothing copied on the way in, which is the
 *     paragraph below: an edit that moves no key of a map pays nothing for it,
 *     whichever way that map is read;
 *   - an index sealed as read WHOLE flattens, which is the clone, taken
 *     deliberately;
 *   - a layer grown past HALF the map flattens too. The layer is copied per
 *     patch, so it is what the next patch pays; letting it grow without bound
 *     would walk back to the clone this exists to avoid. Flattened at a half, a
 *     patch never copies more than half the map — and in the case that matters
 *     it copies nothing like that: successive edits to one file re-set the ids
 *     already in the layer, so a session of typing holds a layer the size of
 *     that file. Both cases are timed — the leg's two `lever` rows — and the
 *     flatten is printed with the edit it happened at, which on the 1,000-file
 *     vault is edit 489 of 900 wandering ones and never at all when one file is
 *     typed in. The default forty-edit run never reaches it.
 *
 * WHAT IT COSTS A READER is one lookup on the way past, and two when the edit
 * dropped a key: the layer is asked first, then — only if anything left — the
 * keys it dropped, and then `base`. That is the trade, and it is deliberate:
 * the layer is small, a missed lookup in a small map is a hash the engine has
 * already computed for the string once, and the walk it buys back is
 * corpus-sized. It is `get` and `has` that pay it, and those are how every
 * by-key caller reads; a whole-index SPREAD pays it once per entry, which is
 * exactly what the sealing argument is for. `patch.bench.ts` times both — the
 * `get` walk the validator asks on every write, and the whole-index walk — so
 * the trade is a measurement rather than a claim.
 *
 * WHAT IT HOLDS ONTO: `base` keeps the values the layer covers, so a layered
 * map retains the entries the edit replaced until it flattens. Bounded by the
 * same half above, and gone at the next flatten.
 *
 * IT KNOWS NOTHING ABOUT OUTLINES, and it lives here anyway: this package is
 * the floor of the tree (`docs/architecture.md`), so the lowest honest home for
 * a structure with one consumer in it is beside that consumer. Population one
 * is the reason it is not somewhere shared yet rather than an argument that it
 * never should be — a second caller, here or in kolu, is what would move it,
 * and nothing about the shape would have to change when it does.
 */

/**
 * How the map being carried is READ, which is the whole of what decides which
 * of the two spellings below it gets.
 *
 * Not a hint and not a hint's opposite: both answers are the same map, and the
 * word only says which way of reaching it is cheaper for THIS one. It is taken
 * at the CALL rather than kept in a table here, because the fact it names is a
 * fact about the map's readers — who they are and what they ask — and this
 * module has never heard of them. Its caller keeps that table
 * ({@link ./derive.ts}'s `READ`, one row per index).
 */
export type Read = "by key" | "whole"

/**
 * A map being written across ONE patch, and sealed into the value it leaves.
 *
 * Four verbs and no more: what a key holds, whether it is there, set, delete —
 * which is the whole of what a patch does to an index. {@link overlay} answers
 * with one of the two shapes behind it, and nothing above can tell which: a
 * CLONE for a map somebody walks whole, a LAYER for a map everybody asks by
 * key. That is what lets the rule that files a key across an edit be written
 * once and run over either ({@link ./patch.ts}'s `filedAt`).
 */
export interface Editable<K, V> {
  get(key: K): V | undefined
  has(key: K): boolean
  /** Sets, and answers whether the key was MINTED — absent here before this
   *  call. The one caller that asks needs exactly that ({@link ./patch.ts}'s
   *  `filedAt`, for whether the KEY SET moved), and the write has already
   *  looked, so asking separately is the same question put twice. */
  set(key: K, value: V): boolean
  delete(key: K): boolean
  /** The map this patch leaves standing. SPENDS this: what it hands over is
   *  what was being written, so a write afterwards would move a value under a
   *  reader and is refused rather than allowed to. */
  sealed(): ReadonlyMap<K, V>
}

/** `base`, ready to be written to and sealed — the one shape every index of a
 *  patch is carried across the edit in, in whichever of the two spellings its
 *  own readers make cheaper. */
export const overlay = <K, V extends {}>(
  base: ReadonlyMap<K, V>,
  read: Read,
): Editable<K, V> => (read === "whole" ? new Cloned(base) : new Overlay(base))

/** What one patch did to a map, as the two shapes below both hold it — the
 *  fields the one reading rule reads, named so it can be written once. */
interface Held<K, V extends {}> {
  readonly base: ReadonlyMap<K, V>
  readonly changed: ReadonlyMap<K, V>
  readonly gone: ReadonlySet<K>
}

/**
 * What a key answers: what the edit CHANGED wins, then what it DROPPED, then
 * the map that stood.
 *
 * ONE SPELLING, asked by an overlay while it is being written and by the layer
 * it seals into — because the moment the second takes over from the first is
 * exactly where two spellings would be free to disagree, and the property test
 * next door compares a half-written overlay against the sealed map it becomes.
 *
 * The tombstone probe is skipped when the edit dropped nothing, which is most
 * edits and every edit to the corpus-sized index: a layer over a map with no
 * key removed reads in two lookups, the same as the value-only layer this
 * grew out of.
 */
const gotAt = <K, V extends {}>(held: Held<K, V>, key: K): V | undefined => {
  const own = held.changed.get(key)
  if (own !== undefined) return own
  return held.gone.size !== 0 && held.gone.has(key) ? undefined : held.base.get(key)
}

/** {@link gotAt}'s question asked about presence alone — the same rule, and
 *  here for the same reason. */
const hasAt = <K, V extends {}>(held: Held<K, V>, key: K): boolean =>
  held.changed.has(key) ||
  ((held.gone.size === 0 || !held.gone.has(key)) && held.base.has(key))

/** What a sealed overlay refuses. */
const SPENT = "this overlay was sealed — what it held belongs to the map it left"

/**
 * WHAT AN OVERLAY OVER A PLAIN MAP STARTS FROM, shared by every one of them and
 * written to by none.
 *
 * An overlay carrying a LAYER starts from that layer's own three structures.
 * The other case — a plain map, which is what a flatten and a first derive both
 * leave — has nothing to start from, and minting three empty ones per index per
 * patch to have something would be a smaller spelling of the allocation this
 * module just stopped making. So they are minted ONCE, and shared for the same
 * reason a layer's own three are: nothing here can write through a `Readonly`
 * field, and the copy {@link Overlay.own} takes is what every write goes into.
 */
const NOTHING: ReadonlyMap<never, never> = new Map<never, never>()
const NOBODY: ReadonlySet<never> = new Set<never>()

/**
 * A map carried across the edit BY CLONING it, which is what a map somebody
 * walks whole gets.
 *
 * The whole of it, and it is deliberately the boring one: a layer would make
 * every entry of every walk pay a lookup it cannot answer, which costs more
 * than the copy it saved (the module header argues it, `./patch.bench.ts`
 * prices it). What is left worth saying is the COPY-ON-FIRST-WRITE — an edit
 * that touches no key of this map hands back the very map it was given, so the
 * rule that a patch pays for what it touched holds for these too. It is the
 * discipline {@link Overlay} keeps as well, over three structures rather than
 * one; this is where it is easiest to read.
 */
class Cloned<K, V extends {}> implements Editable<K, V> {
  /** The copy, taken at the first write and not before. */
  private whole: Map<K, V> | undefined
  private spent = false

  constructor(private readonly given: ReadonlyMap<K, V>) {}

  /** The copy, taken now if it has not been. */
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
    // Asked before the copy is taken, so a delete of a key that is not there
    // does not mint a copy of the whole map to not-delete it in.
    return this.has(key) ? this.held.delete(key) : false
  }

  sealed(): ReadonlyMap<K, V> {
    this.spent = true
    return this.whole ?? this.given
  }
}

/**
 * THE THREE STRUCTURES OF A LAYER, OWNED — what {@link Overlay.own} copies the
 * carried ones into.
 *
 * A type rather than three fields because it is one fact and is reached as one:
 * holding it is what "this patch wrote" means, and a write reaches it by asking
 * for it, so there is no spelling of a write that skips the copy.
 */
interface Mine<K, V extends {}> {
  readonly changed: Map<K, V>
  readonly appended: Set<K>
  readonly gone: Set<K>
}

/**
 * A map carried across the edit as a LAYER: what stood, plus what this patch
 * did to it, held apart until {@link Overlay.sealed} decides how to spell it.
 *
 * THE SAME THREE FIELDS {@link Layer} HOLDS, which is not a coincidence and is
 * the point: sealing hands them over rather than converting them, and the one
 * reading rule above is asked of both. `changed` is every value this answers
 * with — the replacements and the appendings in one map, so a read is one
 * lookup. `appended` is which of those keys sit past the end of `base`: one it
 * never had, and one that was DELETED AND SET AGAIN, because that is where a
 * `Map` puts it. `gone` is which keys of `base` are not here any more, and a
 * key in `appended` too is one that came back.
 *
 * AND IT DOES NOT HOLD THEM UNTIL IT IS WRITTEN TO. Handed a layer, the three
 * below ARE that layer's own three, shared with every reader still holding it,
 * and they stay shared until {@link Overlay.own} copies them for the first
 * write. So they are declared `Readonly` and the copy is declared {@link Mine},
 * which is what makes "an unwritten layer is immutable from every reader's
 * seat" a thing the compiler keeps rather than a thing this comment asks for.
 */
class Overlay<K, V extends {}> implements Editable<K, V> {
  readonly base: ReadonlyMap<K, V>
  /** Shared with the revision that sealed it until the first write. */
  changed: ReadonlyMap<K, V>
  /** Shared with the revision that sealed it until the first write. */
  appended: ReadonlySet<K>
  /** Shared with the revision that sealed it until the first write. */
  gone: ReadonlySet<K>
  /** What this was handed, which is what an untouched sealing gives back. */
  private readonly given: ReadonlyMap<K, V>
  /** The three ONCE THEY ARE OURS — the only writable handle in this file, and
   *  `undefined` until a write minted it by copying.
   *
   *  It is also the answer to whether THIS patch wrote anything, which is not
   *  the same question as whether the three above are empty: a layer handed in
   *  arrives with its own contents in them, so an edit that does nothing to a
   *  map has to hand that layer back rather than build an equal one beside it.
   *  One field for both because they became one fact — what makes an overlay
   *  written-to is the copy it took to write into. */
  private mine: Mine<K, V> | undefined
  private spent = false

  constructor(given: ReadonlyMap<K, V>) {
    // A layer over a layer is one layer, never a chain: a read walks what it is
    // handed, and a chain would make it cost the session's history. What the
    // layer already held becomes this patch's own starting point, and the map
    // underneath becomes the base.
    //
    // TAKEN BY REFERENCE, which is the whole of `perf-overlay-copies`: these
    // three are the sealed layer's own, and stay its own until a write copies
    // them. An index this patch does not touch is carried for nothing.
    const held = given instanceof Layer ? (given as Layer<K, V>) : undefined
    this.given = given
    this.base = held?.base ?? given
    this.changed = held?.changed ?? NOTHING
    this.appended = held?.appended ?? NOBODY
    this.gone = held?.gone ?? NOBODY
  }

  /**
   * THE THREE, OURS — copied here on the first write and handed straight back
   * on every one after it.
   *
   * The one place this module copies its bookkeeping, and the one place a write
   * can reach it: every field above is `Readonly`, so a set or a delete that
   * did not come through here has nowhere to put anything. That is what makes
   * the sharing above checkable rather than remembered — the aliasing law is
   * "copy before you touch", and there is exactly one touch.
   *
   * ALL THREE AT ONCE rather than one per structure. A write reaches `changed`
   * always and the other two often, so three flags would buy the copy of an
   * empty `Set` back on the path where the layer is grown by typing — where
   * `appended` and `gone` are empty and `changed` is what is large — and cost
   * two more states for anything reading this to hold.
   */
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
    // Already ours, and it keeps wherever it sits: a `Map` re-set at a key does
    // not move it.
    if (mine.changed.has(key)) {
      mine.changed.set(key, value)
      return false
    }
    // Not ours yet, so it is either a live key of `base` — a replacement, at
    // `base`'s own place for it — or absent, which covers both a key nothing
    // ever held and one this edit deleted, and both of those go to the END.
    const live = this.base.has(key) && !(mine.gone.size !== 0 && mine.gone.has(key))
    if (!live) mine.appended.add(key)
    mine.changed.set(key, value)
    return !live
  }

  delete(key: K): boolean {
    if (this.spent) throw new Error(SPENT)
    // Asked BEFORE the copy is taken, so a delete of a key that is not there
    // does not mint one to not-delete it in — {@link Cloned.delete}'s line, and
    // here it is three structures rather than the map.
    if (!this.has(key)) return false
    const mine = this.own()
    mine.changed.delete(key)
    // An APPENDED key simply goes; a key of `base` leaves a tombstone, which is
    // what tells the walk to step over it. A key that was both — deleted, set
    // again, deleted again — keeps the tombstone it already had.
    if (!mine.appended.delete(key)) mine.gone.add(key)
    return true
  }

  /**
   * The map this patch leaves standing — a layer where that is the cheaper way
   * to it, and a real map where it is not.
   *
   * The two other answers are decided here rather than by a caller: a map this
   * edit never wrote to is handed back UNTOUCHED, and a layer whose own
   * contents have grown past half its base is flattened, because past that the
   * layer is what the next patch copies.
   *
   * IT SPENDS THE OVERLAY. What the layer is handed is what was being written,
   * not a copy of it — three structures rather than three copies of them, on
   * the step this module exists to keep small. What that costs is a rule, and
   * the rule is kept by refusing rather than by remembering: a write after this
   * throws, where a defensive copy would have made it silently harmless and
   * still wrong.
   */
  sealed(): ReadonlyMap<K, V> {
    this.spent = true
    const mine = this.mine
    if (mine === undefined) return this.given
    // WHAT THE NEXT PATCH COPIES, which is what the half is about: an overlay
    // handed a layer takes these three over, so their size is the price of
    // carrying one more edit rather than a count of keys this edit touched —
    // and it is a price the next patch pays only if it writes.
    const carried = mine.changed.size + mine.appended.size + mine.gone.size
    if (carried * 2 > this.base.size) return this.flattened(mine)
    return new Layer(this.base, mine.changed, mine.appended, mine.gone)
  }

  /** The real map, built from `base` and written the way this overlay was —
   *  which is the clone the layer exists to avoid, taken on purpose. */
  private flattened(mine: Mine<K, V>): ReadonlyMap<K, V> {
    const whole = new Map(this.base)
    // Dropped FIRST, so that a key deleted and set again comes back at the end
    // — which is where a `Map` puts it, and the one order a layer that
    // remembered values alone would get wrong.
    for (const key of mine.gone) whole.delete(key)
    for (const [key, value] of mine.changed) whole.set(key, value)
    return whole
  }
}

/**
 * The layer itself: a map, plus what one patch did to it.
 *
 * Not exported, and there is no way to ask a map whether it is one. What
 * {@link Overlay.sealed} returns is a `ReadonlyMap`, because a caller that
 * could tell would be a caller with two paths to keep in step — and the one
 * place the distinction is real (a layer over a layer) is the constructor of
 * {@link Overlay}, which is the only thing that makes one.
 *
 * Its three fields are {@link Overlay}'s three fields, handed over rather than
 * copied, and it never writes to them.
 */
class Layer<K, V extends {}> implements ReadonlyMap<K, V> {
  constructor(
    readonly base: ReadonlyMap<K, V>,
    /** Every value this layer answers with — the replacements and the
     *  appendings in one map, so a `get` is ONE lookup rather than two. */
    readonly changed: ReadonlyMap<K, V>,
    /** Which of those keys sit past the end of `base`, in the order they went
     *  there — the only thing `changed` cannot say for itself. */
    readonly appended: ReadonlySet<K>,
    /** Keys of `base` that are not here any more. A key in `appended` too is
     *  one that came back, and `changed` answering first is what says so. */
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

  /** `base`'s own iterator when this edit neither dropped a key nor added one,
   *  which is every edit to the corpus-sized index — its layer is taken only
   *  when nothing was minted, moved or dropped ({@link ./patch.ts}'s `ids`), so
   *  the walk that reads it whole is the map's own and costs nothing at all. */
  keys(): MapIterator<K> {
    return this.gone.size === 0 && this.appended.size === 0
      ? this.base.keys()
      : this.walked()
  }

  /** `base`'s order with the dropped keys skipped, then whatever went past the
   *  end — which is where a `Map` would have left them. */
  private *walked(): MapIterator<K> {
    for (const key of this.base.keys()) if (!this.gone.has(key)) yield key
    yield* this.appended
  }

  /**
   * The whole map, in order, WITHOUT asking `base` twice.
   *
   * It is {@link gotAt}'s rule with `base`'s answer already in hand — the one
   * place that rule is spelled a second time, and the reason is that a walk has
   * the value the rule would go and look up. Everything else here goes through
   * this one.
   */
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
