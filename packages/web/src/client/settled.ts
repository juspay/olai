/**
 * A QUESTION THE SERVER IS ASKED AS SOMEBODY TYPES — the settle, the
 * latest-answer-wins rule, and the one failure slot, named once.
 *
 * ## Why this exists
 *
 * Since `vault-in-browser` the browser answers less and less for itself, so
 * "ask the server, per keystroke" stopped being one door's problem and became a
 * shape. It was written twice — `search/nodes.ts` for the ⌘K palette, the
 * header box and the `((` list; `filter/asking.ts` for the page filter — and a
 * third caller (the row editor's tag vocabulary) is what turned two copies into
 * a rule kept in memory. The rule is here now, and the two shortlist doors are
 * callers of it.
 *
 * What it encapsulates is one axis and it is worth naming it: HOW A KEYSTROKE
 * BECOMES A REQUEST. The settle, which of several in-flight calls may write the
 * failure slot, what an abandoned question does to the answer on screen, and
 * WHICH question the answer on screen is about are four facts about that one
 * thing — four facts that must not differ between two boxes in one app, and
 * that a reader would otherwise have to diff two files to compare. What a door
 * ASKS and what it DRAWS stays the door's, entirely: this takes a thunk and
 * hands back a value.
 *
 * ## The four things a round trip costs, and what is done about each
 *
 *   - **A keystroke may not be a request.** {@link SETTLE_MS} collapses a word
 *     into one question instead of six.
 *   - **An old answer may not land on a new question.** `createResource` drops
 *     the return value of a fetcher whose source has since moved — which is why
 *     there is no sequence counter here and never was. It cannot un-run the
 *     fetcher, so everything that is NOT the return value needs the guard the
 *     framework only gives to the answer: the failure slot is a signal every
 *     question shares, and a slow refusal of question A landing after B
 *     succeeded would paint B's rows with A's error.
 *   - **A question that goes away takes its answer with it, AT ONCE.** A list
 *     left standing behind a query the reader has already backspaced away from
 *     is a list that is lying for as long as it stands, and the settle would
 *     make it lie for 200ms longer. The framework does NOT do this half — a
 *     resource keeps what it last resolved through a falsy source and through
 *     the refetch after it — so the clear is four statements rather than three
 *     (`forget`, below).
 *   - **While the next answer is in flight, what is drawn is the LAST one's.**
 *     That is the right thing to draw and the wrong thing to leave unlabelled,
 *     so the answer CARRIES the question it answers ({@link Settled.answering})
 *     rather than a caller reconstructing "have the rows caught up" out of a
 *     loading flag and an outstanding question. `filter/asking.ts` makes that
 *     argument for itself in its own words — "read off the same thing that
 *     holds them rather than off a signal beside it that is free to be a frame
 *     ahead" — and this is that rule where every caller inherits it.
 *
 * ## What is deliberately NOT here
 *
 * The page filter (`filter/asking.ts`) keeps its own, and the difference is a
 * difference in kind rather than a copy nobody got round to. A shortlist is a
 * question somebody opened, answered once and closed; a filter is a STANDING
 * VIEW of a page, and ONE rule follows from that which no shortlist wants: its
 * last answer must survive a refused call, because a narrowed page may not
 * blank under somebody because a socket blinked. Its generation-on-the-question
 * is not a second one — that is just a value question with an `equals`, which
 * is what {@link createSettled} takes.
 *
 * IT USED TO BE TWO, and the second went the way this file predicted: "must not
 * be asked at all while the wire is down — the box goes inert instead" stopped
 * being anybody's rule the day the offline overlay landed (`vault-in-browser`
 * §5b, `connection/Offline.tsx`), because a frozen app takes no keystroke and
 * there is no box to draw a reason on. What is left between the two files is
 * two knobs — that one, and the ARRIVAL rule `reactivity-route-not-reading`
 * added beside it: a filter asks AT ONCE for a query that came with an ADDRESS
 * (a pin, Back, a cold load), because those words were not typed and nothing
 * more is coming, where every question this file settles was typed into a box
 * that is still open and a shortlist has no address to arrive from. It is worth
 * saying which way that argument now runs: folding the filter in here means two
 * parameters on the shared asker that every caller but one passes `false` for,
 * which is the trade the day somebody makes it.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import {
  type Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from "solid-js"

import { type Call, runAsync } from "./run.ts"

/** How long a keystroke waits for the next one. A whole round trip sits behind
 *  this, so it is pitched just past an ordinary inter-keystroke gap rather than
 *  under it, where it would collapse nothing.
 *
 *  EXPORTED, because the page filter settles on the same number and is not a
 *  caller of this file (see the header): it is one fact about one pair of
 *  hands, and two boxes in one app settling at two speeds is a difference
 *  nobody could account for. It was a sentence in two files saying so; a
 *  sentence is not a constant. */
