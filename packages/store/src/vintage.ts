/**
 * HOW CURRENT AN ANSWER IS — the store's second axis, and the one it did not
 * have.
 *
 * The store has always been able to say what is WRONG with a directory: a file
 * that will not decode, a set the codec refuses, a root that will not list. It
 * has never been able to say that nothing is wrong and the answer is old
 * anyway. Those are different facts, and on 2026-08-25 the difference cost
 * thirty minutes: a `git rebase` replaced the served files, the watcher missed
 * it, and every read answered normally with week-old truth. The errors channel
 * was empty the whole time, correctly — nothing was invalid. Nothing anywhere
 * carried an AGE.
 *
 * The mechanism is one line of the sync loop and it is still there, because it
 * is right: a probe whose listing is identical to the last one publishes
 * nothing ({@link ./store.ts}'s `cycle`, {@link ./probe.ts}'s `settled`). That
 * is what makes a sixty-second backstop free, and it is also why a loop that
 * has stopped looking is INDISTINGUISHABLE from one that keeps looking and
 * keeps finding the same tree. Both publish nothing. A missed replacement was
 * unrepresentable as an error by design.
 *
 * So the answer is not a new error. It is an age on every read, and a way of
 * establishing that age which A DEAD LOOP CANNOT FAKE.
 *
 * THE RED LINE (the 2026-08-25 debate, all three seats): the verification path
 * does not share the publish fiber's permit. Everything in this module runs on
 * the ASKER'S fiber, over a walk that arms nothing ({@link Disk.survey}) and
 * against stamps that were frozen when the answer it is about was published.
 * A wedged cycle — a permit held forever, a fiber that died, a watcher that
 * went quiet — makes {@link check} say DIVERGED, promptly. It cannot make it
 * say `Confirmed`, and it cannot make it wait.
 *
 * That is the whole of why this is a module and not four lines in the store: a
 * file with no way to reach the semaphore is a file that cannot take the
 * permit by accident later. The physics, rather than the promise.
 *
 * WHAT A CHECK CAN HONESTLY CLAIM is bounded by what a stamp is, and this
 * module does not pretend otherwise. Stamps are mtime+size ({@link ./disk.ts},
 * resolved 2026-08-09), so `Confirmed` means "the tree under the root holds
 * exactly the files this answer was read from, each with the size and
 * modification time it was read at, as of now" — which is a real claim about
 * a real look, and not the same claim as "byte-for-byte". A same-length
 * rewrite that also restores the mtime slips through it exactly as it slips
 * through the probe. That trade is the package's, taken once and stated here
 * rather than left for a caller to discover.
 */

import { Effect } from "effect"

import { type Disk, sameStamp, type Stamp } from "./disk.ts"
import type { PlatformFailure } from "./errors.ts"

/**
 * WHAT A CALLER STATES, and the only thing about currency it is allowed to
 * state: how much it needs to be able to assume, never how the store should
 * get there.
 *
 * This is the line the whole design turns on. `resync` used to be a second
 * look-verb whose difference from the first was mtime-and-size arithmetic,
 * explained in doc comments so a consumer could choose correctly — a socket
 * wearing its own wiring. Two classes replace it, and neither of them is a
 * knob: stamps, re-stats, probe cadence, what is cached and what is forgotten
 * all stay inside. A caller that could ask for a MEANS would be a caller the
 * next change to the means has to be negotiated with.
 *
 * The two are not fast-and-slow. They are two different questions:
 *
 *   - `cheap` asks what the store is SERVING. It costs one map read and no
 *     syscall, which is what makes it right for the thing that asks sixty
 *     times a second — a redraw does not become a stat storm for wanting to
 *     know how old its data is. It is answered on the publish loop's word,
 *     and it says how long ago that word was earned.
 *   - `verified` asks whether the disk still agrees. It costs one walk of the
 *     tree and it is taken on the asker's own fiber, which is what makes it
 *     right for an answer something will ACT on — a tool result an agent is
 *     about to plan against, where a silently old set is how a whole session
 *     goes wrong.
 */
export type Freshness = "cheap" | "verified"

