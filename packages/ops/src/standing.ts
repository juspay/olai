/**
 * THE STANDING VIEWS — one answer per revision per QUESTION, however many tabs
 * are watching it.
 *
 * Five of this layer's readings are not asked once and answered: they are held
 * open. A page, the filter over it, the calendar's dots, what is owed and the
 * move picker's preview are each a poll-shape stream (`@olai/server`'s
 * `runtime.ts`), re-read on every published revision and sent on when they
 * moved by value. The framework gives every SUBSCRIBER its own poll loop, which
 * is the right shape for it and the wrong cost for this: three tabs on one page
 * were three identical rebuilds of that page per keystroke, and every tab in
 * the directory rebuilt what is owed — the most expensive of the five — on
 * every write anybody made (roadmap `perf-streams-per-tab`).
 *
 * Two things happen here and they are separate claims:
 *
 *   1. **THE SHARE.** A question is a member and its request. Two subscribers
 *      asking the same question of the same revision are asking one question,
 *      so it is answered once and both are handed the same value. Nothing is
 *      approximated: the second asker is given the answer the first one's read
 *      produced, off the same reading, and a subscriber on a DIFFERENT question
 *      shares nothing at all.
 *
 *   2. **THE PRE-CHECK.** Before rebuilding an answer at a new revision, ask
 *      whether the revision could have moved it — {@link @olai/format}'s
 *      `tape.ts`, which taped what the last run read and re-asks exactly
 *      those reads. A revision that moved nothing the answer depends on hands
 *      the previous answer straight back, and the rebuild does not happen. That
 *      is the half the framework's own equality cannot buy: `isEqual` runs
 *      AFTER the answer is built, so it saves the frame and never the work.
 *
 * ...and one that follows from having both: **THE COMPARISON IS ONCE TOO,
 * WHERE IT PAYS.** When a rebuild does happen and more than one subscriber is
 * watching, its value is compared with the one the last revision produced, and
 * where they agree the OLD OBJECT is what everybody is handed — so the
 * framework's per-subscriber `isEqual` is an identity test on every tab but the
 * one that paid for the walk, instead of a structural walk of the whole answer
 * per tab (`@olai/server`'s `runtime.ts` is where that is spent). For a
 * question ONE tab holds the walk is not made at all: that tab would have made
 * it exactly once either way, and making it here as well would be the one thing
 * this module must not do, which is cost a person typing in the page they are
 * looking at ({@link ask} argues it).
 *
 * ## What is shared and what stays per-tab
 *
 * The ANSWER is shared; nothing else is. Each subscriber keeps its own
 * subscription, its own last-sent value and its own idea of whether a frame is
 * owed — all of which are the framework's and none of which is here. A tab that
 * subscribes late is handed the answer the question already has, which is the
 * same value every other tab on that question is holding, and its first frame
 * is that value.
 *
 * THE CLOCK IS SAMPLED WHERE THE ANSWER IS COMPUTED, which is the one thing a
 * reader should know about this. Only the narrowing reads one — the query
 * grammar's relative words count from an instant (`@olai/format`'s
 * `parseFilter`) — and it is now sampled once per question per revision rather
 * than once per subscriber per read. For a subscription that is already open
 * nothing changes at all: a standing view has only ever been re-read when the
 * directory moved, so `created:1h` has only ever slid at a revision. What
 * changes is that a tab JOINING a question already answered gets that
 * question's clock rather than a fresh one — the same answer its neighbours are
 * looking at, which is the trade this member is: consistency across tabs over a
 * privileged first read.
 *
 * ## Why it is not a cache with a size on it
 *
 * Two generations and no more. The live map is the current reading's answers;
 * the prior one is what was live before it, kept for exactly one thing — it is
 * what the pre-check re-validates against.
 *
 * WHAT ROLLS THEM is a NEW READING being asked about, not a revision going by
 * and not an ask, and the difference is the whole economy: a directory nobody
 * is watching answers nothing and rolls nothing, however many asks arrive at
 * the reading it is already on. A question nobody holds any more falls out
 * after the next two rolls — which is to say after two further revisions
 * somebody else asked about, however many questions they asked at each. So what
 * is held is bounded by the questions being asked rather than by the questions
 * ever asked: a browser paging through a year of months leaves eleven of them
 * behind almost at once. Nothing is evicted by size, because nothing
 * accumulates.
 *
 * It also means a question that sat out a revision is still re-validated
 * against the reading it was last answered at rather than rebuilt, which falls
 * out of the tape being ABSOLUTE (`@olai/format`'s `tape.ts` records what an
 * index said at a key, not what changed since) and is worth nothing in
 * production — every open subscription asks every revision — but is one less
 * rule to get wrong.
 *
 * ## What it rests on
 *
 * That each of the five is a pure function of the reading, the request and the
 * clock — which is what {@link ./query.ts} is, and what the layer below it is
 * built to be (`@olai/format` derives, and nothing under `Reading` is written
 * to). The reuse is held to that by a differential: `./standing.testlib.ts`
 * replays an op corpus through a fake pair of subscribers on the same question
 * and on different ones, against wiring with none of this in it, and holds the
 * two to the same answer sequence per subscriber.
 */

