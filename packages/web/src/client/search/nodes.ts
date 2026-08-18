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

import { type Accessor, createEffect, createResource, createSignal } from "solid-js"
import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"

import type { Refusal, SearchHit } from "@olai/surface"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"

/** How long a keystroke waits for the next one. A whole round trip sits
 *  behind this, so it is pitched just past an ordinary inter-keystroke gap
 *  rather than under it, where it would collapse nothing. */
const SETTLE_MS = 200

/** Below this the answer is noise: two characters match half an outline by
 *  substring. The shell items still filter locally, so the palette is never
 *  blank while somebody types. */
const MIN_LENGTH = 3

/** How many nodes a DOOR of this shows — every one of them, which is what
 *  makes it a constant here rather than an argument. Fewer than the tool's
 *  twelve: each of these is a shortlist over a page a reader is standing on
 *  (a modal, a box in the header, a panel under a row), not a report. */
const LIMIT = 8

export interface NodeSearch {
  readonly hits: Accessor<ReadonlyArray<SearchHit>>
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
export const createNodeSearch = (text: Accessor<string | null>): NodeSearch => {
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

  const [answer] = createResource(asked, async (query: string) => {
    const outcome = await runAsync(
      olai.procedures.search.nodes({ text: query, limit: LIMIT }),
    )
    if (Result.isFailure(outcome)) {
      setFailure(outcome.failure.message)
      return null
    }
    setFailure(null)
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
    answering: () => (answer.loading ? null : asked()),
  }
}
