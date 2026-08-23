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
 * WHAT IT READS is the reactivity lesson `../last.ts` was rewritten for
 * (docs/brainstorming/reactivity-after-the-flip.md §4.4), with one difference
 * that matters. A row's `kind` and `seq` are fixed the moment it exists, so
 * membership is what moves the answer — but an ask row's OUTCOME is not: it
 * goes from `null` to answered under a key that never moves. So an ask row's
 * value IS tracked and every other row's is not, which costs one read per ask
 * in a conversation rather than one per row per token.
 */

import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js"

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
 * TWO STEPS, like `createLastAgent`: WHICH row is the waiting question is
 * mostly a fact about membership, and what that row SAYS is a fact about one
 * row. The newest waiting one, because a person answers the question in front
 * of them and the newest is the one at the foot of the transcript.
 */
export const createAsked = (chat: Chat): void => {
  const waiting = createMemo<string | undefined>(() => {
    let bestKey: string | undefined
    let bestSeq = -1
    for (const key of chat.rows()) {
      const at = chat.entry(key)
      const row = untrack(at)
      // A key whose value has not landed is the one thing membership cannot
      // say, so THAT read is tracked — it is what wakes this when the row
      // arrives.
      if (row === undefined) {
        at()
        continue
      }
      // `kind` is fixed the moment a row exists, so everything that is not a
      // question is dismissed without subscribing to it.
      if (row.kind !== "ask") continue
      // ... and a question's OUTCOME is not fixed, so this one is tracked.
      const live = at()
      if (live?.kind !== "ask" || live.ask.outcome !== null) continue
      if (live.seq >= bestSeq) {
        bestSeq = live.seq
        bestKey = key
      }
    }
    return bestKey
  })

  createEffect(() => {
    const key = waiting()
    const row = key === undefined ? undefined : chat.entry(key)()
    setPending(
      row === undefined || row.kind !== "ask"
        ? undefined
        : { id: row.id, text: row.text },
    )
  })

  // The panel is shut (or replaced): nobody is watching the transcript, so
  // nothing here is current any more. See the header — a stale question is
  // worse than none.
  onCleanup(() => setPending(undefined))
}
