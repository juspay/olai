/**
 * Node search, as a primitive — asked of the server, latest answer wins.
 *
 * ONE READING, TWO DOORS. The ⌘K palette and the header's search box are both
 * callers of this, drawing the same rows (`./Result.tsx`) from the same
 * procedure; neither has a matcher, a ranking rule or a debounce of its own.
 * That is the consistency doctrine one layer in from where it usually gets
 * argued: it already says an agent's `search_nodes` and the browser must not
 * drift, and a browser that grew a second in-house search would have broken
 * the same rule inside one process. It lives in `search/` rather than in
 * `palette/` because of that second door.
 *
 * It is a hook rather than lines inside a component for the reason HACKING.md
 * gives twice: UI components stay encapsulated, and a browser should use the
 * SolidJS ecosystem rather than hand-roll it. `createResource` is what a
 * query-with-a-changing-input IS in Solid — it drops the answer to a source
 * that has since moved, and it holds nothing when the source goes away — so
 * the sequence counter and the three-statement reset branch this replaced are
 * gone, along with the chance of forgetting one of them when a fourth
 * condition lands.
 *
 * The MATCHING is entirely the server's (`@olai/surface`'s search.ts says
 * why): the same reading an agent's `search_nodes` gets. This file decides
 * only WHEN to ask.
 *
 * Its failure is its OWN — a refused search is not a refused `>` ask, and two
 * unrelated async sources sharing one error slot is how a reader is shown the
 * wrong sentence about the wrong thing.
 */

import {
  type Accessor,
  createEffect,
  createResource,
  createSignal,
  untrack,
} from "solid-js"
import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"

import type { NodeHit, Refusal, SearchHit } from "@olai/surface"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"

/** How long a keystroke waits for the next one. A whole round trip sits
 *  behind this, so it is pitched just past an ordinary inter-keystroke gap
 *  rather than under it, where it would collapse nothing.
 *
 *  EXPORTED, because the page filter settles on the same number
 *  (`../filter/asking.ts`) and it is one fact about one pair of hands: two
 *  boxes in one app settling at two speeds is a difference nobody could
 *  account for. It was a sentence in both files saying so; a sentence is not
 *  a constant. */
export const SETTLE_MS = 200

/** Below this the answer is noise: two characters match half an outline by
 *  substring. The shell items still filter locally, so the palette is never
 *  blank while somebody types. */
const MIN_LENGTH = 3

/** How many nodes a DOOR of this shows — every one of them, which is what
 *  makes it a constant here rather than an argument. EXPORTED for the one
 *  caller that has to SHARE the answer with something else: the composer's
 *  `@` list draws these rows beside its file rows and budgets the eight
 *  between them (`../chat/naming.ts`), so a cap changed here without that
 *  arithmetic hearing about it would hand the file half rows the node half
 *  was still using. Fewer than the tool's
 *  twelve: each of these is a shortlist over a page a reader is standing on
 *  (a modal, a box in the header, a panel under a row), not a report. */
export const LIMIT = 8

export interface Search<H extends SearchHit = SearchHit> {
  readonly hits: Accessor<ReadonlyArray<H>>
  /** A refusal from the server, in its own words — `null` when there is none.
   *  Never silently dropped (`../run.ts` forbids a silent handler). */
  readonly failure: Accessor<string | null>
  /**
   * What the QUERY LANGUAGE could not read — a known operator with an unknown
   * value (`is:open`), with what that operator takes. Empty for every query
   * it could read.
   *
   * A different thing from {@link failure}, and so a different slot, which is
   * this file's own rule one turn further on: a refused CALL is the server
   * saying it could not answer, and a refused QUERY is an answer — the words
   * were read and one of them is not a word. Without it a typo in an operator
   * looks exactly like an empty directory, which is the silent failure the
   * refusals were written to prevent.
   */
  readonly refusals: Accessor<ReadonlyArray<Refusal>>
  /**
   * WHICH QUERY the rows on screen answer — `null` while they answer a question
   * the reader has already moved on from.
   *
   * A search is a round trip behind a debounce, so there are two moments when
   * what is drawn is not what was asked: the settle, and the flight. This file
   * already refuses one of them outright — a query backspaced below the minimum
   * clears AT ONCE, "because a list left standing behind a query the reader has
   * already backspaced away from is a list that is lying for as long as it
   * stands" — and this is the same fact for the other, said rather than acted
   * on: a longer second query keeps the first one's rows until its own arrive,
   * which is the right thing to DRAW and the wrong thing to leave unlabelled.
   *
   * DERIVED, never stored: the resource drops the answer to a source that has
   * moved, so "settled, and this is what was asked" is the whole of it. A second
   * signal would be a second answer to the same question, wrong exactly while a
   * fetch is in flight.
   *
   * What it is FOR is anything that has to tell one answer from the next — a
   * scenario waiting for the rows of the query it just typed rather than for
   * any rows at all (`edges/EdgePanel.tsx` puts it in the markup), and whatever
   * eventually wants to draw the difference.
   */
  readonly answering: Accessor<string | null>
}

