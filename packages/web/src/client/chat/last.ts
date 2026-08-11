/**
 * The last agent message in the transcript — what the minimized pill shows.
 *
 * A light subscription: keys + one value lookup, not the full fold the open
 * panel does. Safe to hold while the drawer is shut; a streaming turn updates
 * the pill text without re-mounting a transcript.
 */

import type { ChatEntry } from "@olai/surface"
import { type Accessor, createMemo } from "solid-js"

import { olai } from "../wire.ts"

/** Plain text of the most recent agent row, or `undefined` when none yet. */
export const createLastAgentText = (): Accessor<string | undefined> => {
  const transcript = olai.collections.transcript.use()

  return createMemo(() => {
    let best: ChatEntry | undefined
    for (const key of transcript.keys()) {
      const row = transcript.byKey(key)?.()
      if (row === undefined || row.kind !== "agent") continue
      if (best === undefined || row.seq > best.seq) best = row
    }
    if (best === undefined) return undefined
    const text = best.text.trim()
    return text === "" ? undefined : text
  })
}

/** Collapse whitespace and clamp for the pill / mobile strip. */
export const previewText = (text: string, max = 72): string => {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + "…"
}
