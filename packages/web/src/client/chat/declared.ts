/**
 * WHICH OF THE IDS IN A MESSAGE THE SET DECLARES — asked of the server, once
 * per message, remembered.
 *
 * ## Why this file exists at all
 *
 * It used to be a lookup: the tab held every node of every outline, so a code
 * span in an agent's prose became a reference by a `Map.get` over the local
 * copy ({@link ./refs.ts} has the rule and always did; `./Entry.tsx` passed it
 * the format's `nodeNamed` bound to that copy). The copy is what
 * `docs/brainstorming/vault-in-browser.md` is taking away — the browser may
 * hold at most the page in front of somebody — so the lookup crosses the wire
 * (`nodes.named`, the same `nodeNamed` run on the other side).
 *
 * ## The batch is the message, and the call is the tick
 *
 * ONE QUESTION PER MESSAGE is the design's unit (§3's transcript row), and it
 * is the right one: a paragraph holds a dozen backticks of which two are ids,
 * and which is which is one question about all of them. A `read_node` per span
 * would be a dozen round trips carrying a dozen nodes in full to decide which
 * two words are pressable.
 *
 * But a message is not the only thing on screen. Opening a conversation mounts
 * every row of it at once, so eighty messages would be eighty questions in one
 * tick — which is why {@link askAll} exists: the ids wanted while the current
 * task runs are gathered and go as ONE call, and every asker in the batch reads
 * its own answer out of it. The unit stays the message; the wire's unit is the
 * tick.
 *
 * ## What is remembered, and for how long
 *
 * An asker belongs to ONE message and holds what it has been told about that
 * message's ids — both directions, so a settled message asks nothing more and a
 * streaming one asks only about the spans its newest frame added. Nothing is
 * re-asked when the directory moves, and that is a decision rather than an
 * oversight:
 *
 *   - **A mark must not flicker.** An answer that re-arrived per revision would
 *     be a reference blinking out of an old paragraph while somebody reads it,
 *     and every open message re-asking on every keystroke anybody makes
 *     anywhere in the vault is a question per message per revision for prose
 *     that has not changed a character.
 *   - **What a message says is what was true when it was said.** A transcript
 *     is a record of what happened; a node the agent named an hour ago and
 *     somebody has since put away is still the node that sentence is about, and
 *     the press lands on its page, which says where it now is.
 *
 * So the staleness is bounded by the MESSAGE, not by the tab: the next message
 * that names the same id asks again and gets the current answer. It is stated
 * out loud because it is a real change — the old lookup tracked the live set
 * and un-marked a span the moment the file said so.
 *
 * ## What a dead wire does
 *
 * Nothing is asked and nothing is queued behind the reader, which is
 * `../filter/asking.ts`'s rule and this door's for the same reason: a question
 * sent down a socket that is not there is not a slower answer, it is no answer.
 * The spans stay plain — which is what they are before any answer — and the
 * question is asked when the wire comes back, because the readout is part of
 * what drives it. The app-wide answer to a dead wire is the offline overlay
 * (`vault-in-browser.md` §5b), which is its own PR.
 *
 * A call that FAILS on a live socket is said out loud instead ({@link
 * Declared.failure}, drawn under the message by `./Entry.tsx`): an unmarked
 * paragraph is indistinguishable from a paragraph naming nothing, and a
 * reference that quietly never appears is the silent failure HACKING.md
 * forbids. Those ids stay unknown rather than being remembered as absent, so
 * the next frame of a streaming message, or the wire coming back, asks again.
 */

import { Result } from "effect"
import { type Accessor, createEffect, createSignal, untrack } from "solid-js"

import type { NamedAnswer, OpFailure } from "@olai/surface"

import { unreachable } from "../connection/reaching.ts"
import { runAsync } from "../run.ts"
import { connectionReadout, olai } from "../wire.ts"

/**
 * How long ids are gathered before the question goes.
 *
 * ZERO, and it is not "immediately": a timeout of zero fires after the current
 * task, and every asker on screen wants its ids from inside one task — Solid
 * runs the effects of a render in one batch, so a conversation opening asks its
 * eighty messages' ids in one call. There is no keystroke here to settle
 * against and no reader waiting on a beat, which is why this is a gather and
 * not a debounce (`../search/nodes.ts`'s `SETTLE_MS` is the other kind, and
 * says so).
 */
const GATHER_MS = 0

/** The ids gathered for the next question, and the one answer they all ride.
 *  Module-level because the batch is every asker on screen — one message
 *  cannot see the others, and this is what they share. */
let gathering: {
  readonly ids: Set<string>
  readonly answer: Promise<Result.Result<NamedAnswer, OpFailure>>
} | null = null

