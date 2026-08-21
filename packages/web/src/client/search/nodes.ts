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
 * SolidJS ecosystem rather than hand-roll it.
 *
 * WHEN to ask is not here either, and that is the change `vault-in-browser`'s
 * PR 2 made: the settle, the latest-answer-wins rule, the failure slot and
 * WHICH question the rows on screen answer are `../settled.ts`'s, because a
 * third door grew the same four (the row editor's tag vocabulary) and a rule
 * kept in three places is a rule kept in memory. What is left in this file is
 * the two things that are actually search's — WHICH question is worth a trip,
 * and what the answer means.
 *
 * The MATCHING is entirely the server's (`@olai/surface`'s search.ts says
 * why): the same reading an agent's `search_nodes` gets.
 *
 * Its failure is its OWN — a refused search is not a refused `>` ask, and two
 * unrelated async sources sharing one error slot is how a reader is shown the
 * wrong sentence about the wrong thing.
 */

import type { Accessor } from "solid-js"

import type { NodeHit, Refusal, SearchHit } from "@olai/surface"

import { createSettled } from "../settled.ts"
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
  const asked = createSettled(
    // WHAT IS WORTH A TRIP, which is this file's half of the arrangement: the
    // words once trimmed, and only once there are enough of them to mean
    // something. Below the minimum this is `null`, which is what makes the rows
    // clear at once rather than after a settle.
    () => {
      const wanted = text()?.trim() ?? ""
      return wanted.length >= MIN_LENGTH ? wanted : null
    },
    (query) =>
      olai.procedures.search.nodes({
        text: query,
        limit: LIMIT,
        ...(kind === undefined ? {} : { kind }),
      }),
  )

  return {
    hits: () => asked.answer()?.hits ?? [],
    // The uncapped count, off the same answer the rows come off — never
    // `hits.length` and never a second call. Nothing answered is `0`, which is
    // the one reading that makes the sentence under a door disappear rather
    // than claim a denominator nobody has been given (`./count.ts`).
    total: () => asked.answer()?.total ?? 0,
    failure: asked.failure,
    refusals: () => asked.answer()?.refusals ?? [],
    // Straight through: which query the rows answer is the primitive's own
    // fact, read off the value that holds them. This used to be a ternary here
    // over a loading flag and the outstanding question — three signals for one
    // statement, and it got the refused-call case wrong for a while (a call
    // that never arrived went on naming the query it was supposedly the answer
    // to, while the rows behind it were empty). It is published into the markup
    // for a scenario to wait on (`../edges/EdgePanel.tsx`).
    answering: asked.answering,
  }
}
