/**
 * The page's filter, ASKED — which nodes the query selects, answered by the
 * server, latest answer wins.
 *
 * ## Why this file exists at all
 *
 * It used to be one line: the tab held every node of every outline, so the
 * matcher ran here, over the local copy, per keystroke. That copy is what
 * `docs/brainstorming/vault-in-browser.md` is taking away — the browser may
 * hold at most the page in front of somebody — and this is the first step out
 * of it (`search-server-side`, ruled by the human 2026-08-19). The ruling
 * KNOWINGLY reverses `brainstorming/filter-in-place.md`'s "a round trip per
 * keystroke is the wrong shape for a view that narrows as you type": the round
 * trip is the price of a browser that does not hold the vault, and the debounce
 * and the staleness rule below are what that price is actually made of.
 *
 * ONE MATCHER STILL. Nothing here decides what a query means or which nodes it
 * selects — `@olai/format`'s `parseFilter` / `matching` does, on the other side
 * of the wire, which is the same function this file used to call on this side.
 * What is left in the browser is the GRAMMAR read over the box's own text
 * (`./narrowing.ts` parses for the refusals, the words to light and whether
 * there is a query at all), which reads the query string and nothing about the
 * directory — a parse is not a scan.
 *
 * ## The three things a round trip costs, and what is done about each
 *
 *   - **A keystroke may not be a request.** {@link SETTLE_MS} is the debounce,
 *     the same primitive and the same reasoning as `../search/nodes.ts`'s: just
 *     past an ordinary inter-keystroke gap, where it collapses a word into one
 *     question instead of six.
 *   - **An old answer may not land on a new question.** `createResource` drops
 *     the answer to a source that has since moved — the reason that file gave
 *     up its sequence counter, and the reason this one never grew one. The
 *     answer also CARRIES the query it answers, so "which question are these
 *     rows an answer to" is read off the value rather than off a second signal
 *     that could disagree with it by a frame.
 *   - **The page may not blank while it waits.** The rows on screen stay the
 *     rows the last answer left until the next one lands (`latest`), and before
 *     the FIRST answer of a filter session there is nothing to narrow by, which
 *     `./narrowing.ts` draws as the whole page rather than as an empty one. The
 *     bar says which of the two a reader is looking at, so nothing on screen is
 *     unlabelled — what it must never do is show the wrong rows silently.
 *
 * ## What a dead wire does, decided rather than inherited
 *
 * A filter over a local copy kept working with the socket down; a filter that
 * is a question does not. The ruling for the app as a whole is an offline
 * overlay that freezes it (`vault-in-browser.md` §5b), and that is its own PR.
 * Until it lands, this door does the honest small thing: while the connection
 * cannot carry a question, none is asked, the last answer stands (which is what
 * the pill already promises — "what is on screen is the last thing the server
 * said"), and the box goes inert wearing the pill's own words
 * ({@link Asked.offline}, drawn by `./FilterBar.tsx`). Nothing pretends: an
 * unreachable server never gets a question queued behind somebody's typing.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import { type Accessor, createEffect, createMemo, createResource, createSignal } from "solid-js"

import type { Filter } from "@olai/format"
import type { MatchedNode } from "@olai/surface"

import { unreachable } from "../connection/reaching.ts"
import type { Drawn } from "../page.ts"
import { runAsync } from "../run.ts"
import { SETTLE_MS } from "../search/nodes.ts"
import { connectionReadout, olai } from "../wire.ts"
import { showsTrashed } from "./drawn.ts"

/** No MIN_LENGTH twin to the settle this imports: a shortlist of eight over
 *  one letter is noise, where narrowing a page to what holds an `a` is a
 *  question with an answer the reader can see the size of. */

/** What a query selected, ready for a row to look itself up in: id → why. The
 *  server's own answer rows, kept as they arrived rather than re-shaped — the
 *  `matched` field is what `./why.ts` reads to draw a note excerpt, and a
 *  second shape here would be a second reading of it. */
