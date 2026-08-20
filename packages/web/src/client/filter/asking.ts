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
 * ## The four things a round trip costs, and what is done about each
 *
 *   - **A keystroke may not be a request.** {@link SETTLE_MS} is the debounce,
 *     the same primitive and the same number as the shortlist doors' — just
 *     past an ordinary inter-keystroke gap, where it collapses a word into one
 *     question instead of six. It is IMPORTED (`../settled.ts`) rather than
 *     picked: one fact about one pair of hands.
 *   - **An old answer may not land on a new question.** `createResource` drops
 *     the answer to a source that has since moved — the reason the shortlist
 *     doors gave up their sequence counter, and the reason this one never grew
 *     one. The
 *     answer also CARRIES the query it answers, so "which question are these
 *     rows an answer to" is read off the value rather than off a second signal
 *     that could disagree with it by a frame.
 *   - **The answer must MOVE WHEN THE SET DOES.** A filter is a standing view of
 *     a page, not a shortlist somebody opened once: on master it was a memo over
 *     the live derivation, so every published revision re-ran the matcher. A
 *     question keyed on the words alone made a filtered page a photograph of the
 *     directory as it was when the query settled — a row retitled INTO the query
 *     still pruned away, a row retitled out of it still drawn and still counted.
 *     So the SET's own generation is part of the question ({@link Ask.at}), and a
 *     revision re-asks. It is the KEYSTROKE that is debounced, never the
 *     revision: the tree has already redrawn from the local set by then, and a
 *     count that lagged 200ms behind it would be two numbers from two different
 *     moments — the arithmetic `./count.ts` exists to refuse.
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
import {
  type Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  untrack,
} from "solid-js"

import type { Filter } from "@olai/format"
import type { MatchedNode } from "@olai/surface"

import { runAsync } from "../run.ts"
import { SETTLE_MS } from "../settled.ts"
import { unreachable } from "../connection/reaching.ts"
import type { Drawn } from "../page.ts"
import { connectionReadout, olai } from "../wire.ts"
import { showsTrashed } from "./drawn.ts"

// The settle is imported rather than restated (`../settled.ts` argues it: one
// fact about one pair of hands). There is no MIN_LENGTH twin to it here: a
// shortlist of eight over one letter is noise, where narrowing a page to what
// holds an `a` is a question with an answer the reader can see the size of.
//
// THIS DOOR IS NOT A CALLER of that primitive, and that file says why from its
// side: a shortlist is a question somebody opened and closed, where a filter is
// a standing view of a page — which is where the two rules below that it does
// not have come from (an answer that survives a refused call, and a question
// never asked over a dead wire). The set's generation is NOT one of them: that
// primitive takes a value question with an `equals`, exactly as this one does.

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
  /** WHICH query {@link matched} answers — `null` when nothing has answered
   *  the words that are typed, so a caller can say whether the rows on screen
   *  are about them. Read off the answer itself, never stored beside it. */
  readonly answering: Accessor<string | null>
  /** A refused call, in the server's own words — `null` when there is none, and
   *  never a stale one: a call that fails after the question moved on says
   *  nothing. Its own slot, never the grammar's refusals: a refused CALL is the
   *  server saying it could not answer, and a refused QUERY is an answer. */
  readonly failure: Accessor<string | null>
  /** Why a question cannot be asked at all right now — the connection pill's
   *  own sentence — or `null` while it can. */
  readonly offline: Accessor<string | null>
}

/**
 * One ask — the three things that change the answer, so that all three are in
 * the value the resource tracks.
 *
 * The WORDS, obviously. Whether this page's own rows are put-away ones
 * (`@olai/format`'s `Scope.trashed`, which the trash and a zoom onto a trashed
 * node answer `true` — `./drawn.ts`'s `showsTrashed`), because the same words
 * asked on the trash and on an outline are two questions. And the SET ITSELF,
 * which is the one this door needs and a shortlist does not.
 */
