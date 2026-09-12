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

import { type Accessor } from "solid-js"

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
export const createAsked = (chat: Chat): Accessor<Asked | undefined> => {
  const waiting = createNewest<Asked>(chat, (row, at) => {
    // `kind` is fixed the moment a row exists, so everything that is not a
    // question is dismissed without subscribing to it.
    if (row.kind !== "ask") return undefined
    // ... and a question's outcome is not, so this row's value is read
    // tracked. The value it answers with is the one already in hand.
    at()
    return row.ask.outcome === null ? { id: row.id, text: row.text } : undefined
  })

  return waiting
}