/**
 * Ask about these ids, on the call the rest of this tick is riding.
 *
 * Every caller gets the SAME promise, which is what makes one call answer
 * everybody: an asker reads its own ids out of the answer and ignores the rest
 * ({@link createDeclared}), so nothing here has to know whose question was
 * whose.
 */
const askAll = (
  ids: ReadonlyArray<string>,
): Promise<Result.Result<NamedAnswer, OpFailure>> => {
  if (gathering === null) {
    const wanted = new Set<string>()
    const answer = new Promise<Result.Result<NamedAnswer, OpFailure>>((settle) => {
      setTimeout(() => {
        // Cleared BEFORE the call goes, so ids wanted while it is in flight
        // gather for the next one rather than joining a question that has
        // already left.
        gathering = null
        settle(runAsync(olai.procedures.nodes.named({ ids: [...wanted] })))
      }, GATHER_MS)
    })
    gathering = { ids: wanted, answer }
  }
  for (const id of ids) gathering.ids.add(id)
  return gathering.answer
}

/** What one message has been told about the ids in it. */
export interface Declared {
  /** The node an id names, or `null` — for the ids answered so far, and `null`
   *  for everything else: an id the set does not declare and an id nothing has
   *  answered about yet are the same span on screen (`./refs.ts` argues why
   *  there is no third state). Reactive: the marking pass re-runs on it. */
  readonly named: Accessor<(id: string) => string | null>
  /** These are the ids this message is asking about — the whole current list,
   *  not an addition, since a message's spans are re-read from its rendered
   *  answer on every frame. Asking twice about one id costs nothing. */
  readonly want: (ids: ReadonlyArray<string>) => void
  /** A refused call, in the server's own words — `null` when there is none.
   *  Drawn under the message it is about. */
  readonly failure: Accessor<string | null>
}

/** Whether two lists of ids are the same question. Order included, because
 *  `askedIn` reads the spans in the order they are written and a message whose
 *  prose has not changed hands back the same list. */
const sameIds = (was: ReadonlyArray<string>, is: ReadonlyArray<string>): boolean =>
  was.length === is.length && was.every((id, at) => id === is[at])

/** One message's asker. */
export const createDeclared = (): Declared => {
  /** What the set declared: asked id → the node it names. A fresh map per
   *  answer, because it is what the marking pass reads and a mutation in place
   *  is a change nothing hears about. */
  const [declared, setDeclared] = createSignal<ReadonlyMap<string, string>>(new Map())
  const [failure, setFailure] = createSignal<string | null>(null)
  /** Ids the answer did not name — the other half of what is known, and a
   *  plain set rather than a signal because it changes NOTHING on screen: a
   *  span nothing declares looks exactly like a span nothing has answered
   *  about. What it is for is not asking twice. */
  const undeclared = new Set<string>()
  /** Ids in a call that has not come back. */
  const asking = new Set<string>()
  const [wanted, setWanted] = createSignal<ReadonlyArray<string>>([], { equals: sameIds })

  createEffect(() => {
    const ids = wanted()
    // NOTHING IS ASKED INTO A DEAD SOCKET, and nothing is queued: the spans
    // stay plain, which is what they are before any answer, and tracking the
    // readout is what asks again when the wire comes back.
    if (unreachable(connectionReadout()) !== null) return
    // `untrack`: what is known is read to decide what to ask, and an answer
    // landing is not a reason to ask again.
    const known = untrack(declared)
    const fresh = ids.filter((id) =>
      !known.has(id) && !undeclared.has(id) && !asking.has(id)
    )
    if (fresh.length === 0) return
    for (const id of fresh) asking.add(id)
    const mine = new Set(fresh)
    void askAll(fresh).then((outcome) => {
      for (const id of fresh) asking.delete(id)
      if (Result.isFailure(outcome)) {
        // NOT REMEMBERED AS ABSENT — a call that did not arrive said nothing
        // about these ids, so they are asked again by the next frame of a
        // streaming answer or by the wire coming back.
        setFailure(outcome.failure.message)
        return
      }
      setFailure(null)
      const named = new Map(untrack(declared))
      for (const one of outcome.success.named) {
        // The batch carried other messages' ids too; this one keeps its own,
        // so a message holds the answers to the questions it asked.
        if (mine.has(one.asked)) named.set(one.asked, one.id)
      }
      // Everything asked about and not named is not a node, and is not asked
      // about again: that is the answer, and it is most of the backticks in
      // any paragraph.
      for (const id of fresh) if (!named.has(id)) undeclared.add(id)
      setDeclared(named)
    })
  })

  return {
    named: () => {
      const known = declared()
      return (id) => known.get(id) ?? null
    },
    want: (ids) => {
      setWanted(ids)
    },

    failure,
  }
}
