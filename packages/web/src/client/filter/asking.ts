/**
 * The page's filter, ASKED — which nodes the query selects on the page in front
 * of somebody, subscribed to and kept live.
 *
 * ## Why this file exists at all
 *
 * It used to be one line: the tab held every node of every outline, so the
 * matcher ran here, over the local copy, per keystroke. That copy is what
 * `docs/brainstorming/vault-in-browser.md` took away — the browser may hold at
 * most the page in front of somebody — and what replaced it was a PROCEDURE
 * (`search.matching`), debounced and stale-guarded.
 *
 * A procedure was the wrong shape, and this file is the second half of that
 * story (`docs/brainstorming/filter-rides-the-page.md`, roadmap
 * `filter-ask-carries-revision`). A FILTER IS A STANDING VIEW: "which nodes
 * match" has a different true answer after every write, so an answer that
 * outlives the set it was computed over is a wrong answer that looks like a
 * right one — a row retitled INTO the query still pruned away, a row retitled
 * out of it still drawn and still counted. Asked as a call, the only way to
 * hold that line was to re-ask on a GENERATION that moved once per page frame,
 * and each ask was a walk of the whole vault: one bulk gesture over a 90,000
 * node vault cost nine of them, and no coalescing window in a browser collapses
 * them (built both ways in #290, measured 9→8, deleted).
 *
 * So the narrowing is a READING now, beside the page's own — the server matches
 * over the records that page draws and re-sends only when a revision moved
 * which of them match. What this file is left holding is the two facts a stream
 * cannot know: WHEN a pair of hands has stopped typing, and WHICH question the
 * rows on screen are an answer to.
 *
 * ONE MATCHER STILL. Nothing here decides what a query means or which nodes it
 * selects — `@olai/format`'s `parseFilter` / `matchOf` does, on the other side
 * of the wire, which is the same function this file used to call on this side.
 * What is left in the browser is the GRAMMAR read over the box's own text
 * (`./narrowing.ts` parses for the refusals, the words to light and whether
 * there is a query at all), which reads the query string and nothing about the
 * directory — a parse is not a scan.
 *
 * ## The four things the round trip cost, and what is left of each
 *
 *   - **A keystroke may not be a request.** {@link SETTLE_MS} is the debounce,
 *     the same primitive and the same number as the shortlist doors' — just
 *     past an ordinary inter-keystroke gap, where it collapses a word into one
 *     question instead of six. It is IMPORTED (`../settled.ts`) rather than
 *     picked: one fact about one pair of hands. It survives the move to a
 *     stream unchanged, because a subscription RE-OPENS whenever its input
 *     notifies and a word typed would be six of those.
 *   - **An old answer may not land on a new question.** The framework's, now:
 *     a reactive subscription re-arms its whole lifecycle when its input moves
 *     — fresh fiber, value blanked, `error` cleared — so neither an answer nor
 *     a failure belonging to the query before can arrive under the query now.
 *     That was a `sameAsk` guard and an `untrack`ed re-read of the source; it
 *     is a law rather than a rule this file keeps. The answer still CARRIES the
 *     query it answers, because "which question are these rows about" must be
 *     read off the value that holds them rather than off a signal beside it
 *     that could disagree by a frame.
 *   - **The answer must MOVE WHEN THE SET DOES.** The server's, now, and this
 *     is the whole of the change: the reading is re-read on the same revision
 *     pulse the page rides and sent when it moved BY VALUE. There is no
 *     generation here to carry, because the browser holds no token about a set
 *     it does not have — and a bulk gesture that ticks thirty rows off a page
 *     filtered by a word in their titles now costs the wire nothing at all.
 *   - **The page may not blank while it waits.** The rows on screen stay the
 *     rows the last answer left until the next one lands ({@link stood}), and
 *     before the FIRST answer of a filter session there is nothing to narrow
 *     by, which `./narrowing.ts` draws as the whole page rather than as an
 *     empty one. The bar says which of the two a reader is looking at, so
 *     nothing on screen is unlabelled — what it must never do is show the wrong
 *     rows silently.
 *
 * ## What a dead wire does
 *
 * The app-wide ruling landed before this change and is unaffected by it: a wire
 * that cannot carry a question FREEZES THE APP under an overlay
 * (`vault-in-browser.md` §5b, `../connection/Offline.tsx`), so no keystroke
 * arrives to be refused and there is no box on screen to draw a reason on.
 *
 * WHAT IS LEFT is the one rule the freeze does not make — the last answer
 * stands while the wire is away, because a narrowed page may not blank under
 * somebody because a socket blinked — and the one line the box still draws for
 * itself: a stream that could not be READ says so ({@link Asked.failure}), in
 * the server's own words, beside the rows it did not replace. That line used to
 * be a refused call and is a failed subscription now; what it means to a reader
 * is identical, and `./count.ts` still decides what the count says beside it.
 * The subscription is ENROLLED (`.use()`), so a stream that stopped is ALSO a
 * fact the connection readout carries — the local line is the specific news and
 * the pill is the general one, which is the arrangement every other reading in
 * this client already has.
 *
 * COMING BACK NEEDS NO CODE AT ALL, which is the sharpest thing the shape
 * bought: a reconnect re-opens every subscription with a fresh snapshot, and an
 * EQUAL one notifies nobody (the framework's change-iff-fired law). Where this
 * door once re-asked its standing query off a generation, it now does what the
 * page beside it does — nothing.
 */