export const SETTLE_MS = 200

/**
 * SPEND SOMETHING OFF THE ANSWER ON SCREEN — or spend nothing, silently.
 *
 * `act` runs only while what is drawn is about the question being asked;
 * otherwise nothing runs and nothing is said. It is {@link Settled.answering}
 * as an ACT rather than as a label, and that is the whole of why it exists:
 * the label was read correctly at the two doors somebody was thinking about
 * and not at the three next to them, because a fact a caller must remember to
 * consult is a fact a caller forgets
 * (`https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/reactivity-after-the-flip.md`'s 4.12, and the deferral
 * it left behind).
 *
 * WHAT IT IS FOR IS `Enter`, and only `Enter`. A key means "the row under the
 * cursor", and the cursor's row is the one about to change underneath it; a
 * POINTER is a hand on the row it can SEE, and taking that row is exactly what
 * the hand asked for however far the box has moved on. So no door routes a
 * press through this, at any depth.
 *
 * It answers NOTHING, which is the size of the thing rather than an omission:
 * whether a key was spent and whether it was CLAIMED are two facts, and only
 * the second is a door's to act on — a list on screen claims its keys whether
 * or not the row under the cursor was the reader's, because an `Enter` falling
 * past it would do something else entirely. A caller that got a verdict back
 * here would be a caller reconstructing the claim out of it.
 *
 * The refusal is SILENT, and nothing dims while it waits: a whole list going
 * grey and back on every keystroke is a flicker, and this arrived out of a
 * campaign about flicker. The rows catch up a moment later and the same press
 * means what it says (`docs/editing.md` says that in a reader's own words).
 */
export type Taking = (act: () => void) => void

/** A row NOTHING IS BEHIND — the palette's own commands, the composer's file
 *  rows, a day list read off a phrase and a calendar. They are minted in this
 *  tab from what is already in it, so there is no settle and no flight to be
 *  inside of and they spend at once.
 *
 *  It is a {@link Taking} rather than a missing one because "which answer is
 *  this row off" is then a question every row answers: a row type carrying it
 *  OPTIONALLY makes "never behind" an absence, and an absence is what a new
 *  mint site produces by saying nothing — which is an ungated `Enter`, the
 *  defect this whole file is about. Spelled out, a row that forgets is a type
 *  error. */
export const atOnce: Taking = (act) => act()

/**
 * SPEND THE ROW A KEY IS ON — through the answer that row came from.
 *
 * THE OTHER OF THE TWO SHAPES a door comes in, and the rule is which value the
 * take is read off. A door with a ROW TYPE OF ITS OWN carries the take on
 * every row and reads it back here (the ⌘K palette, the header's box, the chat
 * composer's `@` list, the row editor's three widgets). A door whose rows are
 * the wire's own values has nothing to hang it on and asks the search instead
 * ({@link Settled.taking} — `search/Shortlist.tsx`, over bare `NodeHit`s).
 *
 * Carrying it is what a MIXED list needs, and two of these are mixed: the
 * palette draws its own commands above the server's hits and the composer
 * draws the served paths above its nodes, both minted in this tab per
 * keystroke. Gating the DOOR would swallow `Enter` on a command for a settle
 * and a round trip somebody else's search is inside of — which is the
 * palette's oldest gesture and the one a reader makes fastest. And it is what
 * ONE ROW TYPE AT TWO DOORS needs: the header's box draws the palette's rows,
 * and two doors over one row may not gate differently however single-minded
 * either one's list happens to be today.
 *
 * Nothing under the cursor spends nothing, which is not the same as a refusal
 * and is why it is not one — a key over an empty list has nothing to claim.
 */