/**
 * AN ANSWER'S AGE, AND ON WHOSE WORD — two facts in one value, because either
 * alone is unreadable.
 *
 * An age with no provenance is the weaker thing the debate refused: a
 * `freshAsOf` the publish fiber writes is a clock on the lamp, and it says
 * "recent" for as long as the fiber that writes it is alive to write it. A
 * provenance with no age is a claim with no shelf life. Together they are
 * checkable: `Confirmed` with an age of nothing is a look that just happened;
 * `Held` with an age of thirty minutes is a loop that has not managed to prove
 * anything for thirty minutes, which is exactly the sentence nobody could say
 * on 2026-08-25.
 */
export interface Vintage {
  /**
   * When the set behind this answer was last PROVED to be what the disk held —
   * epoch milliseconds.
   *
   * Advanced by a publish, by a probe that looked and found the same tree
   * (which publishes nothing and is the whole reason this field exists), and
   * by a `verified` read that agreed. NOT advanced by a probe that failed, by
   * a set the codec refused, or by a look nobody took: those are the three
   * ways an answer goes old, and all three show up here as an `at` that stops
   * moving.
   */
  readonly at: number
  /** The same fact, minus now. Derived beside {@link Vintage.at} from one
   *  reading of the clock, so the two can never tell different stories. */
  readonly age: number
  readonly proof: Proof
}

/**
 * HOW THE AGE WAS ESTABLISHED — four arms, and the last two are the point.
 *
 * What survives this change is a NAMED staleness. The read that used to be
 * silently old now comes back saying which files the disk no longer agrees
 * about, or that nobody could find out — which are honest failures, and
 * different bugs from the one they replace.
 *
 * EVERY ARM IS AN ANSWER, which is why {@link check} has no failure channel and
 * neither does the door above it. A look that could not be taken is not an
 * exception to a question about currency; it is one of that question's real
 * answers, and a caller told it is better informed than one handed a defect to
 * re-word.
 */
export type Proof = Held | Confirmed | Diverged | Unchecked

/** Nobody has looked since {@link Vintage.at}. The answer stands on the
 *  publish loop's last word, and the age says how long ago that was — which
 *  is the whole of what a `cheap` read may claim, and is enough: an age that
 *  grows without bound is a loop that has stopped, visibly. */
export interface Held {
  readonly _tag: "Held"
}

/** A look was taken, on the asker's fiber and outside the publish loop, and
 *  the tree still holds exactly the files this answer was read from, at the
 *  stamps they were read at. The age is nothing, because the proof is now. */
export interface Confirmed {
  readonly _tag: "Confirmed"
}

/**
 * A look was taken and the disk does NOT agree — these paths are not what the
 * answer was built from.
 *
 * The value still comes back. That is deliberate and it is the same rule the
 * errors channel already lives by: a last good set under a banner beats a
 * blank page, and a consumer that can see the divergence can decide for itself
 * whether to act on the set, re-ask, or say so. What it can no longer do is
 * mistake the set for current.
 */
export interface Diverged {
  readonly _tag: "Diverged"
  /** Root-relative, `/`-spelled, in path order: what the tree holds that the
   *  answer does not, and what the answer holds that the tree does not. */
  readonly paths: ReadonlyArray<string>
}

/**
 * A look was ASKED FOR and could not be taken: the root would not list.
 *
 * The age beside it is the standing one and it goes on growing, which is the
 * honest reading — nothing about this answer has been proved since the loop
 * last managed it. The directory's own failure reaches the errors channel by
 * the path it always has ({@link ./store.ts}'s `sayUnreadable`); what is here
 * is the other half, which is that the set you are holding was not checked.
 */
export interface Unchecked {
  readonly _tag: "Unchecked"
  /** The disk's own words, so a surface can say WHY rather than "unknown". */
  readonly why: string
}

export const HELD: Held = { _tag: "Held" }
export const CONFIRMED: Confirmed = { _tag: "Confirmed" }

