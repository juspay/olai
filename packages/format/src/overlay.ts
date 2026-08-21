/**
 * An index carried across a patch WITHOUT copying it.
 *
 * {@link ./patch.ts} answers a one-file edit by rebuilding only what depended
 * on that file — and then paid for a whole `new Map(index)` per index anyway,
 * one clone of an entry per key in the directory, so that the revision a
 * reader is holding could not move under them. On a 21,552-record vault the
 * `byId` clone alone is ABOUT HALF of a patch, which `patch.bench.ts` prints
 * as `patch+clone` against `patch` — and the eleven together are most of what
 * is left once the work the edit really caused is taken out. This is the lever
 * open question 1 of `docs/brainstorming/model-indices.md` named: a LAYER over
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
 * a detail: the did-you-mean behind every unknown-target error walks
 * `byId`'s keys and promises that ties go to the first candidate offered
 * ({@link ./suggest.ts}), and three of the eleven promise their keys in an
 * order of their own. So the layer keeps `Map`'s own rule to the letter — a
 * key re-set keeps its place, a key deleted leaves and takes its place with
 * it, and a key added, or DELETED AND SET AGAIN, goes to the end.
 *
 * IT DELETES, and that is the whole of what changed here. The first layer kept
 * `base`'s key set exactly — size, `has` and `keys` were the underlying map's
 * own answers and cost nothing — and the price of that was that none of the ten
 * indexes beside `byId` could have one, since a patch drops keys from nearly
 * all of them (a tag nothing writes any more has to leave `taggedBy` rather
 * than stand there empty). This file used to say so and stop there, which was a
 * fact about the layer as BUILT dressed as one about layers. A tombstone set
 * beside the changed values is what it costs to say it properly: `size` is a
 * subtraction, `has` is one extra lookup, and `keys` is a walk that skips.
 * That is a real price and it is paid PER READ, which is what decides where a
 * layer goes rather than whether one can exist —
 *
 * WHICH IS THE RULE THIS MODULE IS FOR, and the patcher spells it at every
 * call: an index read BY KEY gets a layer, an index read WHOLE stays a map
 * ({@link Overlay.sealed}'s one argument). `byId.get(id)` is what every
 * production caller asks, and a lookup through a layer is a small map's miss
 * on the way past — bounded by the edit, not by the corpus. `namedBy` is
 * walked entry by entry by the validator ({@link ./validate.ts}'s
 * `checkTargets`), `taggedBy` by tag completion, `byDay` by the agenda and the
 * calendar, `byFile` by whoever wants the corpus flat — and for those a walk
 * through the generator below costs more per entry than the clone it would
 * save. The two halves are seven and four, they are named at the calls, and
 * `patch.bench.ts` prints what each half costs.
 *
 * WHY NOT A PERSISTENT MAP, which is the other half of what the open question
 * offered and would have cost nothing to import: `effect`'s `HashMap` is
 * already in this package's dependencies and is exactly the structure — a HAMT
 * with structural sharing, where a change costs the path to it. It is ruled out
 * by the key-order paragraph above and by the one after it. A HAMT iterates in
 * HASH order, and three of these indexes promise a key order a reader spends;
 * and it is not a `ReadonlyMap` — `get` answers with an `Option` — so adopting
 * it would rewrite the hundred-odd call sites that read these indexes across
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
 * WHEN IT DECLINES, and it does so silently because both answers are the same
 * value, only one is cheaper to reach:
 *
 *   - a sealing that was never written to hands back `base` ITSELF. Nothing
 *     touched, nothing cloned — an edit that tags nothing pays nothing for
 *     `taggedBy`, whichever way that index is read;
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
 * WHAT IT COSTS A READER is two lookups on the way past: a key the layer does
 * not hold is looked for there, and among the keys it dropped, before `base`
 * answers. That is the trade, and it is deliberate — the layer is small, a
 * missed lookup in a small map is a hash the engine has already computed for
 * the string once, and the walk it buys back is corpus-sized. It is `get` and
 * `has` that pay it, and those are how every by-key caller reads these
 * indexes; a whole-index SPREAD pays it once per entry, which is exactly what
 * the sealing argument is for. `patch.bench.ts` times both — the `get` walk the
 * validator asks on every write, and the whole-index walk the readings above
 * ask — so the trade is a measurement rather than a claim.
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
 * How the index being sealed is READ, which is the whole of what decides
 * whether it gets a layer.
 *
 * Not a hint and not a hint's opposite: both answers are the same map, and the
 * word only says which way of reaching it is cheaper for THIS index. It is
 * stated at the call rather than kept in a table here, because the fact it
 * names is a fact about the index's readers — who they are and what they ask —
 * and this module has never heard of them.
 */
export type Read = "by key" | "whole"

/**
 * WRITING to an index: set at a key, delete at a key, ask whether a key is
 * there. Exactly what the one rule below it needs and nothing more.
 *
 * Both a `Map` and an {@link Overlay} are one, which is what lets the rule that
 * files a key across an edit be written once and run over either — over a layer
 * for the index read by key, over a clone for the three read whole
 * ({@link ./patch.ts}'s `filedAt`).
 */
export interface Editable<K, V> {
  has(key: K): boolean
  set(key: K, value: V): void
  delete(key: K): boolean
}

/** `base`, ready to be written to and sealed — the one shape every index of a
 *  patch is carried across the edit in. */
export const overlay = <K, V extends {}>(base: ReadonlyMap<K, V>): Overlay<K, V> =>
  new Overlay(base)