export const spend = <R extends { readonly taking: Taking }>(
  row: R | undefined,
  act: (row: R) => void,
): void => {
  if (row === undefined) return
  row.taking(() => act(row))
}

/** What a door gets back — three accessors and one act, and every one of them
 *  is a thing a door draws or spends. */
export interface Settled<Q, A> {
  /**
   * WHAT TO DRAW: whatever last answered THIS session, or `undefined` for
   * "nothing has".
   *
   * It HOLDS STILL across a question that has moved — the rows a reader is
   * looking at stay until the next ones arrive, which is the only honest thing
   * to draw during a settle and a flight. It goes `undefined` when the call was
   * refused, and when the question goes away entirely: a session that ENDED
   * takes its answer with it, so the next one opens empty rather than showing
   * what the last one found.
   *
   * The second of those is a clear this file makes rather than one the
   * framework gives — see `forget` in {@link createSettled}, and
   * `./settled.browsertest.ts`, which is the case that found it.
   */
  readonly answer: Accessor<A | undefined>
  /**
   * WHICH QUESTION {@link answer} answers — and `null` the moment that is no
   * longer the question being asked.
   *
   * The one fact a door needs to say whether what is on screen is about the
   * reader: during the settle and the flight of a newer question it is `null`,
   * and a refused call answers nothing and so names nothing. Read off the
   * resolved value rather than off a signal beside it.
   *
   * BOTH WINDOWS, and the settle is the half that was missing: this compared
   * the answer against what had been ASKED, and `asked` does not move until
   * the debounce fires — so for 200ms after a keystroke the rows were labelled
   * as answering a question the reader had already typed past. What a door does
   * with the label is take a row on `Enter`, so the gap was a keystroke that
   * wrote the wrong node (the audit's 4.12 in
   * `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/reactivity-after-the-flip.md`). It is compared
   * against what is WANTED now, which is the sentence above as it was always
   * written.
   */
  readonly answering: Accessor<Q | null>
  /**
   * {@link answering}, AS AN ACT — see {@link Taking}. A door hands it what
   * taking a row of this answer does, and it runs only while the rows are the
   * reader's own.
   *
   * Most doors do not call this at all: they hand it to the rows they mint
   * from this answer, and read it back off the row under the cursor
   * ({@link spend}, which says why). What calls it directly is a door whose
   * rows ARE the wire's values, with nothing of its own to hang it on.
   */
  readonly taking: Taking
  /** A refused call, in the server's own words — `null` when there is none, and
   *  never a stale one. Never silently dropped (`./run.ts` forbids a silent
   *  handler). */
  readonly failure: Accessor<string | null>
}

/**
 * Ask as the question changes. `null` is "not asking" and answers with nothing
 * rather than with the answer from before.
 *
 * IT TAKES THE QUESTION ALREADY DECIDED, which is the line between this and its
 * callers: whether a query is long enough to be worth a trip, whether a trigger
 * is the right kind, what the words are once trimmed — all of that is a
 * function of what somebody typed and belongs to the door that read it. What is
 * here is only WHEN, and what to do with a stale answer.
 */
