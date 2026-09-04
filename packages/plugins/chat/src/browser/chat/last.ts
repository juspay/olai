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

import { type Accessor, createEffect, createSignal } from "solid-js"

import { createNewest } from "./newest.ts"
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
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §4.4). A thousand-row
 * conversation paid a thousand reads per token.
 *
 * THE SCAN ITSELF is `./newest.ts`, which is where that rule lives now that a
 * second reader wants it (`./attention/asked.ts`). What is left here is the
 * two things this pill actually decides: which row it is about, and that the
 * ROW is read tracked afterwards — the pick answers with the row's accessor
 * rather than its text, so a token landing on the last agent message wakes one
 * read and not a walk.
 */
export const createLastAgent = (chat: Chat): void => {
  const last = createNewest(chat, (row, at) => (row.kind === "agent" ? at : undefined))
  createEffect(() => {
    rememberAgentText(last()?.()?.text)
  })
}

/** Collapse whitespace and clamp for the pill / mobile strip. */
export const previewText = (text: string, max = 72): string => {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + "…"
}