/**
 * A map being written across one patch: what stood, plus what this edit did to
 * it, held apart until {@link Overlay.sealed} decides how to spell the answer.
 *
 * THREE PLACES A WRITE CAN LAND, and the third is the only one that is not
 * obvious. `over` holds a value replacing one `base` already had, and the key
 * keeps `base`'s place for it. `gone` holds a key of `base` this edit deleted.
 * `tail` holds a key that goes to the END: one `base` never had, and one that
 * was deleted and then set again — because that is where a `Map` puts it, and
 * the contract above is that a caller cannot tell the two apart.
 *
 * The three are disjoint by construction except for the one overlap that is the
 * point: a key in `gone` may also be in `tail`, which is exactly the
 * deleted-then-set case, and every reading below asks `tail` first so that it
 * wins.
 */
class Overlay<K, V extends {}> implements Editable<K, V> {
  /** Values replacing ones `base` holds, at `base`'s own places. */
  private readonly over = new Map<K, V>()
  /** Keys appended past the end of `base` — arrived, or deleted and set again. */
  private readonly tail = new Map<K, V>()
  /** Keys of `base` this edit deleted. May also be in `tail`. */
  private readonly gone = new Set<K>()
  /** Whether THIS patch wrote anything at all, which is not the same question
   *  as whether the three above are empty: a layer handed in arrives with its
   *  own contents in them, so an edit that does nothing to an index has to hand
   *  that layer back rather than build an equal one beside it. */
  private wrote = false
  /** What this was handed, which is what an untouched sealing gives back. */
  private readonly given: ReadonlyMap<K, V>

  constructor(private base: ReadonlyMap<K, V>) {
    this.given = base
    // A layer over a layer is one layer, never a chain: a read walks what it is
    // handed, and a chain would make it cost the session's history. What the
    // layer already held is taken over as this patch's own starting point, and
    // the map underneath becomes the base.
    if (base instanceof Layer) {
      const held = base as Layer<K, V>
      this.base = held.base
      for (const [key, value] of held.changed) {
        if (held.appended.has(key)) this.tail.set(key, value)
        else this.over.set(key, value)
      }
      for (const key of held.gone) this.gone.add(key)
    }
  }

  /** The three above, as the layer takes them: COPIED, so that a layer is a
   *  value the moment it is sealed. Nothing writes to an overlay after sealing
   *  it today — each of them is sealed at the end of the step that made it and
   *  dropped — but handing the live sets over would make that a rule somebody
   *  has to remember rather than one the shape keeps, and the copies are
   *  bounded by the edit. */
  private sealing(): Layer<K, V> {
    const changed = new Map(this.over)
    for (const [key, value] of this.tail) changed.set(key, value)
    return new Layer(this.base, changed, new Set(this.tail.keys()), new Set(this.gone))
  }

  get(key: K): V | undefined {
    const held = this.tail.get(key)
    if (held !== undefined) return held
    if (this.gone.has(key)) return undefined
    return this.over.get(key) ?? this.base.get(key)
  }

  has(key: K): boolean {
    return this.tail.has(key) || (!this.gone.has(key) && this.base.has(key))
  }

  set(key: K, value: V): void {
    // Already at the end, and it stays where it is: a `Map` re-set at a key
    // does not move it, wherever that key happens to be.
    this.wrote = true
    if (this.tail.has(key)) this.tail.set(key, value)
    else if (this.base.has(key) && !this.gone.has(key)) this.over.set(key, value)
    else this.tail.set(key, value)
  }

  delete(key: K): boolean {
    if (this.tail.delete(key)) {
      this.wrote = true
      return true
    }
    if (!this.base.has(key) || this.gone.has(key)) return false
    this.over.delete(key)
    this.gone.add(key)
    this.wrote = true
    return true
  }

  /**
   * The map this patch leaves standing — a layer where that is the cheaper way
   * to it, and a real map where it is not.
   *
   * THE ARGUMENT IS THE INDEX'S READERS and nothing else ({@link Read}). The
   * two other answers are decided here rather than by a caller: an index this
   * edit never wrote to is handed back UNTOUCHED, and a layer that has grown
   * past half its base is flattened, because past that the layer is what the
   * next patch copies.
   */
  sealed(read: Read): ReadonlyMap<K, V> {
    if (!this.wrote) return this.given
    const written = this.over.size + this.tail.size + this.gone.size
    if (read === "whole" || written * 2 > this.base.size) return this.flattened()
    return this.sealing()
  }

  /** The real map, built from `base` and written the way this overlay was —
   *  which is the clone the layer exists to avoid, taken on purpose. */
  private flattened(): ReadonlyMap<K, V> {
    const whole = new Map(this.base)
    for (const [key, value] of this.over) whole.set(key, value)
    for (const key of this.gone) whole.delete(key)
    for (const [key, value] of this.tail) whole.set(key, value)
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
 * The invariants every method below stands on: `changed` is `over` and
 * `appended` run together, `appended`'s keys come after every key of `base`
 * that survives, and a key in `gone` is a key of `base`.
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
    return this.changed.has(key) || (!this.gone.has(key) && this.base.has(key))
  }

  /** The ONE place the layer is read through, which every other reading below
   *  goes past: what a key answers is one rule, and a second spelling of it
   *  inside the walk would be a map that iterated to something other than what
   *  it answers one key at a time. */
  get(key: K): V | undefined {
    const held = this.changed.get(key)
    if (held !== undefined) return held
    return this.gone.has(key) ? undefined : this.base.get(key)
  }

  /** `base`'s order with the dropped keys skipped, then whatever went past the
   *  end — which is where a `Map` would have left them. */
  *keys(): MapIterator<K> {
    for (const key of this.base.keys()) if (!this.gone.has(key)) yield key
    yield* this.appended
  }

  *values(): MapIterator<V> {
    for (const key of this.keys()) yield this.get(key) as V
  }

  *entries(): MapIterator<[K, V]> {
    for (const key of this.keys()) yield [key, this.get(key) as V]
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
