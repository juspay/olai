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

import { type Accessor, createSignal } from "solid-js"

import type { Chat } from "./state.ts"

const [lastAgentText, setLastAgentText] = createSignal<string | undefined>(
  undefined,
)

/** Last agent prose the open panel has seen, or `undefined` if none yet. */
export const lastAgentPreview: Accessor<string | undefined> = lastAgentText

/** Remember plain text for the minimized face. Empty strings are ignored. */
export const rememberAgentText = (text: string | undefined): void => {
  if (text === undefined) return
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat === "") return
  setLastAgentText(flat)
}

/** Pull the latest agent row from an open chat and remember it. */
export const sampleLastAgent = (chat: Chat): void => {
  let bestText: string | undefined
  let bestSeq = -1
  for (const key of chat.rows()) {
    const row = chat.entry(key)()
    if (row === undefined || row.kind !== "agent") continue
    if (row.seq >= bestSeq) {
      bestSeq = row.seq
      bestText = row.text
    }
  }
  rememberAgentText(bestText)
}

/** Collapse whitespace and clamp for the pill / mobile strip. */
export const previewText = (text: string, max = 72): string => {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + "…"
}
