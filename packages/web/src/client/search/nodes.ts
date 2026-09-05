/**
 * Search shared by the palette, header and node pickers. Queries debounce,
 * then subscribe to server-side matching until the input is cleared. Vault
 * revisions refresh hits and totals without another keystroke.
 *
 * Keep the previous query’s rows during a new request, labelled with the query
 * they answer so Enter cannot spend them as the new answer. Closing or
 * clearing the search discards that history and releases the subscription.
 */

import { debounce } from "@solid-primitives/scheduled"
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js"

import type { NodeHit, Refusal, SearchAnswer, SearchHit } from "@olai/surface"

import { SETTLE_MS, type Taking } from "../settled.ts"
import { olai } from "../wire.ts"

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
  /**
   * HOW MANY MATCHED IN ALL — uncapped, where {@link hits} is only what
   * {@link LIMIT} let through. `0` when nothing has answered.
   *
   * The cap is a fact about a DOOR and the total is a fact about the QUERY, and
   * this is the number every door here had and did not pass on: an answer
   * carries it precisely so that "eight of ninety" is sayable (`@olai/format`'s
   * `SearchAnswer`, `@olai/ops`' `query.ts`), and the two doors drew eight rows
   * and said nothing. What a door SAYS with it is `./count.ts`.
   *
   * READ OFF THE SAME VALUE THE HITS ARE, which is what keeps the pair from
   * being two numbers out of two moments: while a newer query is in flight the
   * rows hold still, and this holds still with them — so a line under them
   * counts the rows a reader is looking at rather than the answer they are
   * waiting for.
   */
  readonly total: Accessor<number>
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
   * what is drawn is not what was asked: the settle, and the flight. The
   * primitive under this refuses one of them outright — a query backspaced
   * below the minimum clears AT ONCE — and answers the other by CARRYING the
   * query on the answer, so a longer second query keeps the first one's rows
   * until its own arrive (the right thing to DRAW) without leaving them
   * unlabelled (`../settled.ts`).
   *
   * What it is FOR is anything that has to tell one answer from the next — a
   * scenario waiting for the rows of the query it just typed rather than for
   * any rows at all (`edges/EdgePanel.tsx` puts it in the markup), and whatever
   * eventually wants to draw the difference.
   */
  readonly answering: Accessor<string | null>
  /** {@link answering} AS AN ACT — `../settled.ts`'s `Taking`, straight
   *  through. Every door of this reading takes a row on `Enter`, and this is
   *  what one of those takes goes through. */
  readonly taking: Taking
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
  const wanted = createMemo(() => {
    const query = text()?.trim() ?? ""
    return query.length >= MIN_LENGTH ? query : null
  })
  const [asked, setAsked] = createSignal<string | null>(null)
  const settle = debounce(setAsked, SETTLE_MS)
  createEffect(() => {
    const query = wanted()
    if (query !== null) settle(query)
    else {
      settle.clear()
      setAsked(null)
    }
  })
  const input = createMemo(() => {
    const query = asked()
    return query === null ? null : {
      text: query, limit: LIMIT, ...(kind === undefined ? {} : { kind }),
    }
  })
  const answer = olai.streams.searchResults.use(input)
  // Hold the prior query's rows during a new request, but never across closing
  // the search or a refused subscription. The label gates keyboard result gestures.
  const held = createMemo<{ query: string; value: SearchAnswer } | undefined>((previous) => {
    const query = asked()
    if (wanted() === null || query === null || answer.error() !== undefined) return undefined
    const value = answer()
    return value === undefined ? previous : { query, value }
  }, undefined)
  const answering = () => {
    const got = held()
    return got !== undefined && got.query === wanted() ? got.query : null
  }
  return {
    hits: () => held()?.value.hits ?? [],
    total: () => held()?.value.total ?? 0,
    failure: () => answer.error()?.message ?? null,
    refusals: () => held()?.value.refusals ?? [],
    answering,
    taking: (act) => { if (answering() !== null) act() },
  }
}