interface Ask {
  readonly text: string
  readonly trashed: boolean
  /**
   * The set as it stands, carried as a GENERATION and never read.
   *
   * A FILTER IS A STANDING VIEW: "which nodes match" has a different true
   * answer after every write, so an answer that outlives the set it was
   * computed over is a wrong answer that looks like a right one — a row
   * retitled INTO the query still pruned away, a row retitled out of it still
   * drawn and still counted, with the denominator beside it already moved
   * because the tree redrew from the local set. (That is not hypothetical: it
   * is what this door did between the first commit of this branch and this one,
   * and a probe printed "1 of 11" over a page holding two matches.)
   *
   * The derivation is a fresh value per published revision (`../outlines.ts`
   * patches it), so its identity is exactly "the directory moved" — the
   * cheapest true generation this tab has, and the same one the local matcher
   * used to re-run on. It is NOT dereferenced here, deliberately: this file's
   * whole point is that the browser stopped reading the vault, and what it
   * holds is a token that changes when the answer would.
   */
  readonly at: unknown
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
  (was !== null && is !== null &&
    was.text === is.text && was.trashed === is.trashed && was.at === is.at)

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
  /** THE SET, as a generation — see {@link Ask.at}. Whatever the tab holds that
   *  moves when the directory does; this file never reads it, and asks again
   *  when it changes because the answer would have. */
  readonly at: Accessor<unknown>
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

  // A NEW QUESTION CLEARS THE OLD ONE'S BAD NEWS, at the keystroke rather than
  // at the answer: a refusal is about the words it was refused for, and leaving
  // it up beside a query somebody has since retyped is the door blaming the new
  // question for the old one's trouble. Its own effect, on the question alone,
  // so the reachability tracking below cannot re-run it.
  createEffect(on(question, () => setFailure(null)))

  createEffect(() => {
    const wanted = question()
    if (wanted === null) {
      // Clearing takes effect AT ONCE rather than after the settle: a page
      // narrowed by a query the reader has already backspaced away from is a
      // page that is lying for as long as it stands.
      settle.clear()
      setAsked(null)
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

  /**
   * WHAT IS BEING ASKED, as one value — the words once they stopped moving, the
   * page's scope, and the set's generation. The keystroke is what the debounce
   * holds; the other two go straight through, because the tree has ALREADY
   * redrawn from the local set by the time a revision reaches here and a count
   * that lagged behind it would be two numbers from two different moments.
   *
   * Compared BY VALUE (`sameAsk`), so a revision that left all three alone —
   * which is most of them, since the page value is fresh per frame — is not a
   * refetch.
   */
  const asking = createMemo<Ask | null>(
    () => {
      const text = asked()
      return text === null ? null : { text, trashed: trashed(), at: source.at() }
    },
    null,
    { equals: sameAsk },
  )

  /**
   * Is this fetcher still answering the question that is being asked?
   *
   * `createResource` DROPS the return value of a fetcher whose source has moved
   * on; it cannot un-run the fetcher. So everything below that is not a return
   * value — the failure slot, which is a signal two of them share — needs the
   * guard the framework only gives to the answer: a slow failure of query A
   * landing after query B succeeded would paint B's rows with A's error, and a
   * slow success of A would clear a failure that is B's.
   *
   * `untrack`, because this is read inside an async continuation and reading it
   * as a dependency would make the fetcher's own resolution a reason to re-run.
   */
  const answering = (ask: Ask) => sameAsk(untrack(asking), ask)

  const [answer] = createResource<Answered | null, Ask>(asking, async (ask, info) => {
    const outcome = await runAsync(
      olai.procedures.search.matching({
        text: ask.text,
        ...(ask.trashed ? { trashed: true } : {}),
      }),
    )
    if (Result.isFailure(outcome)) {
      if (answering(ask)) setFailure(outcome.failure.message)
      // WHAT THE SERVER LAST SAID STANDS. A call that did not arrive is not an
      // answer of "nothing matched", and emptying the page under somebody
      // because a socket blinked would be exactly that lie. The failure is on
      // screen beside the rows, which is what makes keeping them honest.
      return info.value ?? null
    }
    if (answering(ask)) setFailure(null)
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
    /**
     * WHICH QUERY THE ROWS ANSWER — read off the answer's own text, and off
     * nothing else.
     *
     * NOT `loading`, which this used to fold in and which says something
     * different: while a REVISION re-ask is in flight the rows still answer the
     * words that are typed — they are one revision behind, not about another
     * question — and unlabelling them there would put the wait word on screen
     * for every edit anybody makes anywhere in the vault. The two states this
     * has to tell apart are "these rows are about your query" and "these rows
     * are about a query you have moved on from", and the text on the answer is
     * exactly that fact.
     */
    answering: () => held()?.text ?? null,
    failure,
    offline,
  }
}
