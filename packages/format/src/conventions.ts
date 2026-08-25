/**
 * A BY-NAME ANSWER, HELD WITH THE PATH SET IT DESCRIBES — and re-read only for
 * the paths a revision actually moved.
 *
 * Three of this package's readings are about WHICH FILE a directory calls
 * something — the shelf (`./shelf.ts`), the inbox door's count (`./inbox.ts`)
 * and the property declarations (`./typing.ts`) — and each of them asks
 * `./node.ts`'s convention walk in front of the reading it actually wanted.
 * That walk is over every served file, and the answer it gives moves only when
 * a file is ADDED, REMOVED or RENAMED. The server re-asked it per published
 * revision (`@olai/server`'s `runtime.ts`), which is per keystroke: a thousand
 * basenames sliced, folded and compared so that a title edit in one of them
 * could be told the shelf is still `Pins.olai`. The cell's `equals` then
 * swallowed the frame, having already paid for the work
 * (`perf-filename-conventions`).
 *
 * THE DECLARATIONS ARE NOT CARRIED HERE and are named above only because they
 * ask the same walk: that reading is memoised per VIEW already
 * (`./typing.ts`'s `DECLARED`), so it costs one walk per revision however many
 * of its four readers ask, and a carrier in front of a memo would be two
 * answers to when the walk runs. What it got from this lane is the walk
 * itself, which no longer copies the grouping's keys to iterate them once
 * ({@link ./node.ts}).
 *
 * ## What is carried, and what it costs to trust it
 *
 * A {@link Convention} is the answer AND the path set it was read from. Ask for
 * the next revision's convention holding the last one, and the walk runs only
 * where the path set has moved.
 *
 * WHETHER IT MOVED IS ASKED OF THE DELTA and never of the directory, which is
 * the whole of why this is worth doing: a comparison of two path sets is the
 * same size as the walk it is trying to avoid, and a lane that replaced a walk
 * of every file with a comparison of every file would have bought a rename of
 * the cost. The store already says which paths a revision moved
 * ({@link PathsMoved}, `@olai/store`'s `Snapshot`), those are the only paths
 * whose membership can differ, and so this costs the size of the WRITE.
 *
 * A carried convention is handed back as the SAME OBJECT, which is how a test
 * counts the walks without either arm being instrumented
 * (`./conventions.test.ts`).
 *
 * That is the shape #387 and #389 left behind, read one question over: a
 * structure carried across revisions is exact only while what it describes has
 * not moved, so what it describes travels WITH it and membership is what
 * decides. The tape (`./tape.ts`) is the same law at the other end — record
 * what an answer read, and re-ask that before believing the answer again.
 *
 * ## Which way its mistakes go
 *
 * TOO WIDE costs a walk that was not needed, which is what every revision cost
 * before this module existed. TOO NARROW is a directory told its inbox is a
 * file that is no longer there, so every question here is asked in the
 * direction that fails towards the walk:
 *
 * - a carrier with nothing held yet walks, always;
 * - a path the delta NAMED whose membership differs is a move, and a path it
 *   named that is now in one list and was in the other is a move whichever way
 *   round it went;
 * - and the COUNT is checked, because `removed` is the weaker of the store's
 *   two lists: a departure a `resync` swallowed is in neither of them
 *   (`@olai/server`'s `published.ts` says so, and mints the remove the store
 *   could not name). An arrival is always named — a path with no cached stamp
 *   cannot be skipped — so a membership change the delta did not account for
 *   can only be a departure, and a departure always shows in the size. That
 *   one comparison is what makes this exact rather than merely usually right.
 *
 * ## Where the paths come from
 *
 * Two readers, two spellings of "the files", and the difference between them is
 * load-bearing rather than incidental — so each has its own door here:
 *
 * - {@link conventionServed} over the files a SET SERVES, which is where the
 *   inbox is found, because `byFile` groups PARSED RECORDS and an empty or
 *   torn `Inbox.olai` has no entry in it — so the count would name a different
 *   file from the one a capture lands in (`./inbox.ts` argues it at length);
 * - {@link conventionRecorded} over the files a DERIVATION HOLDS RECORDS FOR,
 *   which is where the shelf is found, because that is the list its rows come
 *   out of.
 *
 * The served one asks about EVERY served file and not only the outlines, and
 * that is deliberate rather than sloppy: a `.md` arriving is a change to the
 * directory's file list, the answer is about which file a NAME belongs to, and
 * the alternative — a membership test narrowed to outlines — cannot be
 * completed by an arithmetic check, because a set does not carry a count of
 * its outlines. So a document arriving re-walks the convention, which is the
 * wide direction, and a document EDITED does not, which is the case this lane
 * is about.
 */

import type { Derived } from "./derive.ts"
import { documentAt, type OutlineSet, outlinePaths } from "./set.ts"

/**
 * The file a directory calls by some name, and the path set that answer is
 * about.
 *
 * The two fields are ONE value and must never be taken apart: a `file` without
 * the paths beside it is an answer with nothing to re-check it against, which
 * is precisely the state every reader of the convention walk used to be in.
 */
export interface Convention {
  /** The path set {@link Convention.file} was read from — the membership the
   *  next revision's delta is checked against, and the count that catches a
   *  departure the delta did not name. */
  readonly paths: PathSet
  /** The file, or `undefined` where the directory has none — which is an
   *  ANSWER and not an absence of one, and is carried as such. */
  readonly file: string | undefined
}