import { type Accessor, createMemo } from "solid-js"

import type { Filter, NarrowingAnswer, NarrowingRequest, PageRequest } from "@olai/format"
import { sameNarrowingRequest } from "@olai/format"
import type { MatchedNode } from "@olai/surface"

import { olai } from "../wire.ts"
import type { Matches } from "./matches.ts"
import { createTyped } from "./typed.ts"

// THE SETTLE is `./typed.ts`, which is one rule about one pair of hands and is
// now asked by two readings — this one, and the everywhere page whose own
// request carries the words. There is no MIN_LENGTH twin to it here: a
// shortlist of eight over one letter is noise, where narrowing a page to what
// holds an `a` is a question with an answer the reader can see the size of.
//
// THIS DOOR IS NOT A CALLER of `../settled.ts`, and that file says why from its
// side: a shortlist is a question somebody opened and closed, where a filter is
// a standing view of a page. What it takes from that primitive is the NUMBER
// and nothing else — the latest-answer rule, the failure slot and the clear are
// a subscription's lifecycle here rather than a resource's.

/**
 * WHAT THIS DOOR IS DOING — the four states, as a sum.
 *
 * A SUM AND NOT FOUR FLAGS, because two of the sixteen combinations three
 * booleans and a hold could spell are lies a reader would be shown: an answer
 * standing beside a failure (a page pruned by the last page's ids under a line
 * saying the server could not answer), and a pane waiting for a question nobody
 * asked. Neither is spellable here.
 *
 * Internal: what a caller wants is the projections ({@link Asked}), which is
 * where the four arms are read once each.
 */
type Standing =
  /** No question — an empty box, or one the grammar refused and has already
   *  answered for itself. */
  | { readonly kind: "none" }
  /** A question, and what STOOD while it is being answered: the last answer of
   *  this filter session, or nothing before the first. */
  | { readonly kind: "waiting"; readonly stood: Answered | undefined }
  /** A question, answered. */
  | { readonly kind: "answered"; readonly answer: Answered }
  /** A question the server could not answer, in its own words — and NOTHING
   *  standing, which is the arm that makes the pairing structural. */
  | { readonly kind: "failed"; readonly because: string }

/** Nothing is asked — ONE value, shared, because an unfiltered pane produces it
 *  on every revision the store publishes and a fresh record per frame is a
 *  fresh value for whatever memoises against it. */
const NOTHING_ASKED: Standing = { kind: "none" }

/** An answer AND the page it is about, as one value — so a caller drawing a
 *  page can ask whether this is an answer to THAT one. Two accessors would be
 *  two moments, which is precisely what the pairing exists to close
 *  ({@link Asked.about}). */
interface Answered {
  readonly about: PageRequest
  readonly answer: NarrowingAnswer
}