/**
 * Search as `text` changes. `null` is "not searching" — the palette is shut,
 * or the query is an ask, or it is too short to mean anything — and answers
 * with no hits rather than with the list from before.
 */
export function createSearch(
  text: Accessor<string | null>,
  kind: "node",
): Search<NodeHit>
export function createSearch(text: Accessor<string | null>): Search
/**
 * ASKED FOR ONE KIND, ANSWERED IN ONE KIND — the overload is the narrowing, so
 * a door that can only take a record does not filter an answer it already
 * scoped. Like every overload it is a PROMISE rather than a proof, and the one
 * line that keeps it is the `kind` on the request below: the server answers
 * what it was asked for.
 */
export function createSearch(
  text: Accessor<string | null>,
  /** ONE KIND, for a door that can only use one — the edge panel writing a
   *  `see`, the move picker, the composer's `@` list. It rides on the REQUEST
   *  rather than being filtered out of the answer, because the cap is applied
   *  server-side: a door that filtered afterwards would run short exactly when
   *  a query matched enough documents to fill it (`@olai/format`'s
   *  `SearchRequest`). Absent is both, which is what a reading door wants. */
  kind?: "node" | "document",
): Search {
  const [failure, setFailure] = createSignal<string | null>(null)
  /** What has actually been asked for: the query, once it stopped moving. */
  const [asked, setAsked] = createSignal<string | null>(null)
  const settle = debounce(setAsked, SETTLE_MS)

  createEffect(() => {
    const wanted = text()?.trim() ?? ""
    if (wanted.length >= MIN_LENGTH) {
      settle(wanted)
      return
    }
    // Clearing takes effect AT ONCE rather than after the settle: a list left
    // standing behind a query the reader has already backspaced away from is
    // a list that is lying for as long as it stands.
    settle.clear()
    setAsked(null)
    setFailure(null)
  })

  /**
   * Is this fetcher still answering the query that is being asked?
   *
   * `createResource` DROPS the return value of a fetcher whose source has moved
   * on; it cannot un-run the fetcher. The answer is therefore safe and the
   * FAILURE SLOT is not — it is a signal every query shares, written from inside
   * the async function after the await — so a slow failure of query A landing
   * after query B succeeded would put A's error under B's rows, and a slow
   * success of A would clear an error that is B's. A box emptied while a call
   * was in flight got the same treatment: a reason for a list nobody can see.
   *
   * `untrack`, because this is read inside an async continuation: as a
   * dependency it would make a fetcher's own resolution a reason to re-run it.
   */
  const answering = (query: string) => untrack(asked) === query

  const [answer] = createResource(asked, async (query: string) => {
    const outcome = await runAsync(
      olai.procedures.search.nodes({
        text: query,
        limit: LIMIT,
        ...(kind === undefined ? {} : { kind }),
      }),
    )
    if (Result.isFailure(outcome)) {
      if (answering(query)) setFailure(outcome.failure.message)
      return null
    }
    if (answering(query)) setFailure(null)
    return outcome.success
  })

  // `undefined` is the resource's "nothing asked for yet"; a palette shows no
  // rows in that state, which is the same thing an empty answer shows.
  return {
    hits: () => answer()?.hits ?? [],
    failure,
    refusals: () => answer()?.refusals ?? [],
    // While a fetch is in flight the rows on screen are the LAST query's, so
    // they answer nothing anybody is asking — and during the debounce, before
    // `asked` moves, they still answer the query they were fetched for.
    //
    // A FAILED CALL ANSWERS NOTHING EITHER, which this used to claim it did: a
    // refused call resolves the resource to `null` with `loading` false, so the
    // rows went empty while this went on naming the query they were supposedly
    // the answer to — and it is published into the markup for a scenario to
    // wait on (`../edges/EdgePanel.tsx`), so a wait for a query's rows was
    // satisfied by a call that never arrived.
    answering: () => (answer.loading || answer() == null ? null : asked()),
  }
}