/**
 * A PATH SET, as the two questions this module asks of one: is that file in
 * it, and how many files are in it.
 *
 * A pair of questions and not a `Set`, which is the difference between
 * carrying an answer and copying a directory: the structures a revision is
 * already made of answer both — `Derived.byFile` IS a `has` and a `size`,
 * and a set answers them with its binary search and the length of its document
 * list ({@link ./set.ts}'s `documentAt`). Building a `Set` of every path to
 * hold beside the answer would put the allocation this module removes back on
 * the one revision in a thousand that has to walk.
 *
 * WHAT IT COSTS IS ONE REVISION OF RETENTION, said out loud because it is a
 * real cost: a carried convention keeps the structures it was read from alive
 * until the next path-set change. That is the same order as the projection's
 * `held` one level up (`@olai/server`'s `runtime.ts`), and it rests on the
 * same law the carried index layers keep ({@link ./overlay.ts}): those
 * structures belong to the revision that built them and nobody writes through
 * them, so what is held is a SNAPSHOT and cannot go stale under the answer.
 */
export interface PathSet {
  has(path: string): boolean
  readonly size: number
}

/**
 * WHICH PATHS A REVISION MOVED — the store's own diff, and the only part of a
 * snapshot this module reads.
 *
 * Named here rather than taken as a whole `Snapshot`, for `published.ts`'s
 * reason exactly: this package is the floor and may not learn the store's
 * types to read two arrays off a value. A `Snapshot` satisfies it by having
 * the fields.
 *
 * HOW FAR IT GOES is written out in this module's header and the checks below
 * are built against precisely that: `changed` names every path the probe
 * decoded, so an arrival is always in it; `removed` is a listing's diff
 * against a stamp table a `resync` may forget, so a departure can go unnamed.
 */
export interface PathsMoved {
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

/**
 * The convention walk itself, as this module takes it: `./node.ts`'s `pinsIn`,
 * `inboxIn` or `propertiesIn`, handed in by the caller that knows which
 * question it is asking.
 *
 * A FUNCTION rather than a name, so that the three named questions stay the
 * only spellings of the rule: a `name` parameter here would be a fourth place
 * a convention could be invented, and `./node.ts` says why there is one walk
 * behind all of them.
 */
export type ConventionWalk = (files: Iterable<string>) => string | undefined

/**
 * The convention of the files a SET SERVES — the inbox's answer, and the one a
 * capture is aimed by.
 *
 * The walk runs over the set's OUTLINES ({@link outlinePaths}, held with the
 * set) while what is carried is every served path: the first is the question,
 * the second is what makes the next revision's answer cheap. See this module's
 * header for why the two are not the same list.
 */
export const conventionServed = (
  walk: ConventionWalk,
  set: OutlineSet,
  moved: PathsMoved,
  held?: Convention,
): Convention => {
  if (held !== undefined && !servedMoved(held.paths, set, moved)) return held
  return { paths: servedBy(set), file: walk(outlinePaths(set)) }
}

/** The files a set serves, as a {@link PathSet} — the set's own binary search
 *  and the length of its document list, so holding one allocates a closure and
 *  nothing else. */
const servedBy = (set: OutlineSet): PathSet => ({
  has: (path) => documentAt(set, path) !== undefined,
  size: set.documents.length,
})

/**
 * The convention of the files a DERIVATION HOLDS RECORDS FOR — the shelf's
 * answer, and the declarations'.
 *
 * `byFile` answers membership and size in constant time, so this is the
 * cheaper of the two doors and needs no narrowing: a file EMPTIED leaves the
 * grouping while the set goes on serving it, and that is a move here and not
 * one next door — which is exactly the disagreement the two readings are
 * entitled to.
 */
export const conventionRecorded = (
  walk: ConventionWalk,
  derived: Derived,
  moved: PathsMoved,
  held?: Convention,
): Convention => {
  const { byFile } = derived
  if (held !== undefined && !recordedMoved(held.paths, byFile, moved)) return held
  // The grouping IS the path set — a `ReadonlyMap` answers both questions a
  // {@link PathSet} is asked, so the cheaper of the two doors holds what it
  // read rather than a copy of the keys.
  return { paths: byFile, file: walk(byFile.keys()) }
}

/** Whether the files the set serves are not the files it served — asked of the
 *  delta, then of the count. See the header for what each half is for. */
const servedMoved = (held: PathSet, set: OutlineSet, moved: PathsMoved): boolean => {
  for (const path of moved.removed) if (held.has(path)) return true
  for (const path of moved.changed) {
    if ((documentAt(set, path) !== undefined) !== held.has(path)) return true
  }
  return set.documents.length !== held.size
}

/** The same question of a grouping's keys — {@link servedMoved} with both
 *  halves in constant time per path. */
const recordedMoved = (
  held: PathSet,
  byFile: ReadonlyMap<string, unknown>,
  moved: PathsMoved,
): boolean => {
  for (const path of moved.removed) if (held.has(path)) return true
  for (const path of moved.changed) if (byFile.has(path) !== held.has(path)) return true
  return byFile.size !== held.size
}