/** What the page's filter has been told. */
export interface Asked {
  /**
   * The nodes the query selects on this page, or `undefined` for "nothing has
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
  /** A reading that could not be taken, in the server's own words — `null`
   *  when there is none, and never a stale one: the subscription's lifecycle
   *  re-arms when the question moves, so a failure cannot outlive the query it
   *  was about. Its own slot, never the grammar's refusals: a refused QUERY is
   *  an answer, and this is the server saying it could not answer. */
  readonly failure: Accessor<string | null>
  /**
   * WHICH PAGE the answer in hand is ABOUT — `null` when there is none.
   *
   * THE OTHER HALF OF THE JOIN, and the half {@link awaiting} cannot make. That
   * one holds the PAGE while the narrowing is behind; this one is for the
   * opposite order — the answer landing while the pane is still drawing the
   * PREVIOUS page, where ids that name nothing on screen take every row off it.
   *
   * That order is measured NOT to happen (`../pane/PageView.tsx`'s `together`
   * carries the number), and no member promises it will not. Spending an answer
   * only on the page it is ABOUT is what makes the invariant this code's rather
   * than the socket's.
   */
  readonly about: Accessor<PageRequest | null>
  /**
   * IS A NARROWED PAGE STILL WAITING TO BE TOLD WHAT IT NARROWS TO?
   *
   * TWO SUBSCRIPTIONS ARE TWO MOMENTS, and this is the one place that costs
   * anything. A page and its narrowing are read on the same pulse and sent as
   * two frames, so a pane arriving at a `?q=` address is answered TWICE — and
   * the page's frame lands first, because the narrowing's read is that same
   * page walk plus a matcher over what it found. Drawn as it arrives, the
   * reader gets one frame of the page WHOLE before the query the address spelled
   * takes rows off it — the flash `reactivity-after-the-flip` §3.1's 1.6 already
   * ruled against, arriving from the other side.
   *
   * So the pane HOLDS the page while this is true (`../reading.tsx`'s
   * `holding`): what was on screen stays on screen, and a pane with nothing on
   * screen yet draws its `Reading…` line — the one honest beat `vault-in-browser`
   * §5a already licenses for a navigation. It is the join between the two
   * readings, made where they are both drawn rather than by folding one into
   * the other's frame (`docs/brainstorming/filter-rides-the-page.md` §4 argues
   * why they are two members).
   *
   * FALSE WHILE NOTHING IS ASKED, so an unfiltered pane is never held. A
   * keystroke makes it true for one round trip, over a page that has not moved,
   * which is the rows-hold-still rule and costs the pane nothing. And a hold is
   * never PERMANENT without a clause for it: a stream that fails clears its own
   * `pending` in the same batch it records the failure, so no answer coming
   * means the page is released — and {@link standing} drops the answer with it,
   * because the two are only worth holding together.
   */
  readonly awaiting: Accessor<boolean>
}