import {
  type DatedAnswer,
  type DatedRequest,
  type KindVocabulary,
  type MovingAnswer,
  type MovingRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  type Owed,
  type OwedRequest,
  type PageReading,
  type PageRequest,
  type Reading,
  sameDated,
  sameMoving,
  sameNarrowing,
  sameOwed,
  samePageReading,
  stillHolds,
  type Tape,
  taping,
} from "@olai/format"

import * as Query from "./query.ts"

/**
 * ONE STANDING READING — what it is called, how a request becomes the name of a
 * question, how it is answered, and when two answers say the same thing.
 *
 * The equality is the SCHEMA's, and it is the same function the wire's own
 * stream binding is given (`@olai/server`'s `runtime.ts` passes these very
 * values as `isEqual`). That is deliberate and load-bearing: this module hands
 * back the previous object wherever `same` says the value did not move, so if
 * the two ever differed, a frame the framework would have sent could be one
 * this module had already decided was not news.
 */
interface Question<I, A> {
  /** `kinds` is what a plugin taught this vault ({@link @olai/format}'s
   *  `KindVocabulary`) — a fact about the PROCESS rather than the revision, so
   *  it is handed to every question and read by the one that words an answer
   *  about a declared value ({@link PAGE}). */
  readonly answer: (
    at: Reading,
    input: I,
    now: () => string,
    kinds: KindVocabulary,
  ) => A
  readonly same: (a: A, b: A) => boolean
}

const DATED: Question<DatedRequest, DatedAnswer> = {
  answer: (at, request) => Query.dated(at.derived, request),
  same: sameDated,
}

const OWED: Question<OwedRequest, Owed> = {
  answer: (at, request) => Query.owed(at.derived, request),
  same: sameOwed,
}

const PAGE: Question<PageRequest, PageReading> = {
  answer: (at, request, _now, kinds) => Query.page(at, request, kinds),
  same: samePageReading,
}

const NARROWING: Question<NarrowingRequest, NarrowingAnswer> = {
  // THE VOCABULARY IS PART OF THE GRAMMAR, not just of the gate. `prop:` reads
  // what a key is DECLARED as to decide whether a value is a span or an
  // equality, and a declaration is two layers now — a vault's rows over an
  // enabled plugin's claimed keys. Answered without it, a range on an
  // auto-declared key would refuse as undeclared while the write gate judged it
  // by the claim: the box that narrows a page and the file that is written
  // disagreeing about one word, which is the family this whole seam is a list
  // of.
  answer: (at, request, now, kinds) => Query.narrowing(at, request, now(), kinds),
  same: sameNarrowing,
}

const MOVING: Question<MovingRequest, MovingAnswer> = {
  answer: (at, request) => Query.moving(at.derived, request),
  same: sameMoving,
}

/** The five, by the name the wire calls each of them — which is also what
 *  keeps two members' questions from colliding in one map. */
const ASKED = {
  dated: DATED,
  owed: OWED,
  page: PAGE,
  narrowing: NARROWING,
  moving: MOVING,
} as const

/** Which of the five, by name. Exported for the harness and the bench, which
 *  drive every one of them rather than picking a favourite. */
export type Asked = keyof typeof ASKED

/** What this layer answers, and it is the same five signatures {@link Ops}
 *  declares with the reading passed in rather than read: the gate above stays
 *  where it is, and nothing here reaches for a store. */
export interface Standing {
  readonly dated: (at: Reading, request: DatedRequest) => DatedAnswer
  readonly owed: (at: Reading, request: OwedRequest) => Owed
  readonly page: (at: Reading, request: PageRequest) => PageReading
  readonly narrowing: (at: Reading, request: NarrowingRequest) => NarrowingAnswer
  readonly moving: (at: Reading, request: MovingRequest) => MovingAnswer
}

/** One question's last answer: the reading it holds at, the value, what the run
 *  that produced it read, and how many subscribers asked for it. */
interface Held {
  reading: Reading
  readonly answer: unknown
  readonly tape: Tape
  /** How many asks this answer was handed to at its revision — 1 for a
   *  question one tab holds. See {@link ask}'s last paragraph: it is what
   *  decides whether the comparison below is worth making. */
  askers: number
}

