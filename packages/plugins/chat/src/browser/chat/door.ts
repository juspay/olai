import type { ChatEntry } from "olai-plugin-chat/wire"
import { sentOf, whoOf } from "./spawn.ts"

export const doorOf = (entry: ChatEntry | undefined, calls: number): string | null => {
  if (whoOf(entry) === null) return null
  if (calls <= 0) return null
  const many = calls === 1 ? "1 call" : `${calls} calls`
  const sent = sentOf(entry)
  return sent === null || sent === (entry?.kind === "tool" ? entry.text : null)
    ? many
    : `${sent} · ${many}`
}
