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
 * ## What a dead wire does, and why there is nothing here about it
 *
 * A filter over a local copy kept working with the socket down; a filter that
 * is a question does not. This door used to answer that for itself — no
 * question asked while the wire was down, the box inert wearing the pill's own
 * words. It does not any more, because the app-wide ruling landed: a wire that
 * cannot carry a question FREEZES THE APP under an overlay
 * (`vault-in-browser.md` §5b, `../connection/Offline.tsx`), so no keystroke
 * ARRIVES to be refused and there is no box on screen to draw a reason on. What
 * is left here is the one rule the freeze does not make: the last answer stands
 * through a refused call, because a narrowed page may not blank under somebody
 * because a socket blinked.
 *
 * ONE QUESTION CAN STILL BE SENT INTO A DEAD SOCKET, and it is worth naming
 * rather than implying it away: the settle already ticking when the wire drops
 * ({@link SETTLE_MS}) fires into it, where the deleted guard used to clear the
 * timer. Both branches are honest. If the call is refused, the failure lands in
 * its own slot with the answered rows still standing — the rule above — and it
 * is drawn BEHIND the overlay, where nobody is reading it; when the wire
 * returns, the generation below re-asks and a successful answer clears it. If
 * the socket comes back first, the call simply lands. Clearing the timer
 * instead would mean this door reading the connection again — the exact thing
 * the overlay took away from it — to suppress a line nobody can see, so the
 * tail is documented rather than closed. (opencode, review of #277.)
 *
 * COMING BACK IS ALREADY WRITTEN, and it is the set's generation that writes
 * it ({@link Ask.at}): a reconnect re-opens the subscription with a full
 * snapshot, the derivation is a fresh value, and the question this door is
 * standing on is asked again against the wire that came back. Nothing had to
 * be added for the reconnect; the standing-view rule already covered it.
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
import type { Drawn } from "../page.ts"
import { olai } from "../wire.ts"
import { showsTrashed } from "./drawn.ts"
import { type Matches, sameMatches } from "./matches.ts"

// The settle is imported rather than restated (`../settled.ts` argues it: one
// fact about one pair of hands). There is no MIN_LENGTH twin to it here: a
// shortlist of eight over one letter is noise, where narrowing a page to what
// holds an `a` is a question with an answer the reader can see the size of.
//
// THIS DOOR IS NOT A CALLER of that primitive, and that file says why from its
// side: a shortlist is a question somebody opened and closed, where a filter is
// a standing view of a page — which is where the ONE rule below that it does not
// have comes from: an answer that survives a refused call. There were two until
// the offline overlay landed, and the second ("never asked over a dead wire") is
// the freeze's job now, as the header says. The set's generation is NOT a third:
// that primitive takes a value question with an `equals`, exactly as this one
// does.

// THERE IS NO COALESCE HERE, and that is a measurement rather than an omission
// (`reactivity-after-the-flip` §3.5, which asked for one; PR 4 measured it and
// did not ship it). The finding it was asked for is real: one whole-vault
// `search.matching` goes out per page frame, so one bulk gesture over a 90,000
// node vault — thirty rows picked and ticked off — costs nine of them
// (`packages/tests/wire.ts`'s `filter` session, which is the instrument).
//
// What is NOT true is that a window here collapses them. A page frame arrives
// at most once per PUBLISHED REVISION, and the two ways a burst of writes
// reaches this tab are both already spaced further apart than any window this
// door could honestly hold. Writes that arrive OFF THE DISK — a `git pull`, an
// agent rewriting a file — are collapsed into one probe behind `@olai/store`'s
// 75ms settle before a revision is published at all
// (`packages/store/src/store.ts`'s sync loop, step 2). Writes made HERE are not
// that case and are the one measured: a bulk gesture sends its edits one at a
// time through the editor's own queue (`../writes.ts`'s `applyingAll`), each
// answered before the next goes out, so the frames come back a procedure round
// trip apart — which on a 90,000-node vault is already longer than a paint.
// Every window short enough to keep a filtered page's counts honest beside the
// tree they are drawn next to (which is `./count.ts`'s whole argument, and why
// the revision was never put behind {@link SETTLE_MS}) is shorter than either
// gap. Built and measured both ways — leading-and-trailing throttle over a
// paint, plus a hold for the flight — the same gesture cost 9 searches before
// and 8 after, which is the noise between two runs of it.
//
// What DID reproduce is the second half of that finding, and it is fixed below:
// a fresh `Map` per answer made `./narrowing.ts` prune the whole page again for
// a match set that had not moved. See {@link ./matches.ts}.

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
   * What the caller hands over is a count of the frames THIS PAGE's reading
   * moved on (`../reading.tsx`'s `Reading.at`) — narrower than the token it
   * replaced, which was the identity of the tab's own derivation and therefore
   * moved on every write anywhere in the vault. A revision that changed nothing
   * on this page sends no frame at all, so it cannot invalidate an answer about
   * it. It is NOT dereferenced here, deliberately: this file's whole point is
   * that the browser stopped reading the vault, and what it holds is a token
   * that changes when the answer would.
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
   * WHAT THE PAGE DRAWS, unfiltered — taken from the page itself rather than as
   * a thunk the caller had to remember to write.
   *
   * ONE thing is read off it and it is the matcher's question about SCOPE:
   * whether the rows in front of somebody are put-away ones
   * ({@link showsTrashed}), which is the one thing the matcher is told about the
   * QUESTION rather than asked about the answer.
   *
   * WHETHER TO ASK AT ALL IS NOT READ OFF IT any more, and that is
   * `reactivity-after-the-flip` §3.1's 1.6. It used to gate the question on the
   * page having rows — `none` while a pane's answer was in flight — which made
   * every navigation clear the standing answer and re-debounce the query the
   * address had already spelled. A page with nothing to narrow narrows nothing
   * whatever this asks; what makes these words a question is the parse.
   */
  readonly page: Accessor<Drawn>
  /** THE SET, as a generation — see {@link Ask.at}. Whatever the tab holds that
   *  moves when the directory does; this file never reads it, and asks again
   *  when it changes because the answer would have. */
  readonly at: Accessor<unknown>
  /**
   * WHICH PAGE these words narrow, as an identity and never read — the caller's
   * own answer to "is this the same page" (`../routes.ts`'s `samePage`, the memo
   * the pane's subscription is opened on).
   *
   * It is here for ONE distinction, and it is the one {@link SETTLE_MS} is
   * about: a settle is a fact about a pair of HANDS, and the words that arrive
   * with an address were not typed. A `?q=` reached by a pin, by Back or by a
   * cold load is final the moment it is on screen, so waiting 200ms to ask about
   * it is 200ms of a page drawn WHOLE that the address said was narrowed. Same
   * page, moving words: somebody is typing, and the debounce is the point.
   */
  readonly opened: Accessor<unknown>
}): Asked => {
  const [failure, setFailure] = createSignal<string | null>(null)
  /** What has actually been asked for: the query, once it stopped moving. */
  const [asked, setAsked] = createSignal<string | null>(null)
  const settle = debounce(setAsked, SETTLE_MS)

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
    source.query().kind === "asking" ? source.text().trim() : null
  )

  // A NEW QUESTION CLEARS THE OLD ONE'S BAD NEWS, at the keystroke rather than
  // at the answer: a refusal is about the words it was refused for, and leaving
  // it up beside a query somebody has since retyped is the door blaming the new
  // question for the old one's trouble. Its own effect, on the question alone,
  // so the reachability tracking below cannot re-run it.
  createEffect(on(question, () => setFailure(null)))

  /**
   * WHEN TO ASK: at once for a query nobody typed, after the settle for one
   * somebody is typing.
   *
   * The PAGE is tracked as well as the words, and what it is for is that
   * distinction. Every arrival — a pin, Back, a link with a `?q=` on it, the
   * first paint of a filtered address — brings a query that is already final,
   * and a debounce over it is a page drawn WHOLE for 200ms in front of somebody
   * who asked for it narrowed. A keystroke changes the words and leaves the page
   * where it was, which is the one case the settle exists for.
   *
   * It used to be the ARRIVAL that restarted the settle, not the words: the
   * question also read whether the page had rows at all, that collapsed to
   * `none` for the length of every navigation, and the clear below fired on the
   * way past — so a `?q=` destination dropped the answer it had, drew whole, and
   * re-debounced from the frame its page landed
   * (docs/brainstorming/reactivity-after-the-flip.md §3.1's 1.6). What a page
   * has in it is the matcher's question about SCOPE ({@link Ask.trashed}) and
   * never whether to ask at all; whether these words are a question is the
   * parse's answer, and the parse is a reading of the box.
   */
  createEffect<unknown>((was) => {
    const wanted = question()
    const here = source.opened()
    if (wanted === null) {
      // Clearing takes effect AT ONCE rather than after the settle: a page
      // narrowed by a query the reader has already backspaced away from is a
      // page that is lying for as long as it stands.
      settle.clear()
      setAsked(null)
    } else if (here !== was) {
      settle.clear()
      setAsked(wanted)
    } else {
      settle(wanted)
    }
    return here
  }, undefined)

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

  /**
   * THE ANSWER, HELD BY VALUE — a memo rather than a thunk, and the whole of
   * what it adds is {@link sameMatches}.
   *
   * The matcher mints a fresh `Map` of fresh rows for every answer, and a page
   * re-asked because its set moved is overwhelmingly answered with the set of
   * ids it already had. Handed straight out, each of those made
   * `./narrowing.ts`'s `selected` a new value, which made `drawn` prune the
   * whole tree again for a result identical to the one on screen — a second
   * full walk of the page per frame, on top of the round trip
   * (docs/brainstorming/reactivity-after-the-flip.md §3.5). Returning the same
   * `Map` for the same answer stops all of it at the memo.
   */
  const matched = createMemo<Matches | undefined>(() => held()?.matches, undefined, {
    equals: sameMatches,
  })

  return {
    matched,
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
  }
}
