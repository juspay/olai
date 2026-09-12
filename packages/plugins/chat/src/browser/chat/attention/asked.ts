/** Derive the newest unanswered question from this conversation's owned
 * transcript reading. The notification's question text follows this reader;
 * the server roster owns counts and current-session standing. */

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