export const createSettled = <Q, A>(
  question: Accessor<Q | null>,
  ask: (question: Q) => Call<A>,
  /** How two questions are compared — for a door whose question is a VALUE
   *  rather than a string, where a fresh object per keystroke would otherwise
   *  be a fresh round trip for an answer already on screen. Absent is identity,
   *  which is what a string question wants. */
  equals?: (was: Q | null, is: Q | null) => boolean,
): Settled<Q, A> => {
  const same = equals ?? Object.is
  const [failure, setFailure] = createSignal<string | null>(null)
  /** What has actually been asked for: the question, once it stopped moving. */
  const [asked, setAsked] = createSignal<Q | null>(null, { equals: same })
  /** The setter through its UPDATER form, which is the one spelling that means
   *  "this value" for a `Q` the compiler cannot prove is not a function. */
  const put = (next: Q | null) => setAsked(() => next)
  const settle = debounce(put, SETTLE_MS)

  /** The question, COMPARED BEFORE IT IS AN EVENT. A door's question is a fresh
   *  value per keystroke and most keystrokes do not change it — a caret moved
   *  inside `#home`, a trailing space typed after a search query — and without
   *  this each of those restarts the settle, which under continuous unrelated
   *  typing defers the answer indefinitely. The signal below would absorb the
   *  duplicate; the timer would not. */
  const wanted = createMemo<Q | null>(question, null, { equals: same })

  /** Is this fetcher still answering the question that is being asked?
   *  `untrack`, because this is read inside an async continuation: as a
   *  dependency it would make a fetcher's own resolution a reason to re-run
   *  it. */
  const current = (one: Q) => same(untrack(asked), one)

  // THE ANSWER CARRIES ITS QUESTION, which is what makes {@link answering} a
  // fact of one value rather than an inference over three signals.
  const [answer, { mutate }] = createResource(asked, async (one: Q) => {
    const outcome = await runAsync(ask(one))
    if (Result.isFailure(outcome)) {
      if (current(one)) setFailure(outcome.failure.message)
      return undefined
    }
    if (current(one)) setFailure(null)
    return { question: one, answer: outcome.success }
  })

  /**
   * THROW THE ANSWER AWAY — the one thing a resource will not do for itself,
   * and the reason this file touches `mutate` at all.
   *
   * Solid keeps the last resolved value when its source goes falsy (`load()`
   * resolves with the value it already had rather than clearing it), and keeps
   * it again through the refetch that follows. So a door reading the resource
   * straight through re-opens on the PREVIOUS session's answer and goes on
   * drawing it for a whole settle plus a flight — which for the tag completion
   * is not merely stale but WRONG: `complete/completing.tsx` re-spells every
   * row with the trigger armed NOW, so a `#` session's names would be offered,
   * and written, under a later `@` (`@olai/format`'s `vocabulary.ts`: the two
   * sigils are two lists, and offering one namespace's names under the other's
   * is a widget inventing tags the set does not hold).
   *
   * Masking the read while `asked` is null is NOT the fix and was the first one
   * tried: it covers the settle and not the flight after it, because by then a
   * new question is outstanding and the old answer is still what the resource
   * holds. The value has to actually go.
   *
   * `filter/asking.ts` reaches the same rule from the other side, under the
   * words "the guard the resource does not give" — holding still is honest
   * between two questions of ONE session, and across a clear there is nothing
   * to hold. Found by opencode's review of PR #272, with a probe.
   */
  const forget = () => mutate(() => undefined)

  createEffect(() => {
    const asking = wanted()
    if (asking !== null) {
      settle(asking)
      return
    }
    // Clearing takes effect AT ONCE rather than after the settle — see the
    // header's third bullet — and it clears ALL FOUR things a session leaves
    // behind: the settle that has not fired, the question, the bad news, and
    // the answer.
    settle.clear()
    put(null)
    setFailure(null)
    forget()
  })

  /** WHICH QUESTION the answer on screen is about — `null` while it is not the
   *  one being asked. Named rather than spelled into the returned object,
   *  because the taker below is this predicate and would otherwise be a second
   *  copy of it. */
  const answering = (): Q | null => {
    const got = answer()
    return got !== undefined && same(got.question, wanted()) ? got.question : null
  }

  return {
    answer: () => answer()?.answer,
    answering,
    // ONE LINE, and it is the whole of the rule — which is the point of it
    // being here rather than at five doors: what "the rows are the reader's
    // own" means cannot differ between two boxes in one app.
    taking: (act) => {
      if (answering() !== null) act()
    },
    failure,
  }
}
