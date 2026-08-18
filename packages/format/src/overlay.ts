/**
 * A map with a few entries changed, WITHOUT copying the map.
 *
 * {@link ./patch.ts} answers a one-file edit by rebuilding only what depended
 * on that file — and then paid for a whole `new Map(byId)` anyway, one clone of
 * an entry per record in the directory, so that the revision a reader is
 * holding could not move under them. On a 21,552-record vault that clone is
 * the largest single line in a patch — 0.4ms of one, which `patch.bench.ts`
 * prints as `patch+clone` against `patch` (1.35ms against 0.96ms, a 1.4×) and
 * again as the step on its own. This is the lever `docs/brainstorming/
 * model-indices.md`'s open question 1 named: a LAYER over the map the last
 * patch left standing, holding the entries this one changed, so an edit costs
 * what it touched rather than what the directory holds. Layered, the same step
 * costs 0.01ms where the edits wander and 0.002ms where they are one file
 * typed in, which is the case a keystroke is.
 *
 * WHAT IT IS EQUAL TO is the whole of its contract, and it is one line:
 *
 *     overlaid(base, changes)  ≡  new Map([...base, ...changes])
 *
 * Same answers, same `size`, same key order, same iteration — a `ReadonlyMap`
 * a caller cannot tell from the one it replaces, which is why nothing that
 * reads {@link ./derive.ts}'s `Derived.byId` had to learn about it. Key order
 * is not a detail here: the did-you-mean behind every unknown-target error
 * walks those keys and promises that ties go to the first candidate offered
 * ({@link ./suggest.ts}), so two readings of one set must offer them in one
 * order.
 *
 * WHY NOT A PERSISTENT MAP, which is the other half of what the open question
 * offered and would have cost nothing to import: `effect`'s `HashMap` is
 * already in this package's dependencies and is exactly the structure — a HAMT
 * with structural sharing, where a change costs the path to it. It is ruled out
 * by the paragraph above and by the one after it. A HAMT iterates in HASH
 * order, and `byId`'s key order is a promise a reader spends; and it is not a
 * `ReadonlyMap` — `get` answers with an `Option` — so adopting it would rewrite
 * the forty-odd call sites that read this index across three packages, to reach
 * a structure this one is not asking for. What a patch does to `byId` is
 * replace values at keys it already has: the narrowest structure that does that
 * is a layer, and the narrowest structure is the one whose promises can be
 * checked.
 *
 * IT IS COPY-ON-WRITE AND NOT A MUTATION. `base` is never touched, and the
 * value it gave a key stays whatever it was — a reader holding the previous
 * map goes on being answered by it. That is the property the clone was there
 * for, kept at the cost of the layer rather than of the corpus.
 *
 * WHEN IT DECLINES, and it does so silently because both answers are the same
 * value, only one is cheaper to reach:
 *
 *   - a change to a key the map does not already hold. The layer keeps `base`'s
 *     key order and `base`'s size, so it can replace a value and never add one;
 *     a new key means a real map. (The patcher never asks: an arriving id is an
 *     id whose place moved, and that is a case it rebuilds outright — see
 *     `patch.ts`'s `ids`.)
 *   - a layer grown past HALF the map. The layer is copied per patch, so it is
 *     what the next patch pays; letting it grow without bound would walk back
 *     to the clone this exists to avoid. Flattened at a half, a patch never
 *     copies more than half the map — and in the case that matters it copies
 *     nothing like that: successive edits to one file re-set the ids already in
 *     the layer, so a session of typing holds a layer the size of that file.
 *     Both cases are timed — the leg's two `lever` rows — and the flatten is
 *     printed with the edit it happened at, which on the 1,000-file vault is
 *     edit 489 of 900 wandering ones and never at all when one file is typed
 *     in. The default forty-edit run never reaches it.
 *
 * WHAT IT COSTS A READER is one extra lookup on the way past: a key the layer
 * does not hold is looked for there before `base` answers. That is the trade,
 * and it is deliberate — the layer is small, a missed lookup in a small map is
 * a hash the engine has already computed for the string once, and the walk it
 * buys back is corpus-sized. It is `get` that pays it, and `get` is how every
 * production caller reads this index; `has`, `size` and {@link Layer.keys} are
 * the underlying map's own answers and pay nothing, which is why the
 * did-you-mean's walk of `byId.keys()` is untouched. A whole-index SPREAD does
 * pay it once per entry — `values`, `entries` and `forEach` read through `get`
 * — and nothing in the tree spreads this index outside its tests.
 * `patch.bench.ts` times the `get` walk, which is the shape the validator asks
 * on every write, so the trade is a measurement rather than a claim.
 *
 * WHAT IT HOLDS ONTO: `base` keeps the values the layer covers, so an overlaid
 * map retains the records the edit replaced until it flattens. Bounded by the
 * same half above, and gone at the next flatten.
 *
 * ONE INDEX USES THIS, and the other eight the patcher clones stay clones on
 * purpose. `byId` is the corpus-sized one — 21,552 entries against 8,282 for
 * the next largest and a few hundred for most, so one clone of it costs about
 * what all eight others together cost, which `patch.bench.ts` prints as a pair.
 * Size is not the whole reason and not the deciding one: six of those eight
 * DELETE keys across a patch, which a layer that keeps `base`'s key set cannot
 * do. The one that does not — `namedBy` — was left alone deliberately: the
 * validator WALKS it whole ({@link ./validate.ts}'s `checkTargets`), and a walk
 * through the generator below costs more per entry than the clone it would
 * save, where `byId`'s only whole-index reader asks for {@link Layer.keys},
 * which is the underlying map's own iterator and not a generator at all.
 *
 * IT KNOWS NOTHING ABOUT OUTLINES, and it lives here anyway: this package is
 * the floor of the tree (`docs/architecture.md`), so the lowest honest home for
 * a structure with one consumer in it is beside that consumer. Population one
 * is the reason it is not somewhere shared yet rather than an argument that it
 * never should be — a second caller, here or in kolu, is what would move it,
 * and nothing about the shape would have to change when it does.
 */