export type Matches = ReadonlyMap<string, MatchedNode>

/** What the page's filter has been told. */
export interface Asked {
  /**
   * The nodes the query selects across the set, or `undefined` for "nothing has
   * been answered yet".
   *
   * The distinction is load-bearing and is why this is not an empty map: a
   * query that selected nothing PRUNES the page to nothing, and a query that
   * has not been answered yet must not (`./narrowing.ts` draws the difference).
   */
  readonly matched: Accessor<Matches | undefined>
  /** WHICH query {@link matched} answers — `null` while a fetch is in flight,
   *  so a caller can say whether the rows on screen answer what is typed. Read
   *  off the answer itself, never stored beside it. */
  readonly answering: Accessor<string | null>
  /** A refused call, in the server's own words — `null` when there is none.
   *  Its own slot, never the grammar's refusals: a refused CALL is the server
   *  saying it could not answer, and a refused QUERY is an answer. */
  readonly failure: Accessor<string | null>
  /** Why a question cannot be asked at all right now — the connection pill's
   *  own sentence — or `null` while it can. */
  readonly offline: Accessor<string | null>
}

/** One ask: what was typed, and whether this page's own rows are put-away ones
 *  (`@olai/format`'s `Scope.trashed`, which the trash and a zoom onto a trashed
 *  node answer `true` — `./drawn.ts`'s `showsTrashed`). Both are in the value
 *  the resource tracks, because both change the answer: the same words asked on
 *  the trash and on an outline are two questions. */
interface Ask {
  readonly text: string
  readonly trashed: boolean
}

/** An answer, and the question it answers — one value, so "which query are
 *  these rows about" is read off the same thing that holds them rather than off
 *  a signal beside it that is free to be a frame ahead. */
interface Answered {
  readonly text: string
  readonly matches: Matches
}

const sameAsk = (was: Ask | null, is: Ask | null): boolean =>
  was === is ||
  (was !== null && is !== null && was.text === is.text && was.trashed === is.trashed)

/**
 * Ask as the question changes.
 *
 * IT TAKES THE PARSE, not a conditional the caller wrote: whether there is a
 * question at all is one predicate over one parsed value, and spelling it in
 * the pane as well would be two places that have to agree about when the wire
 * is worth a trip. An empty box and a query the grammar refused are both
 * answered by the parse — the first selects nothing and the second is a
 * refusal already on screen — so neither travels.
 */
