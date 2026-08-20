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
 * Nothing is asked and nothing is queued behind the reader: a question sent
 * down a socket that is not there is not a slower answer, it is no answer. The
 * spans stay plain — which is what they are before any answer — and the
 * question is asked when the wire comes back, because the readout is part of
 * what drives it.
 *
 * THE OVERLAY DOES NOT MAKE THIS REDUNDANT, which is worth saying because it
 * made the filter's inert box redundant and both were the same guard. A frozen
 * app takes no keystroke, so a door somebody TYPES at needs no rule about a
 * dead wire any more; this door is not typed at. Its questions are asked BY
 * arriving prose, and the ids of a batch in flight when the socket died are
 * answered by nothing else — tracking the readout is what asks them again when
 * the wire returns, and without it those spans would stay plain for as long as
 * the message is on screen.
 *
 * ## Why this is not a `createResource`
 *
 * The doors beside it are (`../search/nodes.ts` and `../complete/asking.ts`
 * through `../settled.ts`, and `../filter/asking.ts` with its own), and they
 * ask a different KIND of question: one query, one answer, and an
 * answer to a query the reader has moved on from is worthless — which is
 * exactly what that primitive is for, since it drops the answer to a source
 * that has since moved. Nothing here is ever stale. Answers ACCUMULATE, in any
 * order, into one map of what this message has been told; an id answered a
 * second later is as true as one answered at once, and the last answer must
 * not replace the one before it. So the state is a map and the asking is an
 * effect over what is still unknown.
 *
 * A call that FAILS on a live socket is said out loud instead ({@link
 * declaringFailure}, drawn once by `./Transcript.tsx`): an unmarked
 * paragraph is indistinguishable from a paragraph naming nothing, and a
 * reference that quietly never appears is the silent failure HACKING.md
 * forbids. Those ids stay unknown rather than being remembered as absent, so
 * the next frame of a streaming message, or the wire coming back, asks again.
 */

import { Result } from "effect"
import { type Accessor, createEffect, createSignal, untrack } from "solid-js"

import type { OpFailure } from "@olai/surface"

import { reachable } from "../connection/reaching.ts"
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
 * not a debounce (`../settled.ts`'s `SETTLE_MS` is the other kind, and that
 * file says so — it is where the settle and the latest-wins rule moved when a
 * third keystroke-shaped door wanted them).
 */
const GATHER_MS = 0

/** What a batch came back as: the ids the set declares, as a lookup. Built ONCE
 *  per call rather than per asker — the answer is every message's, and eighty
 *  askers each scanning the whole list to find their own rows is the batch paid
 *  for eighty times. */
type Told = ReadonlyMap<string, string>

/** One question on the wire: which ids it is about, what it answers with, and
 *  WHICH question it is — see {@link said} for what the last of those is for. */
interface Batch {
  /** Its place in the order they LEFT. Batches overlap, so an order is the one
   *  thing a slot shared between them can be judged against. */
  readonly seq: number
  readonly ids: Set<string>
  readonly answer: Promise<Result.Result<Told, OpFailure>>
}

/** How many questions have left this tab. The batch's own name, minted where
 *  the question is made. */
let asked = 0

/** The ids gathered for the next question, and the one answer they all ride.
 *  Module-level because the batch is every asker on screen — one message
 *  cannot see the others, and this is what they share. */
let gathering: Batch | null = null

/**
 * Ask about these ids, on the call the rest of this tick is riding.
 *
 * Every caller gets the SAME promise and the same lookup, which is what makes
 * one call answer everybody: an asker reads the ids it asked about out of it
 * ({@link createDeclared}) and nothing here has to know whose question was
 * whose.
 */
const askAll = (ids: ReadonlyArray<string>): Batch => {
  if (gathering === null) {
    const wanted = new Set<string>()
    const answer = new Promise<Result.Result<Told, OpFailure>>((settle) => {
      setTimeout(() => {
        // Cleared BEFORE the call goes, so ids wanted while it is in flight
        // gather for the next one rather than joining a question that has
        // already left.
        gathering = null
        settle(
          runAsync(olai.procedures.nodes.named({ ids: [...wanted] })).then((outcome) =>
            Result.isFailure(outcome)
              // Re-made rather than passed through: a `Result`'s failure arm
              // carries the success type too, and this one's changed shape.
              ? Result.fail(outcome.failure)
              : Result.succeed<Told>(

                new Map(outcome.success.named.map((one) => [one.asked, one.id])),
              )
          ),
        )
      }, GATHER_MS)
    })
    gathering = { seq: ++asked, ids: wanted, answer }
  }
  for (const id of ids) gathering.ids.add(id)
  return gathering
}

/**
 * THE LAST CALL'S BAD NEWS, in the server's own words — `null` when there is
 * none.
 *
 * ONE signal for the tab, and that is the altitude the CALL is at: a batch is
 * every message on screen, so a refusal is one fact about one question and not
 * eighty. Drawn once, by the transcript pane (`./Transcript.tsx`) — a line per
 * message would put the same sentence under every paragraph of a conversation
 * that had just opened.
 *
 * Set and cleared where the call is made, so the words on screen are about a
 * QUESTION rather than about whichever message happened to read the answer
 * first. WHICH question, said exactly: the NEWEST one to have answered, which
 * is {@link said}'s whole subject and is not the same as the last one to
 * settle.
 */

const [failed, setFailed] = createSignal<string | null>(null)
export const declaringFailure: Accessor<string | null> = failed

/** The newest batch the slot has been told about. Batches overlap — the gather
 *  is cleared before its call goes, so the ids wanted while one is in flight
 *  leave on the next — and they come back in any order. */
let reported = 0

