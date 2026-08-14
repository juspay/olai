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
 * why): the same reading an agent's `search_nodes` gets, semantic index
 * included. This file decides only WHEN to ask.
 *
 * Its failure is its OWN — a refused search is not a refused `>` ask, and two
 * unrelated async sources sharing one error slot is how a reader is shown the
 * wrong sentence about the wrong thing.
 */

import { type Accessor, createEffect, createResource, createSignal } from "solid-js"
import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"

import type { SearchHit } from "@olai/surface"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"

/** How long a keystroke waits for the next one. A whole round trip sits
 *  behind this — a substring pass over the corpus and, where recall is on, an
 *  embedding of the query (measured at about 4 ms) — so it is pitched just past
 *  an ordinary inter-keystroke gap rather than under it, where it would
 *  collapse nothing. */
const SETTLE_MS = 200

/** Below this the answer is noise: two characters match half an outline by
 *  substring and mean nothing to an embedder. The shell items still filter
 *  locally, so the palette is never blank while somebody types. */
const MIN_LENGTH = 3

/** How many nodes the palette shows. Fewer than the tool's twelve: this is a
 *  modal over the page, not a report. */
const LIMIT = 8

export interface NodeSearch {
  readonly hits: Accessor<ReadonlyArray<SearchHit>>
  /** A refusal from the server, in its own words — `null` when there is none.
   *  Never silently dropped (`../run.ts` forbids a silent handler). */
  readonly failure: Accessor<string | null>
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

  const [hits] = createResource(asked, async (query: string) => {
    const outcome = await runAsync(
      olai.procedures.search.nodes({ text: query, limit: LIMIT }),
    )
    if (Result.isFailure(outcome)) {
      setFailure(outcome.failure.message)
      return []
    }
    setFailure(null)
    return outcome.success.hits
  })

  // `undefined` is the resource's "nothing asked for yet"; a palette shows no
  // rows in that state, which is the same thing an empty answer shows.
  return { hits: () => hits() ?? [], failure }
}
