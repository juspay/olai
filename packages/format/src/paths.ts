/**
 * PATH ORDER: the order a directory is read in.
 *
 * ONE RULE, in a module of its own, because everything in this package that
 * asks "which of these two files comes first" has to get the same answer and
 * the askers are spread across it: {@link ./set.ts}'s `assemble` puts a set in
 * this order and every reader spends it (`list_outlines` answers in it, a
 * search tie breaks on it, the sidebar draws it), {@link ./patch.ts} places an
 * arriving file by it, the browser folds its frames in it (`@olai/web`'s
 * `paths.ts`), and the five other questions this package asks about WHICH FILE
 * — what order a report reads in, where a cycle's report starts, which of two
 * inboxes a directory means, which of two daily notes is the example, and what
 * order a day lists its notes in — are the same question again, and each of
 * them used to answer it with its own compare.
 *
 * It is its own module rather than a function in `set.ts` because a rule about
 * PATHS depends on nothing: `node.ts` reaches for it and `set.ts` reaches for
 * `node.ts`, so a set that owned the rule would be a cycle, and a cycle is what
 * a fact filed under the wrong subject looks like from the import graph.
 *
 * THE SEPARATOR SORTS FIRST, which is the whole of the rule and the half a
 * plain string compare gets wrong: `.` is code point 0x2E and `/` is 0x2F, so
 * `wing.olai` compares before `wing/kitchen.olai` while a walk that descends
 * into `wing` when it meets it produces the opposite (`@olai/store`'s `disk.ts`
 * — "the map reads down the tree the way a listing of it does"). Ordering the
 * separator below every other character IS segment-by-segment comparison, and
 * it is spelled as one character rule rather than as a split-and-compare so
 * that sorting a corpus allocates nothing.
 *
 * Slice 4 of `docs/brainstorming/model-indices.md` is why there is one of these
 * rather than two: the browser began PATCHING the format's view of the set, and
 * a client that placed a file by one order while the patcher placed it by
 * another would be the same directory read two ways — the same records in a
 * different corpus order, which decides which claim on a duplicate id wins and
 * which of two findings a reader is shown first.
 */

const SEPARATOR = "/".charCodeAt(0)

/** Which path comes first — `-1`, `0` or `1`, so it is a comparator for
 *  `sort` and an `Order` for whatever wants one. */
export const byPath = (one: string, other: string): -1 | 0 | 1 => {
  const shared = Math.min(one.length, other.length)
  for (let at = 0; at < shared; at++) {
    const left = one.charCodeAt(at)
    const right = other.charCodeAt(at)
    if (left === right) continue
    // `/` first, whatever it is up against; everything else in code point
    // order, which is what `<` on two strings already means.
    if (left === SEPARATOR) return -1
    if (right === SEPARATOR) return 1
    return left < right ? -1 : 1
  }
  // A path that is a prefix of another is the directory it descends into, and
  // it comes first for the same reason.
  return one.length === other.length ? 0 : one.length < other.length ? -1 : 1
}

/**
 * What a file is CALLED — the last segment of its path, and the second thing
 * this module owns about a path.
 *
 * Here for {@link byPath}'s reason exactly: it was spelled twice for two
 * readers who must not disagree — this package's own convention walk (which
 * outline is the inbox, which one is the shelf: `./node.ts`) and the browser's
 * sidebar, where a pinned document is drawn by its name rather than by its
 * whole path (`@olai/web`'s `pins/name.ts`). Two slices of the same string is
 * exactly the kind of one-liner that is copied rather than imported, and then
 * disagrees the day somebody decides a trailing slash is a thing.
 *
 * No separator, no directory: a path with none is its own basename, which is
 * what the root of a served directory looks like.
 */
export const basenameOf = (file: string): string =>
  file.slice(file.lastIndexOf("/") + 1)
