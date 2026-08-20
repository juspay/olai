/**
 * A QUESTION THE SERVER IS ASKED AS SOMEBODY TYPES — the settle, the
 * latest-answer-wins rule, and the one failure slot, named once.
 *
 * ## Why this exists
 *
 * Since `vault-in-browser` the browser answers less and less for itself, so
 * "ask the server, per keystroke" stopped being one door's problem and became a
 * shape. It was written twice — `search/nodes.ts` for the ⌘K palette, the
 * header box and the `((` list; `filter/asking.ts` for the page filter — and a
 * third caller (the row editor's tag vocabulary) is what turned two copies into
 * a rule kept in memory. The rule is here now, and the two shortlist doors are
 * callers of it.
 *
 * What it encapsulates is one axis and it is worth naming it: HOW A KEYSTROKE
 * BECOMES A REQUEST. The settle, which of several in-flight calls may write the
 * failure slot, what an abandoned question does to the answer on screen, and
 * WHICH question the answer on screen is about are four facts about that one
 * thing — four facts that must not differ between two boxes in one app, and
 * that a reader would otherwise have to diff two files to compare. What a door
 * ASKS and what it DRAWS stays the door's, entirely: this takes a thunk and
 * hands back a value.
 *
 * ## The four things a round trip costs, and what is done about each
 *
 *   - **A keystroke may not be a request.** {@link SETTLE_MS} collapses a word
 *     into one question instead of six.
 *   - **An old answer may not land on a new question.** `createResource` drops
 *     the return value of a fetcher whose source has since moved — which is why
 *     there is no sequence counter here and never was. It cannot un-run the
 *     fetcher, so everything that is NOT the return value needs the guard the
 *     framework only gives to the answer: the failure slot is a signal every
 *     question shares, and a slow refusal of question A landing after B
 *     succeeded would paint B's rows with A's error.
 *   - **A question that goes away takes its answer with it, AT ONCE.** A list
 *     left standing behind a query the reader has already backspaced away from
 *     is a list that is lying for as long as it stands, and the settle would
 *     make it lie for 200ms longer.
 *   - **While the next answer is in flight, what is drawn is the LAST one's.**
 *     That is the right thing to draw and the wrong thing to leave unlabelled,
 *     so the answer CARRIES the question it answers ({@link Settled.answering})
 *     rather than a caller reconstructing "have the rows caught up" out of a
 *     loading flag and an outstanding question. `filter/asking.ts` makes that
 *     argument for itself in its own words — "read off the same thing that
 *     holds them rather than off a signal beside it that is free to be a frame
 *     ahead" — and this is that rule where every caller inherits it.
 *
 * ## What is deliberately NOT here
 *
 * The page filter (`filter/asking.ts`) keeps its own, and the difference is a
 * difference in kind rather than a copy nobody got round to. A shortlist is a
 * question somebody opened, answered once and closed; a filter is a STANDING
 * VIEW of a page, and the two rules it has that no shortlist wants follow from
 * that: its last answer must survive a refused call (a narrowed page may not
 * blank under somebody because a socket blinked), and it must not be asked at
 * all while the wire is down — the box goes inert instead. Its generation-on-
 * the-question is NOT one of them: that is just a value question with an
 * `equals`, which is what {@link createSettled} takes. So it is two knobs, both
 * of which every caller here would pass `false`, and the second stops being
 * filter-specific the day `vault-in-browser` §5b's offline overlay lands — at
 * which point this is the file the filter should fold into.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import {
  type Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from "solid-js"

import { type Call, runAsync } from "./run.ts"

/** How long a keystroke waits for the next one. A whole round trip sits behind
 *  this, so it is pitched just past an ordinary inter-keystroke gap rather than
 *  under it, where it would collapse nothing.
 *
 *  EXPORTED, because the page filter settles on the same number and is not a
 *  caller of this file (see the header): it is one fact about one pair of
 *  hands, and two boxes in one app settling at two speeds is a difference
 *  nobody could account for. It was a sentence in two files saying so; a
 *  sentence is not a constant. */
export const SETTLE_MS = 200

/** What a door gets back — three accessors, and every one of them is a thing a
 *  door draws. */