/**
 * WHAT THE SLOT SAYS, from the batch that is saying it.
 *
 * Last-to-SETTLE-wins was what this used to be, and it is the one thing a
 * shared slot cannot be: a slow refusal of an older batch landing after a newer
 * batch succeeded would put a sentence back on screen about a socket that had
 * just answered, and it would stay there — nothing else clears the slot, so the
 * next thing to move it is the next question anybody asks, which for a settled
 * transcript is never. The reverse costs as much: an older success clearing a
 * newer failure leaves a conversation whose spans quietly never mark and says
 * nothing about it, which is the silent failure HACKING.md forbids.
 *
 * So the slot is TAGGED with the batch that set it, and an older batch cannot
 * take it back. `>=` rather than `>`, because a batch answers this once and
 * the equal case is that one answer.
 *
 * THE THIRD ANSWER IN THIS CLIENT to "which of several overlapping calls may
 * write the one shared slot", and the two beside it are named so the next
 * writer picks one rather than inventing a fourth: `../settled.ts` compares the
 * answer's QUESTION against what is wanted now, and `../filter/asking.ts` does
 * the same by identity. Neither fits here — there is no question the reader is
 * typing and no settle to sit behind (the header says why this is not a
 * `createResource` at all) — so what is left is the order the calls LEFT in,
 * which is a counter.
 */
const said = (seq: number, message: string | null): void => {
  if (seq < reported) return
  reported = seq
  setFailed(message)
}

/** What one message has been told about the ids in it. */
export interface Declared {
  /**
   * The node an id names, or `null` — which is the answer for an id the set
   * does not declare AND for one nothing has answered about yet, because they
   * are the same span on screen (`./refs.ts` argues why there is no third
   * state).
   *
   * The rule's own `resolve` shape, so it is handed straight to
   * `markNodeRefs` rather than unwrapped at the call site. Reading it is what
   * SUBSCRIBES the caller: the marking pass runs inside an effect, so the pass
   * re-runs when an answer lands.
   */
  readonly named: (id: string) => string | null
  /** These are the ids this message is asking about — the whole current list,
   *  not an addition, since a message's spans are re-read from its rendered
   *  answer on every frame. Asking twice about one id costs nothing. */
  readonly want: (ids: ReadonlyArray<string>) => void
}

/** One message's asker. */
export const createDeclared = (): Declared => {
  /**
   * WHAT THIS MESSAGE HAS BEEN TOLD, whole: asked id → the node it names, or
   * `null` for an id the set does not declare.
   *
   * ONE map and not two, because "what did the set say about this id" is one
   * fact with three states and splitting the no's off would be a rule nothing
   * enforces — an id must be in at most one of them. The three are told apart
   * without a third value: ABSENT is "nothing asked yet", `null` is "asked, and
   * the set does not declare it", and a string is the node. Which is why
   * {@link Declared.named} can be `get(id) ?? null` — the two that draw the
   * same span answer the same thing.
   *
   * A fresh map per answer, because it is what the marking pass reads and a
   * mutation in place is a change nothing hears about.
   */
  const [known, setKnown] = createSignal<ReadonlyMap<string, string | null>>(new Map())
  /** Ids in a call that has not come back — a fact about a CALL rather than
   *  about what an id means, which is why it is beside the map and not in it.
   *  A plain set: nothing on screen changes when a question leaves. */
  const asking = new Set<string>()
  /** What this message is asking about, as its rendered answer last read. A
   *  plain signal with no equality of its own: a list that has not changed
   *  costs one filter that finds nothing fresh, where a custom `equals` would
   *  cost a rule about the order `markNodeRefs` returns spans in. */
  const [wanted, setWanted] = createSignal<ReadonlyArray<string>>([])

  createEffect(() => {
    const ids = wanted()
    // NOTHING IS ASKED INTO A DEAD SOCKET, and nothing is queued: the spans
    // stay plain, which is what they are before any answer, and tracking the
    // readout is what asks again when the wire comes back.
    if (!reachable(connectionReadout())) return
    // `untrack`: what is known is read to decide what to ask, and an answer
    // landing is not a reason to ask again.
    const told = untrack(known)
    const fresh = ids.filter((id) => !told.has(id) && !asking.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) asking.add(id)
    // DESTRUCTURED, so what the continuation below holds for the length of a
    // round trip is a number and a promise rather than the batch — whose `ids`
    // is every backticked id on screen, retained once per message.
    const { seq, answer } = askAll(fresh)
    void answer
      .then((outcome) => {
        if (Result.isFailure(outcome)) {
          // NOT WRITTEN DOWN AS A NO — a call that did not arrive said nothing
          // about these ids, so they are asked again by the next frame of a
          // streaming answer or by the wire coming back.
          said(seq, outcome.failure.message)
          return
        }
        said(seq, null)
        // EVERY ID ASKED ABOUT IS WRITTEN DOWN, the ones the set does not
        // declare included — which is most of the backticks in any paragraph,
        // and the whole reason a settled message stops asking. The batch
        // answered every message on screen; this one reads the ids it asked.
        const next = new Map(untrack(known))
        for (const id of fresh) next.set(id, outcome.success.get(id) ?? null)
        setKnown(next)
      })
      // WHATEVER HAPPENED, THE QUESTION IS OVER. A `runAsync` rejects only on a
      // DEFECT, which belongs in the console loudly (`../run.ts`) and is not
      // caught here — but ids left in flight for a promise that will never
      // settle are a message that stops asking and never marks again, silently,
      // which is a bug hiding a bug.
      .finally(() => {
        for (const id of fresh) asking.delete(id)
      })
  })

  return {
    named: (id) => known().get(id) ?? null,
    want: (ids) => {
      setWanted(ids)
    },
  }
}