/**
 * `base` with `changes` applied — the layer where that is exact and cheap, a
 * plain `Map` otherwise.
 *
 * `V extends {}` is load-bearing rather than decorative: {@link Layer.get}
 * reads the layer and falls through to `base` on `undefined`, which is only
 * the same answer as "the layer has no such key" when no value IS `undefined`.
 * The type says so, so the fall-through cannot be quietly wrong.
 */
export const overlaid = <K, V extends {}>(
  base: ReadonlyMap<K, V>,
  changes: ReadonlyArray<readonly [K, V]>,
): ReadonlyMap<K, V> => {
  // A layer over a layer is one layer, never a chain: `get` walks what it is
  // handed, and a chain would make a read cost the session's history.
  const under = base instanceof Layer ? (base as Layer<K, V>).base : base
  const over = new Map<K, V>(base instanceof Layer ? (base as Layer<K, V>).over : undefined)
  /** The real map, for when a layer is not the cheaper way to it — built from
   *  what is UNDER `base` rather than by spreading `base`, which for a layer
   *  would go through the walk below and read every key twice on the one path
   *  that is already paying for the whole map. Same value either way: the keys
   *  `over` carries are `under`'s own, so re-setting them keeps their places,
   *  and anything genuinely new lands at the end exactly as it would have. */
  const flattened = (): ReadonlyMap<K, V> => {
    const whole = new Map(under)
    for (const [key, value] of over) whole.set(key, value)
    for (const [key, value] of changes) whole.set(key, value)
    return whole
  }
  for (const [key, value] of changes) {
    if (!under.has(key)) return flattened()
    over.set(key, value)
  }
  if (over.size * 2 > under.size) return flattened()
  return new Layer(under, over)
}

/**
 * The layer itself: a map, plus what a patch changed in it.
 *
 * Not exported, and there is no way to ask a map whether it is one. What
 * {@link overlaid} returns is a `ReadonlyMap`, because a caller that could tell
 * would be a caller with two paths to keep in step — and the one place the
 * distinction is real (a layer over a layer) is above, inside the only function
 * that makes one.
 *
 * The invariant every method below stands on: **every key of `over` is a key of
 * `base`**. Size, key order and `has` are then `base`'s own answers, and only
 * the values move.
 */
class Layer<K, V extends {}> implements ReadonlyMap<K, V> {
  constructor(
    readonly base: ReadonlyMap<K, V>,
    readonly over: ReadonlyMap<K, V>,
  ) {}

  get size(): number {
    return this.base.size
  }

  has(key: K): boolean {
    return this.base.has(key)
  }

  /** The ONE place the layer is read through, which every other reading below
   *  goes past: what a key answers is one rule, and a second spelling of it
   *  inside the walk would be a map that iterated to something other than what
   *  it answers one key at a time. The extra lookup that costs a walk is a
   *  walk's worth of lookups on an index whose only whole-index reader asks
   *  for {@link Layer.keys}. */
  get(key: K): V | undefined {
    return this.over.get(key) ?? this.base.get(key)
  }

  keys(): MapIterator<K> {
    return this.base.keys()
  }

  *values(): MapIterator<V> {
    for (const key of this.base.keys()) yield this.get(key) as V
  }

  *entries(): MapIterator<[K, V]> {
    for (const key of this.base.keys()) yield [key, this.get(key) as V]
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