/**
 * Ask as the question changes, and go on being told.
 *
 * IT TAKES THE PARSE, not a conditional the caller wrote: whether there is a
 * question at all is one predicate over one parsed value, and spelling it in
 * the pane as well would be two places that have to agree about when the wire
 * is worth a subscription. An empty box and a query the grammar refused are
 * both answered by the parse — the first selects nothing and the second is a
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
   * WHICH PAGE these words narrow — the pane's own request, the same value its
   * page subscription is opened on (`../page.ts`'s `requestFor`).
   *
   * THE PAGE ITSELF and not a reading of it, which is the shape of the whole
   * change: the server holds the page, so the browser names it rather than
   * describing it. What it used to hand over instead was a `Drawn` — to read
   * one boolean off it (whether these rows are put-away ones) and a generation
   * beside it (whether the set had moved). Both are the server's now, asked of
   * the page it is already computing.
   *
   * `null` holds the subscription closed, which is the framework's own way of
   * saying "do not ask yet" — a pane whose address names no page.
   */
  readonly page: Accessor<PageRequest | null>
  /**
   * WHICH PAGE, as an identity and never read — the caller's own answer to "is
   * this the same page" (`../routes.ts`'s `samePage`, the memo the pane's
   * subscription is opened on).
   *
   * It is here for ONE distinction, and it is the one {@link SETTLE_MS} is
   * about: a settle is a fact about a pair of HANDS, and the words that arrive
   * with an address were not typed. A `?q=` reached by a pin, by Back or by a
   * cold load is final the moment it is on screen, so waiting 200ms to ask about
   * it is 200ms of a page drawn WHOLE that the address said was narrowed. Same
   * page, moving words: somebody is typing, and the debounce is the point.
   *
   * NOT the page request above, which is nearly the same fact and not quite:
   * that one is the QUESTION and moves for a link to a heading inside the
   * document already on screen, where this is where the READER went.
   */
  readonly opened: Accessor<unknown>
}): Asked => {
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

  /**
   * WHEN TO ASK: at once for a query nobody typed, after the settle for one
   * somebody is typing — `./typed.ts`, which is where that one rule lives now
   * that the everywhere page asks the same thing about the same keystrokes.
   */
  const asked = createTyped({ words: question, arrived: source.opened })

  /**
   * THE SUBSCRIPTION'S INPUT — the page and the settled words, as one value.
   *
   * BY VALUE (`sameNarrowingRequest`), and it is the line that makes this a
   * standing view rather than a re-ask: a pane mints a fresh `PageRequest` on
   * every revision the store publishes, and a memo comparing by reference would
   * tear this stream down and re-open it for each one — which is the defect the
   * whole change exists to end, re-created in the browser.
   */
  const asking = createMemo<NarrowingRequest | null>(
    () => {
      const text = asked()
      const page = source.page()
      return text === null || page === null ? null : { page, text }
    },
    null,
    {
      equals: (was, is) =>
        was === is ||
        (was !== null && is !== null && sameNarrowingRequest(was, is)),
    },
  )

  const answer = olai.streams.narrowing.use(asking)

  /**
   * THE LAST ANSWER OF THIS FILTER SESSION — `../reading.tsx`'s rule for the
   * page, applied to the reading beside it and for its reason.
   *
   * A subscription blanks its value the moment its INPUT moves, so a reader
   * taking it raw sees `A → undefined → B` on every settled keystroke. That
   * beat is honest before the FIRST answer of a filter session and is a LIE
   * afterwards: what is on screen while B is in flight is still A's rows, and a
   * page that emptied and filled back in per word typed would be flicker over
   * rows somebody is reading. The bar says they are a question behind
   * (`./count.ts`'s `ANSWERING`) and the answer replaces them once.
   *
   * A SESSION AND NOT FOR EVER, which is the reset in the first line: a box
   * emptied and typed into again would otherwise draw the PREVIOUS filter's
   * rows for the length of the round trip after the settle — an answer to a
   * question nobody asked, over the page it did narrow. Holding still is honest
   * between two queries somebody is typing through; across a clear there is
   * nothing to hold.
   *
   * A MEMO OVER ITS OWN LAST VALUE, not a signal an effect writes: an effect
   * runs AFTER the render that saw the blank.
   */
  const stood = createMemo<Answered | undefined>((was) => {
    const question = asking()
    if (question === null) return undefined
    const arrived = answer()
    // WHICH PAGE this answer is about, captured as it lands — see
    // {@link Asked.about}. The question in hand IS the input the subscription is
    // open on, so it is the one this frame answers; taken from it rather than
    // asserted off `asked()`, which would be the same fact spelled twice.
    return arrived === undefined ? was : { about: question.page, answer: arrived }
  }, undefined)

  /**
   * WHAT THIS DOOR IS DOING, as ONE value — the four states a filtered pane can
   * be in, so the two that must never coincide cannot be spelled.
   *
   * It was four accessors reading two of the subscription's signals and a hold
   * beside them, and the state machine that made was written down nowhere: the
   * rule "a reading that FAILED shows nothing" lived as a clause on one of the
   * four, and "there is something to wait for" as a conjunction on another.
   * Both are arms here.
   *
   * WHY THAT PAIRING IS THE LOAD-BEARING ONE. A page and its narrowing are held
   * together on purpose ({@link Asked.awaiting}), so while one is in flight the
   * rows on screen and the answer that narrowed them are one page's. A FAILURE
   * releases the page — the seam clears `pending` in the same batch it records
   * the failure — and an answer left standing beside it would prune the next
   * page's rows by the last page's ids, silently, under a line saying the
   * server could not answer. `failed` carries no answer, so that page cannot be
   * drawn.
   */
  const standing = createMemo<Standing>(() => {
    const question = asking()
    if (question === null) return NOTHING_ASKED
    const failed = answer.error()
    if (failed !== undefined) return { kind: "failed", because: failed.message }
    const arrived = answer()
    return arrived === undefined
      ? { kind: "waiting", stood: stood() }
      : { kind: "answered", answer: { about: question.page, answer: arrived } }
  })

  /** What the three answer-shaped projections read — the answer to show, or
   *  nothing. One switch, so a fifth state would be a compile error at every
   *  reader rather than an arm somebody forgot. */
  const showing = (): Answered | undefined => {
    const at = standing()
    switch (at.kind) {
      case "answered":
        return at.answer
      case "waiting":
        return at.stood
      case "none":
      case "failed":
        return undefined
    }
  }

  /**
   * THE ANSWER, as a page looks itself up in it — id → why.
   *
   * Keyed by the node's own id, which is what a row looks itself up by
   * (`@olai/format`'s `Selected`). Filled by a loop rather than from an array
   * of pairs: this is the one allocation in the feature that is the size of the
   * answer, and the pairs would be a second one of the same size, thrown away
   * by the line that reads them.
   *
   * NO `equals` OF ITS OWN, and its absence is the fix rather than an omission.
   * A fresh `Map` per answer used to make `./narrowing.ts` prune the whole page
   * again for a match set that had not moved, because the door was re-asked on
   * every frame and answered overwhelmingly with the ids it already had. The
   * server compares now (`@olai/format`'s `sameNarrowing`, bound as this
   * member's `isEqual`), so an answer that did not move is not sent, this memo
   * does not re-run, and the same `Map` is handed out — one comparison, on the
   * side that can act on it.
   */
  const matched = createMemo<Matches | undefined>(() => {
    const answered = showing()
    if (answered === undefined) return undefined
    const matches = new Map<string, MatchedNode>()
    for (const one of answered.answer.matches) matches.set(one.id, one)
    return matches
  })

  return {
    matched,
    /**
     * WHICH QUERY THE ROWS ANSWER — read off the answer's own text, and off
     * nothing else.
     *
     * The two states this has to tell apart are "these rows are about your
     * query" and "these rows are about a query you have moved on from", and the
     * text on the answer is exactly that fact. A REVISION that re-sends this
     * page's narrowing is not one of them: the words did not move, so the rows
     * go on answering what is typed and the wait word never appears for an edit
     * somebody made elsewhere in the vault.
     */
    answering: () => showing()?.answer.text ?? null,
    about: () => showing()?.about ?? null,
    /**
     * WHAT COULD NOT BE READ, and only while it is still about what is typed.
     *
     * The subscription re-arms its `error` when the QUESTION moves, which is
     * everything a stale failure needs — except for the settle in front of it:
     * a reader who starts retyping after a failure would go on being blamed for
     * the old question for 200ms, and a refusal is about the words it was
     * refused for. So it is read against what is TYPED rather than what was
     * asked, which is the same comparison `./narrowing.ts` makes about the rows
     * and is one memo rather than a signal an effect clears.
     */
    failure: () => {
      const at = standing()
      // NOT WHILE THE BOX HAS MOVED ON. The lifetime of the failure is the
      // subscription's — it re-arms when the question does — but the settle
      // sits in front of that, and a reader who starts retyping after a failure
      // would go on being blamed for the old question for 200ms. A refusal is
      // about the words it was refused for, so it is read against what is TYPED
      // rather than against what was asked — the same question `./narrowing.ts`
      // asks about the ROWS, one settle earlier.
      if (at.kind !== "failed" || question() !== asked()) return null
      return at.because
    },
    // The join, as one arm — see {@link Asked.awaiting}. There is no `error`
    // clause beside it and none to go stale: `failed` and `waiting` are two arms
    // of one value, so a hold that is never permanent is the sum's shape rather
    // than a condition kept here (the seam clears `pending` in the same batch it
    // records a failure — `@kolu/surface`'s `createStreamLifecycle`).
    awaiting: () => standing().kind === "waiting",
  }
}