export const createAsked = (source: {
  /** What the grammar made of the box (`@olai/format`'s `parseFilter`, done by
   *  the caller because the reading beside this one needs the same value). */
  readonly query: Accessor<Filter>
  /** ...and the box itself, which is what actually goes on the wire: the parse
   *  is a value, and what the server is asked is the words. */
  readonly text: Accessor<string>
  /**
   * WHAT THE PAGE DRAWS, unfiltered — the two things about it this question
   * depends on, taken from the page itself rather than as two thunks a caller
   * had to remember to write.
   *
   * It answers whether the rows in front of somebody are put-away ones
   * ({@link showsTrashed}, the one thing the matcher is told about the QUESTION)
   * and whether there is anything to narrow at all: a pane whose page has not
   * arrived yet draws `none`, and asking then would spend a walk of the whole
   * set on a scope that is about to change under the answer.
   */
  readonly page: Accessor<Drawn>
}): Asked => {
  const [failure, setFailure] = createSignal<string | null>(null)
  /** What has actually been asked for: the query, once it stopped moving. */
  const [asked, setAsked] = createSignal<string | null>(null)
  const settle = debounce(setAsked, SETTLE_MS)

  const offline = createMemo(() => unreachable(connectionReadout()))

  /** Whether this page's own rows are already put-away ones — a MEMO, because
   *  the page it reads is a fresh value on every revision the store publishes
   *  and the whole of what this takes from it is a boolean that is constant for
   *  four of the five shapes. Read inline, every edit anywhere in the vault
   *  would re-scan a page's roots to arrive at the answer it already had. */
  const trashed = createMemo(() => showsTrashed(source.page()))

  /** What goes on the wire, or `null` for a box that is not asking anything.
   *
   *  TRIMMED, and that is the one normalisation this file does: the box keeps
   *  what somebody typed, spaces and all (a filter is in the ADDRESS, and a
   *  trailing space is a keystroke on the way to the next word), while the
   *  QUESTION is the words. Untrimmed, an answer would come back labelled
   *  `"herb "` where every reader of it compares against `"herb"`, and the bar
   *  would say it was still filtering for as long as that space stood. */
  const question = createMemo(() =>
    source.query().kind === "asking" && source.page().kind !== "none"
      ? source.text().trim()
      : null
  )

  createEffect(() => {
    const wanted = question()
    if (wanted === null) {
      // Clearing takes effect AT ONCE rather than after the settle: a page
      // narrowed by a query the reader has already backspaced away from is a
      // page that is lying for as long as it stands.
      settle.clear()
      setAsked(null)
      setFailure(null)
      return
    }
    // A QUESTION THAT CANNOT REACH THE SERVER IS NOT ASKED, and nothing is
    // queued behind the reader's typing to be sent when it can: what is on
    // screen stays the last thing the server said, the box is inert, and the
    // pill's words say why. Tracking the readout is what re-asks when the wire
    // comes back — the current question, not the one that was typed while it
    // was down.
    if (offline() !== null) {
      settle.clear()
      return
    }
    settle(wanted)
  })

  const asking = createMemo<Ask | null>(
    () => {
      const text = asked()
      return text === null ? null : { text, trashed: trashed() }
    },
    null,
    { equals: sameAsk },
  )

  const [answer] = createResource<Answered | null, Ask>(asking, async (ask, info) => {
    const outcome = await runAsync(
      olai.procedures.search.matching({
        text: ask.text,
        ...(ask.trashed ? { trashed: true } : {}),
      }),
    )
    if (Result.isFailure(outcome)) {
      setFailure(outcome.failure.message)
      // WHAT THE SERVER LAST SAID STANDS. A call that did not arrive is not an
      // answer of "nothing matched", and emptying the page under somebody
      // because a socket blinked would be exactly that lie. The failure is on
      // screen beside the rows, which is what makes keeping them honest.
      return info.value ?? null
    }
    setFailure(null)
    // Keyed by the node's own id, which is what a row looks itself up by
    // (`@olai/format`'s `Selected`). Filled by a loop rather than from an array
    // of pairs: this is the one allocation in the feature that is the size of
    // the answer, and the pairs would be a second one of the same size, thrown
    // away by the line that reads them.
    const matches = new Map<string, MatchedNode>()
    for (const one of outcome.success.matches) matches.set(one.id, one)
    return { text: ask.text, matches }
  })

  /**
   * ONLY WHILE SOMETHING IS ASKED, which is the guard the resource does not
   * give: `latest` keeps the last value it resolved even after the source goes
   * away, so a box emptied and typed into again would draw the PREVIOUS
   * filter's rows for the length of a settle — the whole page, then four rows
   * of an answer to a question nobody asked, then the answer. Holding still is
   * only honest between two queries of one session; across a clear there is
   * nothing to hold, and the page is whole until the first answer lands.
   */
  const held = () => (asked() === null ? undefined : answer.latest)

  return {
    matched: () => held()?.matches,
    // In flight, the rows on screen are the LAST query's, so they answer
    // nothing anybody is asking — and during the settle, before `asked` moves,
    // they answer the query they were fetched for, which is what the text
    // riding on the answer says.
    answering: () => (answer.loading ? null : held()?.text ?? null),
    failure,
    offline,
  }
}
