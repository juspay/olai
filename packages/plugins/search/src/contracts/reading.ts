/** Search queries are owned by the active provider. Consumers keep their own
 * input and cursor; withdrawal disposes its reading and reports absence. A
 * returned provider starts a fresh query, never reviving the old response. */
import { serviceTag } from "@olai/plugin-api/contracts"
import { createKeyedRoot } from "@kolu/surface/solid"
import { readService } from "@olai/web/client/services.ts"
import type { Accessor } from "solid-js"
import type { NodeHit, Refusal, SearchHit } from "@olai/surface"
import type { Taking } from "@olai/web/client/settled.ts"
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

export type SearchProvider = (text: Accessor<string | null>, kind?: "node" | "document") => Search
export const readings = serviceTag<SearchProvider>("search.readings")
export function createSearch(text: Accessor<string | null>, kind: "node"): Search<NodeHit>
export function createSearch(text: Accessor<string | null>): Search
export function createSearch(text: Accessor<string | null>, kind?: "node" | "document"): Search {
  return followReading(() => readService(readings), text, kind)
}

/** The consumer scope owns each acquired query, so provider replacement cannot
 * leave a departed subscription or actionable answer behind. */
export function followReading(
  provider: Accessor<SearchProvider | undefined>,
  text: Accessor<string | null>,
  kind?: "node" | "document",
): Search {
  const reading = createKeyedRoot(provider, value => value?.(text, kind))
  const absent = () => reading() === undefined && (text()?.trim().length ?? 0) >= 3
  const unavailable = "Search is unavailable: the search plugin is not running, so there is no matcher to look this up in."
  return {
    hits: () => reading()?.hits() ?? [],
    total: () => reading()?.total() ?? 0,
    failure: () => reading()?.failure() ?? (absent() ? unavailable : null),
    refusals: () => reading()?.refusals() ?? (absent() ? [{ token: text()!.trim(), reason: unavailable }] : []),
    answering: () => reading()?.answering() ?? null,
    taking: act => reading()?.taking(act),
  }
}
