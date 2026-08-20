/**
 * "The same collection" — the `equals` a memo over a REBUILT list or map needs,
 * spelled once.
 *
 * Several things in this client hand a fresh array or a fresh `Map` to something
 * that only cares whether the CONTENTS changed: the served paths, rebuilt
 * whenever either half of the directory speaks (`./served.tsx`); the documents
 * this tab is holding open, rebuilt whenever any row's interest count moves
 * (`./document/documents.tsx`); the files that did not parse, rebuilt on every
 * head the directory publishes (`./directory.ts`); the nodes a filter's answer
 * selected, minted afresh by every answer (`./filter/matches.ts`). A memo
 * compares by reference, so without an `equals` each of those makes a fresh
 * value mean "this changed" and everything downstream re-runs for something it
 * already had.
 *
 * ONE WALK, TWO SHAPES, because they are the same walk: check the size, then go
 * through one side once and ask the other what it holds. Written per caller it
 * was the same five lines with a different value comparison in the middle, which
 * is the duplicate this file exists to have exactly one of.
 *
 * WHAT IS NOT HERE is the domain argument. Each caller keeps its own `sameX`
 * beside the type it compares — that is this client's convention (`routes.ts`'s
 * `samePage`, `edit/draft.ts`'s `sameSlot`, `popover.ts`'s `sameBox`) and it is
 * where the sentence about why THAT value may be held still belongs. What comes
 * from here is the loop, never the reason.
 */

/** Whether two lists hold the same values in the same places.
 *
 *  BY VALUE AND IN ORDER, which is the conservative reading: two lists holding
 *  the same strings in a different order compare unequal. Both callers' lists
 *  have a stable order (one is sorted, the other is a map's insertion order), so
 *  the case does not arise — and an order-blind compare would be a set
 *  comparison with an allocation in it, in the one function whose whole job is
 *  to be cheaper than what it guards. */
export const sameList = <A>(
  a: ReadonlyArray<A>,
  b: ReadonlyArray<A>,
): boolean => a.length === b.length && a.every((one, at) => one === b[at])

/** Whether two maps hold the same keys, each holding the same value.
 *
 *  `same` is how the VALUES are compared, and identity is the default because
 *  that is what a map of things the wire minted wants: an entry is replaced when
 *  the frame that carries it is. A caller whose values are fresh objects every
 *  time passes the comparison that says what "the same" means for them.
 *
 *  Walked one way round only — the sizes are checked first, so `b` can hold no
 *  key `a` does not.
 *
 *  A MAP WHOSE VALUES MAY BE `undefined` is not this function's subject: an
 *  absent key and a key holding `undefined` answer the same here, and neither
 *  caller draws that distinction (a `BrokenFile`, a `MatchedNode`). Say so at a
 *  call site that needs it rather than paying a second lookup per key in the
 *  one function whose job is to be cheaper than what it guards. */
export const sameMap = <K, V>(
  a: ReadonlyMap<K, V>,
  b: ReadonlyMap<K, V>,
  same: (one: V, other: V) => boolean = Object.is,
): boolean => {
  if (a.size !== b.size) return false
  for (const [key, one] of a) {
    const other = b.get(key)
    if (other === undefined || !same(one, other)) return false
  }
  return true
}
