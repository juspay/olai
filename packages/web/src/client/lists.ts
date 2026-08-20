/**
 * "The same list" — the `equals` a memo over a rebuilt array needs, spelled
 * once.
 *
 * Several things in this client hand a FRESH ARRAY to something that only cares
 * whether the list changed: the served paths, rebuilt whenever either half of
 * the directory speaks (`./served.tsx`), and the documents this tab is holding
 * open, rebuilt whenever any row's interest count moves (`./document/documents.tsx`).
 * A memo compares by reference, so without an `equals` each of those makes a
 * fresh array mean "the directory changed" or "a different set of documents is
 * wanted", and everything downstream re-runs for a value it already had.
 *
 * BY VALUE AND IN ORDER, which is the conservative reading: two lists that hold
 * the same strings in a different order compare unequal here. Both callers'
 * lists have a stable order (one is sorted, the other is a map's insertion
 * order), so the case does not arise in practice — and an order-blind compare
 * would be a set comparison with an allocation in it, in the one place whose
 * whole job is to be cheaper than what it guards.
 */

/** Whether two lists hold the same values in the same places. */
export const sameList = <A>(
  a: ReadonlyArray<A>,
  b: ReadonlyArray<A>,
): boolean => a.length === b.length && a.every((one, at) => one === b[at])
