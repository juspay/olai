/**
 * The last agent message shown on the minimized pill/strip.
 *
 * Deliberately NOT a transcript subscription. The open panel owns the
 * transcript collection (`Panel.tsx`); while shut, Minimized reads only this
 * module-scoped snapshot, updated by the open conversation as rows arrive.
 * That keeps the invariant state.ts and Panel document: a shut panel does not
 * take every streaming frame.
 *
 * Trade-off: a turn that finishes while every tab has the panel minimized
 * will not refresh the pill until something opens the conversation again.
 * Busy pulse still comes from the cheap `chat` cell.
 */

import { type Accessor, createEffect, createMemo, createSignal, untrack } from "solid-js"

import type { Chat } from "./state.ts"

const [lastAgentText, setLastAgentText] = createSignal<string | undefined>(
  undefined,
)

/** Last agent prose the open panel has seen, or `undefined` if none yet. */
export const lastAgentPreview: Accessor<string | undefined> = lastAgentText

/**
 * As much of an answer as a pill can ever draw.
 *
 * The face is 72 characters ({@link previewText}); this is the length of text
 * that CANNOT change what those 72 are, whatever the whitespace in it collapses
 * to. It matters because the answer this is handed grows while a turn runs, so
 * flattening the whole of it is the answer walked once per frame of itself —
 * which is quadratic in an answer's length, for a line nobody can read past
 * the first sentence of.
 */
const ENOUGH = 512

/** Remember plain text for the minimized face. Empty strings are ignored. */
export const rememberAgentText = (text: string | undefined): void => {
  if (text === undefined) return
  const flatten = (words: string) => words.replace(/\s+/g, " ").trim()
  // The head, and the whole of it only when the head says nothing — which for
  // prose means half a kilobyte of pure whitespace, and is here so that the
  // clamp cannot be the reason a pill goes blank.
  const flat = flatten(text.slice(0, ENOUGH)) || flatten(text)
  if (flat === "") return
  setLastAgentText(flat)
}

/**
 * Keep the pill's face up to date for as long as this panel is open.
 *
 * TWO STEPS, and the split is the whole of it: WHICH row is the last agent's
 * is a fact about MEMBERSHIP, and what that row SAYS is a fact about one row.
 *
 * Written as one loop over every row's `.kind`/`.seq`/`.text` — which is what
 * it was — the effect was subscribed to the text of EVERY row in the
 * conversation, so each token the agent streamed re-ran a walk of the whole
 * transcript to set one module signal
 * (docs/brainstorming/reactivity-after-the-flip.md §4.4). A thousand-row
 * conversation paid a thousand reads per token.
 *
 * The KEY is memoised off `chat.rows()`, which is the fold's own key list and
 * hands back THE SAME ARRAY for a frame that added no row (`./order.ts`). A
 * row's `kind` and `seq` are fixed the moment it exists, so nothing but
 * membership can move this answer — hence the `untrack` around the entries a
 * scan does resolve.
 */
export const createLastAgent = (chat: Chat): void => {
  const last = createMemo<string | undefined>(() => {
    let bestKey: string | undefined
    let bestSeq = -1
    for (const key of chat.rows()) {
      const entry = chat.entry(key)
      const row = untrack(entry)
      // A key whose value has not landed is the one thing membership cannot
      // say, so THAT read is tracked: it is what wakes this when the row
      // arrives. Everything else about a row is fixed the moment it exists.
      if (row === undefined) {
        entry()
        continue
      }
      if (row.kind !== "agent") continue
      if (row.seq >= bestSeq) {
        bestSeq = row.seq
        bestKey = key
      }
    }
    return bestKey
  })
  createEffect(() => {
    const key = last()
    rememberAgentText(key === undefined ? undefined : chat.entry(key)()?.text)
  })
}

/** Collapse whitespace and clamp for the pill / mobile strip. */
export const previewText = (text: string, max = 72): string => {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + "…"
}
