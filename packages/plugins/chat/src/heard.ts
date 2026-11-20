import type { ChatEntry } from "olai-plugin-chat/wire"
import type { Said } from "./sessions.ts"

export const KEPT = 200

export const lastSaid = (entries: ReadonlyMap<string, ChatEntry>): Said | null => {
  let held: Said | null = null
  for (const row of entries.values()) {
    if (row.kind !== "agent") continue
    const line = firstLine(row.text)
    if (line !== null) held = { text: line, at: row.since }
  }
  return held
}

const firstLine = (text: string): string | null => {
  let at = 0
  while (at < text.length) {
    const end = text.indexOf("\n", at)
    const said = (end === -1 ? text.slice(at) : text.slice(at, end)).trim()
    if (said !== "") return said.length <= KEPT ? said : `${said.slice(0, KEPT).trimEnd()}…`
    if (end === -1) break
    at = end + 1
  }
  return null
}