export interface Settled<Q, A> {
  /**
   * WHAT TO DRAW: whatever last answered, or `undefined` for "nothing has".
   *
   * It HOLDS STILL across a question that has moved — the rows a reader is
   * looking at stay until the next ones arrive — and goes `undefined` when the
   * question goes away entirely, or when the call was refused. Neither of those
   * two is an answer, so neither is drawn as one.
   */
  readonly answer: Accessor<A | undefined>
  /**
   * WHICH QUESTION {@link answer} answers — and `null` the moment that is no
   * longer the question being asked.
   *
   * The one fact a door needs to say whether what is on screen is about the
   * reader: during the settle and the flight of a newer question it is `null`,
   * and a refused call answers nothing and so names nothing. Read off the
   * resolved value rather than off a signal beside it.
   */
  readonly answering: Accessor<Q | null>
  /** A refused call, in the server's own words — `null` when there is none, and
   *  never a stale one. Never silently dropped (`./run.ts` forbids a silent
   *  handler). */
  readonly failure: Accessor<string | null>
}

/**
 * Ask as the question changes. `null` is "not asking" and answers with nothing
 * rather than with the answer from before.
 *
 * IT TAKES THE QUESTION ALREADY DECIDED, which is the line between this and its
 * callers: whether a query is long enough to be worth a trip, whether a trigger
 * is the right kind, what the words are once trimmed — all of that is a
 * function of what somebody typed and belongs to the door that read it. What is
 * here is only WHEN, and what to do with a stale answer.
 */
export const createSettled = <Q, A>(
  question: Accessor<Q | null>,
  ask: (question: Q) => Call<A>,
  /** How two questions are compared — for a door whose question is a VALUE
   *  rather than a string, where a fresh object per keystroke would otherwise
   *  be a fresh round trip for an answer already on screen. Absent is identity,
   *  which is what a string question wants. */
  equals?: (was: Q | null, is: Q | null) => boolean,
): Settled<Q, A> => {
  const same = equals ?? Object.is
  const [failure, setFailure] = createSignal<string | null>(null)
  /** What has actually been asked for: the question, once it stopped moving. */
  const [asked, setAsked] = createSignal<Q | null>(null, { equals: same })
  /** The setter through its UPDATER form, which is the one spelling that means
   *  "this value" for a `Q` the compiler cannot prove is not a function. */
  const put = (next: Q | null) => setAsked(() => next)
  const settle = debounce(put, SETTLE_MS)

  /** The question, COMPARED BEFORE IT IS AN EVENT. A door's question is a fresh
   *  value per keystroke and most keystrokes do not change it — a caret moved
   *  inside `#home`, a trailing space typed after a search query — and without
   *  this each of those restarts the settle, which under continuous unrelated
   *  typing defers the answer indefinitely. The signal below would absorb the
   *  duplicate; the timer would not. */
  const wanted = createMemo<Q | null>(question, null, { equals: same })

  createEffect(() => {
    const asking = wanted()
    if (asking !== null) {
      settle(asking)
      return
    }
    // Clearing takes effect AT ONCE rather than after the settle — see the
    // header's third bullet.
    settle.clear()
    put(null)
    setFailure(null)
  })

  /** Is this fetcher still answering the question that is being asked?
   *  `untrack`, because this is read inside an async continuation: as a
   *  dependency it would make a fetcher's own resolution a reason to re-run
   *  it. */
  const current = (one: Q) => same(untrack(asked), one)

  // THE ANSWER CARRIES ITS QUESTION, which is what makes {@link answering} a
  // fact of one value rather than an inference over three signals.
  const [answer] = createResource(asked, async (one: Q) => {
    const outcome = await runAsync(ask(one))
    if (Result.isFailure(outcome)) {
      if (current(one)) setFailure(outcome.failure.message)
      return undefined
    }
    if (current(one)) setFailure(null)
    return { question: one, answer: outcome.success }
  })

  return {
    answer: () => answer()?.answer,
    answering: () => {
      const got = answer()
      return got !== undefined && same(got.question, asked()) ? got.question : null
    },
    failure,
  }
}
