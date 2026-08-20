/**
 * A QUESTION THE SERVER IS ASKED AS SOMEBODY TYPES — the debounce, the
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
 * BECOMES A REQUEST. The settle, what an abandoned question does to the answer
 * on screen, and which of several in-flight calls is allowed to write the
 * failure slot are three facts about that one thing — three facts that must not
 * differ between two boxes in one app, and that a reader would otherwise have to
 * diff two files to compare. What a door ASKS and what it DRAWS stays the
 * door's, entirely: this takes a thunk and hands back a value.
 *
 * ## The three things a round trip costs, and what is done about each
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
 *
 * ## What is deliberately NOT here
 *
 * The page filter (`filter/asking.ts`) keeps its own, and the difference is a
 * difference in kind rather than a copy nobody got round to. A shortlist is a
 * question somebody opened, answered once and closed; a filter is a STANDING
 * VIEW of a page, and all three of its extra rules follow from that: its
 * question carries the set's own generation so a revision re-asks, its last
 * answer must survive a refused call (a narrowed page may not blank under
 * somebody because a socket blinked), and it must not be asked at all while the
 * wire is down — the box goes inert instead. Folding those in would be three
 * knobs on this, two of which every caller here would pass `false`.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import {
  type Accessor,
  createEffect,
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

/** What a door gets back: the question that is actually outstanding, whatever
 *  has answered it, and the two facts a caller needs to say whether the rows on
 *  screen are about the reader. */
export interface Asked<Q, A> {
  /** WHAT IS BEING ASKED — the question once it stopped moving, or `null` when
   *  nothing is. Not what the reader has typed: that is the caller's, and the
   *  two differ for the length of a settle. */
  readonly asked: Accessor<Q | null>
  /** Whatever has answered, or `undefined` for "nothing has" — which is both
   *  "nothing asked yet" and "the last call was refused", because neither is an
   *  answer and a door that drew a difference between them would be drawing the
   *  absence of one. */
  readonly answer: Accessor<A | undefined>
  /** Whether a call is in flight. What it is FOR is a door that has to say
   *  which question its rows answer: during a fetch they are the LAST one's. */
  readonly loading: Accessor<boolean>
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
export const createAsked = <Q, A>(
  question: Accessor<Q | null>,
  ask: (question: Q) => Call<A>,
  /** How two questions are compared — for a door whose question is a VALUE
   *  rather than a string, where a fresh object per keystroke would otherwise
   *  be a fresh round trip for an answer already on screen. Absent is identity,
   *  which is what a string question wants. */
  equals?: (was: Q | null, is: Q | null) => boolean,
): Asked<Q, A> => {
  const same = equals ?? Object.is
  const [failure, setFailure] = createSignal<string | null>(null)
  const [asked, setAsked] = createSignal<Q | null>(null, { equals: same })
  /** The setter through its UPDATER form, which is the one spelling that means
   *  "this value" for a `Q` the compiler cannot prove is not a function: a bare
   *  `setAsked(q)` is ambiguous with the updater overload, and the ambiguity is
   *  a type error rather than a bug only because the signal is generic. */
  const put = (next: Q | null) => setAsked(() => next)
  const settle = debounce(put, SETTLE_MS)

  createEffect(() => {
    const wanted = question()
    if (wanted !== null) {
      settle(wanted)
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
  const answering = (one: Q) => same(untrack(asked), one)

  const [answer] = createResource(asked, async (one: Q) => {
    const outcome = await runAsync(ask(one))
    if (Result.isFailure(outcome)) {
      if (answering(one)) setFailure(outcome.failure.message)
      return undefined
    }
    if (answering(one)) setFailure(null)
    return outcome.success
  })

  return { asked, answer, loading: () => answer.loading, failure }
}