/**
 * The five, sharing per revision — one of these per served directory, built
 * where the ops layer is ({@link ./ops.ts}).
 *
 * It takes the CLOCK rather than reading one, for the reason every other
 * question in this package takes it: which instant a relative word counts from
 * is the composition root's to decide, and a second `new Date()` down here
 * would be a clock a test could not move.
 */
export const standing = (
  now: () => string,
  kinds: KindVocabulary | (() => KindVocabulary),
): Standing => {
  /** The revision every live answer is at — `null` until the first ask. */
  let at: Reading | null = null
  let live = new Map<string, Held>()
  let prior = new Map<string, Held>()

  /**
   * ONE ASK. The three arms are the module's three claims, in the order they
   * are cheapest: already answered at this revision, unchanged since the last
   * one, or built.
   *
   * THE COMPARISON AT THE END EARNS ITS PLACE OR IS NOT MADE, and that is the
   * one adaptive line in the module. Handing back the previous OBJECT where the
   * value did not move turns every subscriber's own `isEqual` into an identity
   * test — worth a structural walk of the answer when several are watching, and
   * a straight loss when one is, since that one would have walked it exactly
   * once either way. So the walk happens only when the last revision's answer
   * went to more than one asker. Either way the VALUE is the same and so is
   * every frame: the framework's equality is structural, so a subscriber handed
   * a fresh object equal to the one it is holding sends nothing, exactly as it
   * does today.
   */
  const ask = <I, A>(which: Asked, question: Question<I, A>, reading: Reading, input: I): A => {
    if (reading !== at) {
      prior = live
      live = new Map()
      at = reading
    }
    const key = `${which} ${JSON.stringify(input)}`
    const shared = live.get(key)
    // THE SHARE — another subscriber has already asked this question of this
    // revision, and this is that answer rather than one equal to it.
    if (shared !== undefined) {
      shared.askers++
      return shared.answer as A
    }

    const before = prior.get(key)
    // THE PRE-CHECK — nothing this answer read has moved, so the answer has
    // not. The TAPE travels with the entry: what is re-validated at the NEXT
    // revision is what the last REBUILD read, whether or not the revisions in
    // between rebuilt anything.
    if (before !== undefined && stillHolds(before.tape, before.reading, reading)) {
      before.reading = reading
      before.askers = 1
      live.set(key, before)
      return before.answer as A
    }

    const taped = taping(reading)
    const vocabulary = typeof kinds === "function" ? kinds() : kinds
    const fresh = question.answer(taped.reading, input, now, vocabulary)
    const answer = before !== undefined && before.askers > 1 &&
        question.same(before.answer as A, fresh)
      ? before.answer as A
      : fresh
    live.set(key, { reading, answer, tape: taped.tape, askers: 1 })
    return answer
  }

  return {
    dated: (reading, request) => ask("dated", DATED, reading, request),
    owed: (reading, request) => ask("owed", OWED, reading, request),
    page: (reading, request) => ask("page", PAGE, reading, request),
    narrowing: (reading, request) => ask("narrowing", NARROWING, reading, request),
    moving: (reading, request) => ask("moving", MOVING, reading, request),
  }
}

/**
 * THE SAME FIVE WITH NONE OF THIS — every ask a fresh build, which is what the
 * wiring did before.
 *
 * It is the differential's reference arm and it lives HERE rather than in the
 * harness beside it, for the reason `@olai/format`'s `scope.testlib.ts` keeps
 * the walk it replaced: the reference has to be the same five answers reached
 * the same way, and a copy written out over there would be a second opinion
 * about the thing under test. It is what the bench times its "before" arm with
 * too, so the figure a reader re-runs is a pair rather than one laptop's
 * milliseconds.
 */
export const rebuilding = (now: () => string, kinds: KindVocabulary): Standing => ({
  dated: (at, request) => DATED.answer(at, request, now, kinds),
  owed: (at, request) => OWED.answer(at, request, now, kinds),
  page: (at, request) => PAGE.answer(at, request, now, kinds),
  narrowing: (at, request) => NARROWING.answer(at, request, now, kinds),
  moving: (at, request) => MOVING.answer(at, request, now, kinds),
})

/** Whether two answers to one member say the same thing — the schema
 *  equivalence above, reached by the member's name. The harness compares
 *  answer sequences per subscriber and has no business knowing which
 *  comparison belongs to which member. */
export const sameAnswer = (which: Asked, a: unknown, b: unknown): boolean =>
  (ASKED[which].same as (x: unknown, y: unknown) => boolean)(a, b)
