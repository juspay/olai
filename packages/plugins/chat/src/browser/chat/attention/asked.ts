/**
 * The question the agent is waiting on, as the OPEN panel last saw it.
 *
 * Deliberately NOT a transcript subscription of its own — the same arrangement
 * `../last.ts` makes for the minimized pill, and for the same reason: the open
 * panel owns the transcript collection (`../Panel.tsx`), and a shut panel that
 * took every streaming frame to keep a banner's second line warm would undo
 * the whole invariant. So this is a module snapshot the open conversation
 * writes, and the banner reads.
 *
 * IT IS CLEARED WHEN THE PANEL CLOSES, which is the difference from the pill's
 * snapshot and is not a detail. A stale last message under a pill reads as
 * "the last thing I saw", which is what a pill is; a stale QUESTION in a system
 * notification reads as the question that just arrived, and would be a banner
 * about something that was answered ten minutes ago. So `onCleanup` empties it
 * and the banner falls back to naming the conversation
 * ({@link ./notice.ts}) — which is the honest sentence for a panel that was
 * not watching.
 *
 * The COUNT is never taken from here. That comes off the chat cell
 * (`ChatState.asking`), which the server counts from these very rows and which
 * every tab has whether its panel is open or not; this is only the words.
 *
 * WHAT IT READS is `../newest.ts`, which owns the reactivity lesson both this
 * and the pill's snapshot were written against
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §4.4) — and the one
 * departure this makes from it is argued at the pick below.
 */

import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { createNewest } from "../newest.ts"
import type { Chat } from "../state.ts"

/**
 * The pending question, as much of it as anything downstream needs.
 *
 * It lives HERE rather than beside the banner that quotes it, because this is
 * where one is produced: a type at its consumer is a dependency pointing the
 * wrong way, and the banner is not the only thing that could ever want to know
 * what the panel is waiting on.
 */
export interface Asked {
  /** The ask row's transcript key — what tells one question from the next, so
   *  the snapshot can answer "still the same one" without comparing prose. */
  readonly id: string
  /** The agent's own words, whole. Clamped by whoever draws them. */
  readonly text: string
}

/** Two snapshots are the same question when they are the same row saying the
 *  same thing — so a frame that moved neither wakes no banner. */
const same = (a: Asked | undefined, b: Asked | undefined): boolean =>
  a === b || (a?.id === b?.id && a?.text === b?.text)

const [pending, setPending] = createSignal<Asked | undefined>(undefined, {
  equals: same,
})

/** The question waiting on a person, or `undefined` — no question, or no open
 *  panel to have seen one. */
export const askPending: Accessor<Asked | undefined> = pending


/**
 * Keep the snapshot for as long as this panel is open.
 *
 * The scan is `../newest.ts`, whose whole subject is the rule this has to
 * follow — track membership, never what a row says — and the ONE place this
 * departs from it is the reason the escape hatch is there: a question's
 * OUTCOME moves from `null` to answered under a key that never moves, so this
 * pick takes the tracked read itself, for ask rows and no others. That costs
 * one read per question in a conversation rather than one per row per token.
 *
 * The NEWEST waiting one, because a person answers the question in front of
 * them and the newest is the one at the foot of the transcript.
 */
export const createAsked = (chat: Chat): void => {
  const waiting = createNewest<Asked>(chat, (row, at) => {
    // `kind` is fixed the moment a row exists, so everything that is not a
    // question is dismissed without subscribing to it.
    if (row.kind !== "ask") return undefined
    // ... and a question's outcome is not, so this row's value is read
    // tracked. The value it answers with is the one already in hand.
    at()
    return row.ask.outcome === null ? { id: row.id, text: row.text } : undefined
  })

  createEffect(() => {
    setPending(waiting())
  })

  // The panel is shut (or replaced): nobody is watching the transcript, so
  // nothing here is current any more. See the header — a stale question is
  // worse than none.
  onCleanup(() => setPending(undefined))
}