/**
 * WHAT A PUBLISHED ANSWER WAS READ FROM — the two facts a later look has to be
 * measured against, kept as ONE value because they are only true together.
 *
 * `stamps` is the probe's own table as it stood when this revision was
 * published, not as it stands now. That distinction is the difference between
 * a check and a coincidence: the live table is the loop's scratchpad, and it
 * moves ahead of the published set every time a probe re-decodes something the
 * codec then refuses — or, for a moment, every time one is mid-publish.
 * Compared against the LIVE table, a set the codec refused an hour ago would
 * read as `Confirmed`; compared against the table its own revision was made
 * from, it reads as `Diverged`, which is what it is.
 */
export interface Standing {
  readonly at: number
  readonly stamps: ReadonlyMap<string, Stamp>
}

/** A store that has published nothing has proved nothing about a tree, and
 *  says so with an empty table: the first `verified` read of a directory that
 *  never loaded diverges on every file that is in it. */
export const nothingProved = (at: number): Standing => ({ at, stamps: new Map() })

/**
 * THE LOOK — one walk of the tree, on the caller's fiber, compared with what
 * the standing answer was read from.
 *
 * It takes a {@link Disk} and a {@link Standing} and NOTHING ELSE. There is no
 * store in scope here, so there is no semaphore in scope here, so there is no
 * spelling of this function that could come to wait on the publish loop — the
 * red line, held by what is reachable rather than by what is remembered.
 *
 * It writes nothing either. The stamp table it walks past is not updated, no
 * file is re-decoded, no revision is minted and nothing reaches the errors
 * channel: a `verified` read of a directory somebody is editing must not
 * become a second, unscheduled publisher racing the one that exists. What it
 * produces is a sentence about the disk, and the loop goes on owning what is
 * done about it.
 */
export const check = (
  disk: Disk,
  match: (path: string) => boolean,
  standing: Standing,
): Effect.Effect<Proof> =>
  Effect.match(disk.survey(match), {
    onFailure: (failure: PlatformFailure): Proof => ({
      _tag: "Unchecked",
      why: failure.message,
    }),
    onSuccess: (found): Proof => {
      const paths = divergence(found, standing.stamps)
      return paths.length === 0 ? CONFIRMED : { _tag: "Diverged", paths }
    },
  })

/**
 * Which paths the two tables disagree about — arrivals, departures, and every
 * file whose stamp moved.
 *
 * All three are one answer rather than three lists, because a consumer of this
 * is being told one thing: the set it holds is not the set that is there. Its
 * own next move is the same whichever way a given path is wrong.
 *
 * Separate from {@link check} so the comparison can be read — and tested —
 * without a directory: it is the one piece of this module that is arithmetic
 * rather than a syscall.
 */
export const divergence = (
  found: ReadonlyMap<string, Stamp>,
  expected: ReadonlyMap<string, Stamp>,
): ReadonlyArray<string> => {
  const paths: Array<string> = []
  for (const [path, stamp] of found) {
    const was = expected.get(path)
    if (was === undefined || !sameStamp(was, stamp)) paths.push(path)
  }
  for (const path of expected.keys()) {
    if (!found.has(path)) paths.push(path)
  }
  // The walk is in path order and the departures are appended after it, which
  // is deterministic but reads as two lists stapled together. Sorted, so the
  // answer is one list a human can scan and a test can write down.
  return paths.sort()
}

/** The vintage a standing answer has right now, on the loop's word alone —
 *  the `cheap` class in one line, and the shape the other two arms fill in
 *  once a look has been taken. */
export const vintageOf = (standing: Standing, now: number, proof: Proof): Vintage => ({
  at: proof._tag === "Confirmed" ? now : standing.at,
  age: proof._tag === "Confirmed" ? 0 : Math.max(0, now - standing.at),
  proof,
})

/** Whether an answer's own vintage says the disk has moved out from under it —
 *  the two arms that are a look having been taken and having gone badly. A
 *  consumer branching on staleness asks this rather than matching the union,
 *  so "what counts as stale" is decided once, here, where the arms are. */
export const isStale = (vintage: Vintage): boolean =>
  vintage.proof._tag === "Diverged" || vintage.proof._tag === "Unchecked"
